import { db, loans, borrowers } from "../../../db";
import { eq, inArray, not } from "drizzle-orm";
import { getLoanSnapshots } from "../../ledger/snapshot.service";
import { notificationService } from "./notification.service";
import { hasNotificationBeenSentToday } from "../repositories/notification.repository";
import { buildEmiReminder, buildOverdueNotice } from "../templates/external-templates";
import { logger } from "../../../utils/logger";

/**
 * Fail-safe wrapper around the idempotency DB check.
 *
 * If the query itself fails (e.g. table not yet migrated, transient connection
 * drop) we do NOT crash the sweep or surface a raw SQL error to the admin.
 * Instead we:
 *   1. Log the real error server-side with full detail.
 *   2. Return `true` — "treat as already sent" — to skip this loan safely
 *      rather than risk a double-send or an unhandled exception.
 *   3. Append a concise, human-readable message to `result.errors`.
 */
async function safeHasBeenSentToday(
    loanId: string,
    triggerType: Parameters<typeof hasNotificationBeenSentToday>[1],
    channel: Parameters<typeof hasNotificationBeenSentToday>[2],
    loanAccountNumber: string,
    errors: string[],
): Promise<boolean> {
    try {
        return await hasNotificationBeenSentToday(loanId, triggerType, channel);
    } catch (err: any) {
        logger.error("Failed idempotency check — skipping loan to avoid duplicate send", {
            loanId,
            triggerType,
            channel,
            err: err?.message ?? String(err),
        });
        errors.push(
            `Idempotency check failed for Loan #${loanAccountNumber} (${channel} / ${triggerType}) — skipped to be safe.`,
        );
        return true; // fail-safe: skip rather than double-send
    }
}

let isSweepRunning = false;


export interface SweepResult {
    success: boolean;
    totalActiveLoans: number;
    emiRemindersSent: number;
    overdueNoticesSent: number;
    skippedAlreadySent: number;
    errors: string[];
}

/**
 * Runs a sweep across all active loans for:
 * 1. Overdue notices (DPD > 0, overdue amount > 0)
 * 2. Upcoming EMI due reminders (due in <= 3 days)
 *
 * Guaranteed idempotency: will not send duplicate messages on the same calendar day.
 * Protected by a concurrency lock to prevent parallel runs by multiple admins/cron.
 */
export async function runDailyNotificationSweep(): Promise<SweepResult> {
    if (isSweepRunning) {
        logger.warn("Notification sweep requested while already running. Skipping concurrent run.");
        return {
            success: false,
            totalActiveLoans: 0,
            emiRemindersSent: 0,
            overdueNoticesSent: 0,
            skippedAlreadySent: 0,
            errors: ["A notification sweep is already in progress. Please wait."],
        };
    }

    isSweepRunning = true;

    const result: SweepResult = {
        success: true,
        totalActiveLoans: 0,
        emiRemindersSent: 0,
        overdueNoticesSent: 0,
        skippedAlreadySent: 0,
        errors: [],
    };

    try {
        logger.info("Starting automated daily external notification sweep...");

        // Fetch loans that are not CLOSED or REJECTED
        const activeLoans = await db
            .select({
                id: loans.id,
                loanAccountNumber: loans.loanAccountNumber,
                borrowerId: loans.borrowerId,
                status: loans.status,
                sanctionedAmount: loans.sanctionedAmount,
                borrowerName: borrowers.name,
                borrowerPhone: borrowers.phone,
                borrowerEmail: borrowers.email,
            })
            .from(loans)
            .innerJoin(borrowers, eq(loans.borrowerId, borrowers.id))
            .where(not(inArray(loans.status, ["CLOSED", "WRITTEN_OFF"])));

        result.totalActiveLoans = activeLoans.length;
        if (activeLoans.length === 0) {
            logger.info("No active loans found for notification sweep.");
            return result;
        }

        const loanIds = activeLoans.map((l) => l.id);
        const snapshots = await getLoanSnapshots(loanIds);

        const now = new Date();
        const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

        for (const loan of activeLoans) {
            const snapshot = snapshots.get(loan.id);
            if (!snapshot || !snapshot.hasEntries) continue;

            const borrowerPhone = loan.borrowerPhone;
            const borrowerEmail = loan.borrowerEmail;

            // --- 1. OVERDUE NOTICES (DPD > 0 and amountOverdue > 0) ---
            if (snapshot.dpd > 0 && snapshot.amountOverdue > 0) {
                const alreadySentWa = borrowerPhone
                    ? await safeHasBeenSentToday(loan.id, "SCHEDULED_OVERDUE", "WHATSAPP", loan.loanAccountNumber, result.errors)
                    : false;
                const alreadySentEmail = borrowerEmail
                    ? await safeHasBeenSentToday(loan.id, "SCHEDULED_OVERDUE", "EMAIL", loan.loanAccountNumber, result.errors)
                    : false;

                if (alreadySentWa && alreadySentEmail) {
                    result.skippedAlreadySent++;
                } else {
                    const notice = buildOverdueNotice({
                        borrowerName: loan.borrowerName,
                        loanAccountNumber: loan.loanAccountNumber,
                        overdueAmount: snapshot.amountOverdue,
                        dpd: snapshot.dpd,
                    });

                    // WhatsApp
                    if (borrowerPhone && !alreadySentWa) {
                        try {
                            await notificationService.sendWhatsapp(
                                borrowerPhone,
                                notice.whatsappText,
                                {
                                    borrowerId: loan.borrowerId,
                                    loanId: loan.id,
                                    recipient: borrowerPhone,
                                    title: `Overdue Notice (${snapshot.dpd} DPD)`,
                                    message: `Overdue balance of ₹${snapshot.amountOverdue} on Loan #${loan.loanAccountNumber}`,
                                    triggerType: "SCHEDULED_OVERDUE",
                                },
                            );
                            result.overdueNoticesSent++;
                        } catch (err: any) {
                            logger.error("Failed to send overdue WhatsApp", { loanId: loan.id, error: err.message });
                            result.errors.push(`WhatsApp Overdue for #${loan.loanAccountNumber}: ${err.message}`);
                        }
                    }

                    // Email
                    if (borrowerEmail && !alreadySentEmail) {
                        try {
                            await notificationService.sendEmail(
                                {
                                    to: borrowerEmail,
                                    subject: notice.emailSubject,
                                    html: notice.emailHtml,
                                    text: notice.whatsappText,
                                },
                                {
                                    borrowerId: loan.borrowerId,
                                    loanId: loan.id,
                                    recipient: borrowerEmail,
                                    title: `Overdue Notice (${snapshot.dpd} DPD)`,
                                    message: `Overdue balance of ₹${snapshot.amountOverdue} on Loan #${loan.loanAccountNumber}`,
                                    triggerType: "SCHEDULED_OVERDUE",
                                },
                            );
                            result.overdueNoticesSent++;
                        } catch (err: any) {
                            logger.error("Failed to send overdue Email", { loanId: loan.id, error: err.message });
                            result.errors.push(`Email Overdue for #${loan.loanAccountNumber}: ${err.message}`);
                        }
                    }
                }
            }

            // --- 2. UPCOMING EMI REMINDER (nextDueDate within 3 days) ---
            if (snapshot.nextDueDate && snapshot.totalPayable > 0) {
                const dueDate = new Date(snapshot.nextDueDate);
                const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                // Send reminder if due in <= 3 days and >= 0 days (today)
                if (diffDays >= 0 && diffDays <= 3) {
                    const alreadySentWa = borrowerPhone
                        ? await safeHasBeenSentToday(loan.id, "SCHEDULED_EMI", "WHATSAPP", loan.loanAccountNumber, result.errors)
                        : false;
                    const alreadySentEmail = borrowerEmail
                        ? await safeHasBeenSentToday(loan.id, "SCHEDULED_EMI", "EMAIL", loan.loanAccountNumber, result.errors)
                        : false;

                    if (alreadySentWa && alreadySentEmail) {
                        result.skippedAlreadySent++;
                    } else {
                        const amountDue = snapshot.interestOutstanding > 0 ? snapshot.interestOutstanding : snapshot.closingBalance;
                        const reminder = buildEmiReminder({
                            borrowerName: loan.borrowerName,
                            loanAccountNumber: loan.loanAccountNumber,
                            amountDue,
                            dueDate: snapshot.nextDueDate,
                        });

                        // WhatsApp
                        if (borrowerPhone && !alreadySentWa) {
                            try {
                                await notificationService.sendWhatsapp(
                                    borrowerPhone,
                                    reminder.whatsappText,
                                    {
                                        borrowerId: loan.borrowerId,
                                        loanId: loan.id,
                                        recipient: borrowerPhone,
                                        title: `Installment Due on ${snapshot.nextDueDate}`,
                                        message: `Upcoming installment of ₹${amountDue} due on ${snapshot.nextDueDate}`,
                                        triggerType: "SCHEDULED_EMI",
                                    },
                                );
                                result.emiRemindersSent++;
                            } catch (err: any) {
                                logger.error("Failed to send EMI reminder WhatsApp", { loanId: loan.id, error: err.message });
                                result.errors.push(`WhatsApp EMI for #${loan.loanAccountNumber}: ${err.message}`);
                            }
                        }

                        // Email
                        if (borrowerEmail && !alreadySentEmail) {
                            try {
                                await notificationService.sendEmail(
                                    {
                                        to: borrowerEmail,
                                        subject: reminder.emailSubject,
                                        html: reminder.emailHtml,
                                        text: reminder.whatsappText,
                                    },
                                    {
                                        borrowerId: loan.borrowerId,
                                        loanId: loan.id,
                                        recipient: borrowerEmail,
                                        title: `Installment Due on ${snapshot.nextDueDate}`,
                                        message: `Upcoming installment of ₹${amountDue} due on ${snapshot.nextDueDate}`,
                                        triggerType: "SCHEDULED_EMI",
                                    },
                                );
                                result.emiRemindersSent++;
                            } catch (err: any) {
                                logger.error("Failed to send EMI reminder Email", { loanId: loan.id, error: err.message });
                                result.errors.push(`Email EMI for #${loan.loanAccountNumber}: ${err.message}`);
                            }
                        }
                    }
                }
            }
        }

        logger.info("Notification sweep complete", {
            totalActive: result.totalActiveLoans,
            emiSent: result.emiRemindersSent,
            overdueSent: result.overdueNoticesSent,
            skipped: result.skippedAlreadySent,
        });

        return result;
    } catch (error: any) {
        logger.error("Error during notification sweep", { err: error });
        result.success = false;
        result.errors.push(error.message);
        return result;
    } finally {
        isSweepRunning = false;
    }
}

/** Background scheduler: runs daily checks */
let schedulerInterval: NodeJS.Timeout | null = null;

export function initNotificationScheduler() {
    if (schedulerInterval) return;

    logger.info("Initializing notification background scheduler...");

    // Check hourly if current hour is 09:30 AM or 10:00 AM IST
    schedulerInterval = setInterval(async () => {
        try {
            const now = new Date();
            // Offset to IST (UTC + 5:30)
            const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
            const istDate = new Date(utcTime + 5.5 * 3600000);
            const hour = istDate.getHours();
            const minute = istDate.getMinutes();

            // Run at 09:30 AM or 10:00 AM
            if ((hour === 9 && minute >= 30 && minute < 35) || (hour === 10 && minute >= 0 && minute < 5)) {
                await runDailyNotificationSweep();
            }
        } catch (err) {
            logger.error("Error in scheduler interval", { err });
        }
    }, 5 * 60 * 1000); // Check every 5 minutes
}

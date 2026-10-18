import { db, loans, borrowers } from "../../../db";
import { eq } from "drizzle-orm";
import { getLoanSnapshot } from "../../ledger/snapshot.service";
import { notificationService } from "./notification.service";
import { buildPaymentReceipt, buildDisbursementNotice } from "../templates/external-templates";
import { logger } from "../../../utils/logger";

/**
 * Fires an external payment receipt (WhatsApp & Email) to the borrower
 * when a payment is recorded in the ledger.
 * Non-blocking: failures are logged and do not abort the transaction.
 */
export async function notifyPaymentReceipt(params: {
    loanId: string;
    amount: number;
    paymentDate: string;
    receiptNumber?: string;
}): Promise<void> {
    try {
        const loanData = await db
            .select({
                loanId: loans.id,
                loanAccountNumber: loans.loanAccountNumber,
                borrowerId: loans.borrowerId,
                borrowerName: borrowers.name,
                borrowerPhone: borrowers.phone,
                borrowerEmail: borrowers.email,
            })
            .from(loans)
            .innerJoin(borrowers, eq(loans.borrowerId, borrowers.id))
            .where(eq(loans.id, params.loanId))
            .limit(1);

        const loan = loanData[0];
        if (!loan) return;

        const snapshot = await getLoanSnapshot(params.loanId);
        const receipt = buildPaymentReceipt({
            borrowerName: loan.borrowerName,
            loanAccountNumber: loan.loanAccountNumber,
            amountPaid: params.amount,
            paymentDate: params.paymentDate,
            outstandingBalance: snapshot.closingBalance,
            receiptNumber: params.receiptNumber,
        });

        // WhatsApp
        if (loan.borrowerPhone) {
            try {
                await notificationService.sendWhatsapp(
                    loan.borrowerPhone,
                    receipt.whatsappText,
                    {
                        borrowerId: loan.borrowerId,
                        loanId: loan.loanId,
                        recipient: loan.borrowerPhone,
                        title: `Payment Receipt: ₹${params.amount}`,
                        message: `Payment of ₹${params.amount} received on ${params.paymentDate} for Loan #${loan.loanAccountNumber}`,
                        triggerType: "PAYMENT_RECEIPT",
                    },
                );
            } catch (err: any) {
                logger.error("Failed to dispatch payment receipt WhatsApp", { error: err.message, loanId: params.loanId });
            }
        }

        // Email
        if (loan.borrowerEmail) {
            try {
                await notificationService.sendEmail(
                    {
                        to: loan.borrowerEmail,
                        subject: receipt.emailSubject,
                        html: receipt.emailHtml,
                        text: receipt.whatsappText,
                    },
                    {
                        borrowerId: loan.borrowerId,
                        loanId: loan.loanId,
                        recipient: loan.borrowerEmail,
                        title: `Payment Receipt: ₹${params.amount}`,
                        message: `Payment of ₹${params.amount} received on ${params.paymentDate} for Loan #${loan.loanAccountNumber}`,
                        triggerType: "PAYMENT_RECEIPT",
                    },
                );
            } catch (err: any) {
                logger.error("Failed to dispatch payment receipt Email", { error: err.message, loanId: params.loanId });
            }
        }
    } catch (error: any) {
        logger.error("Error in notifyPaymentReceipt", { err: error, loanId: params.loanId });
    }
}

/**
 * Fires an external loan disbursement confirmation (WhatsApp & Email) to the borrower.
 */
export async function notifyLoanDisbursement(loanId: string): Promise<void> {
    try {
        const loanData = await db
            .select({
                loanId: loans.id,
                loanAccountNumber: loans.loanAccountNumber,
                borrowerId: loans.borrowerId,
                sanctionedAmount: loans.sanctionedAmount,
                tenureMonths: loans.tenureMonths,
                borrowerName: borrowers.name,
                borrowerPhone: borrowers.phone,
                borrowerEmail: borrowers.email,
            })
            .from(loans)
            .innerJoin(borrowers, eq(loans.borrowerId, borrowers.id))
            .where(eq(loans.id, loanId))
            .limit(1);

        const loan = loanData[0];
        if (!loan) return;

        const snapshot = await getLoanSnapshot(loanId);
        const notice = buildDisbursementNotice({
            borrowerName: loan.borrowerName,
            loanAccountNumber: loan.loanAccountNumber,
            sanctionedAmount: loan.sanctionedAmount,
            disbursedAmount: snapshot.totalDisbursed > 0 ? snapshot.totalDisbursed : loan.sanctionedAmount,
            tenureMonths: loan.tenureMonths ?? undefined,
        });

        // WhatsApp
        if (loan.borrowerPhone) {
            try {
                await notificationService.sendWhatsapp(
                    loan.borrowerPhone,
                    notice.whatsappText,
                    {
                        borrowerId: loan.borrowerId,
                        loanId: loan.loanId,
                        recipient: loan.borrowerPhone,
                        title: `Loan Disbursed: #${loan.loanAccountNumber}`,
                        message: `Disbursement confirmed for Loan #${loan.loanAccountNumber}`,
                        triggerType: "DISBURSEMENT",
                    },
                );
            } catch (err: any) {
                logger.error("Failed to dispatch disbursement WhatsApp", { error: err.message, loanId });
            }
        }

        // Email
        if (loan.borrowerEmail) {
            try {
                await notificationService.sendEmail(
                    {
                        to: loan.borrowerEmail,
                        subject: notice.emailSubject,
                        html: notice.emailHtml,
                        text: notice.whatsappText,
                    },
                    {
                        borrowerId: loan.borrowerId,
                        loanId: loan.loanId,
                        recipient: loan.borrowerEmail,
                        title: `Loan Disbursed: #${loan.loanAccountNumber}`,
                        message: `Disbursement confirmed for Loan #${loan.loanAccountNumber}`,
                        triggerType: "DISBURSEMENT",
                    },
                );
            } catch (err: any) {
                logger.error("Failed to dispatch disbursement Email", { error: err.message, loanId });
            }
        }
    } catch (error: any) {
        logger.error("Error in notifyLoanDisbursement", { err: error, loanId });
    }
}

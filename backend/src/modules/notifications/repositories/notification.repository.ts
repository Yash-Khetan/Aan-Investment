import { eq, and, desc, count, sql, gte } from "drizzle-orm";
import { db } from "../../../db";
import { notifications, borrowers, loans, users } from "../../../db/schema";
import type { NotificationChannel, NotificationStatus, NotificationTriggerType } from "../types/notification.types";

export interface SaveNotificationInput {
    userId?: string;
    borrowerId?: string;
    loanId?: string;
    recipient?: string;
    title: string;
    message?: string;
    triggerType?: NotificationTriggerType;
    channel: NotificationChannel;
    status: NotificationStatus;
    link?: string;
}

export interface ListNotificationsQuery {
    page?: number;
    limit?: number;
    channel?: NotificationChannel;
    status?: NotificationStatus;
    triggerType?: string;
    borrowerId?: string;
    loanId?: string;
}

/** Persists a record of a dispatched notification (email, SMS, or WhatsApp) to the `notifications` table. */
export async function saveNotification(input: SaveNotificationInput): Promise<void> {
    await db.insert(notifications).values({
        userId: input.userId,
        borrowerId: input.borrowerId,
        loanId: input.loanId,
        recipient: input.recipient,
        title: input.title,
        message: input.message,
        triggerType: input.triggerType,
        channel: input.channel,
        status: input.status,
        link: input.link,
    });
}

export async function listNotifications(query: ListNotificationsQuery = {}) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (query.channel) {
        conditions.push(eq(notifications.channel, query.channel));
    }
    if (query.status) {
        conditions.push(eq(notifications.status, query.status));
    }
    if (query.triggerType) {
        conditions.push(eq(notifications.triggerType, query.triggerType));
    }
    if (query.borrowerId) {
        conditions.push(eq(notifications.borrowerId, query.borrowerId));
    }
    if (query.loanId) {
        conditions.push(eq(notifications.loanId, query.loanId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, totalResult] = await Promise.all([
        db
            .select({
                id: notifications.id,
                title: notifications.title,
                message: notifications.message,
                channel: notifications.channel,
                status: notifications.status,
                triggerType: notifications.triggerType,
                recipient: notifications.recipient,
                createdAt: notifications.createdAt,
                borrowerId: notifications.borrowerId,
                borrowerName: borrowers.name,
                borrowerPhone: borrowers.phone,
                borrowerEmail: borrowers.email,
                loanId: notifications.loanId,
                loanAccountNumber: loans.loanAccountNumber,
            })
            .from(notifications)
            .leftJoin(borrowers, eq(notifications.borrowerId, borrowers.id))
            .leftJoin(loans, eq(notifications.loanId, loans.id))
            .where(whereClause)
            .orderBy(desc(notifications.createdAt))
            .limit(limit)
            .offset(offset),

        db
            .select({ total: count() })
            .from(notifications)
            .where(whereClause),
    ]);

    const total = totalResult[0]?.total ?? 0;

    return {
        items: rows,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

export async function getNotificationStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalStats, todayStats] = await Promise.all([
        db
            .select({
                total: count(),
                success: count(sql`CASE WHEN ${notifications.status} = 'SUCCESS' THEN 1 END`),
                failed: count(sql`CASE WHEN ${notifications.status} = 'FAILED' THEN 1 END`),
                email: count(sql`CASE WHEN ${notifications.channel} = 'EMAIL' THEN 1 END`),
                whatsapp: count(sql`CASE WHEN ${notifications.channel} = 'WHATSAPP' THEN 1 END`),
            })
            .from(notifications),

        db
            .select({
                sentToday: count(),
            })
            .from(notifications)
            .where(gte(notifications.createdAt, today)),
    ]);

    const s = totalStats[0] ?? { total: 0, success: 0, failed: 0, email: 0, whatsapp: 0 };
    const successRate = s.total > 0 ? Math.round((Number(s.success) / Number(s.total)) * 100) : 100;

    return {
        total: Number(s.total),
        success: Number(s.success),
        failed: Number(s.failed),
        email: Number(s.email),
        whatsapp: Number(s.whatsapp),
        sentToday: Number(todayStats[0]?.sentToday ?? 0),
        successRate,
    };
}

/** Check if a notification for this loan & trigger has already been dispatched today (idempotency guard). */
export async function hasNotificationBeenSentToday(
    loanId: string,
    triggerType: NotificationTriggerType,
    channel: NotificationChannel,
): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
            and(
                eq(notifications.loanId, loanId),
                eq(notifications.triggerType, triggerType),
                eq(notifications.channel, channel),
                gte(notifications.createdAt, today),
                eq(notifications.status, "SUCCESS"),
            ),
        )
        .limit(1);

    return rows.length > 0;
}

/** Returns the latest notification dispatched for this borrower to warn if one was sent recently. */
export async function getLatestBorrowerNotification(borrowerId: string) {
    const rows = await db
        .select({
            id: notifications.id,
            title: notifications.title,
            channel: notifications.channel,
            createdAt: notifications.createdAt,
            triggerType: notifications.triggerType,
        })
        .from(notifications)
        .where(eq(notifications.borrowerId, borrowerId))
        .orderBy(desc(notifications.createdAt))
        .limit(1);

    return rows[0] || null;
}

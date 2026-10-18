import type { RequestHandler } from "express";
import {
    listNotifications,
    getNotificationStats,
    getLatestBorrowerNotification,
} from "./repositories/notification.repository";
import { notificationService } from "./services/notification.service";
import { runDailyNotificationSweep } from "./services/scheduler.service";
import { db, borrowers, loans } from "../../db";
import { eq } from "drizzle-orm";
import { renderEmailLayout } from "./templates/email-layout";

export const getNotifications: RequestHandler = async (req, res) => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
    const channel = req.query.channel as any;
    const status = req.query.status as any;
    const triggerType = req.query.triggerType as string;
    const borrowerId = req.query.borrowerId as string;
    const loanId = req.query.loanId as string;

    const result = await listNotifications({
        page,
        limit,
        channel,
        status,
        triggerType,
        borrowerId,
        loanId,
    });

    res.status(200).json({ success: true, data: result });
};

export const getStats: RequestHandler = async (_req, res) => {
    const stats = await getNotificationStats();
    res.status(200).json({ success: true, data: stats });
};

export const getBorrowerRecentNotification: RequestHandler = async (req, res) => {
    const borrowerId = req.params.borrowerId;
    if (!borrowerId || typeof borrowerId !== "string") {
        res.status(400).json({ success: false, error: { message: "borrowerId is required" } });
        return;
    }
    const recent = await getLatestBorrowerNotification(borrowerId);
    res.status(200).json({ success: true, data: { recent } });
};

export const sendManualNotification: RequestHandler = async (req, res) => {
    const { borrowerId, loanId, channel, recipient, subject, message, title } = req.body;

    if (!recipient || !message || !channel) {
        res.status(400).json({
            success: false,
            error: { message: "recipient, message, and channel (WHATSAPP or EMAIL) are required" },
        });
        return;
    }

    const notifTitle = title || (channel === "WHATSAPP" ? "Direct WhatsApp Message" : subject || "Notification from Aan Finance");

    const meta = {
        userId: (req as any).user?.id,
        borrowerId,
        loanId,
        recipient,
        title: notifTitle,
        message: message.slice(0, 500),
        triggerType: "MANUAL" as const,
    };

    try {
        if (channel === "WHATSAPP") {
            const result = await notificationService.sendWhatsapp(recipient, message, meta);
            res.status(200).json({
                success: true,
                data: { message: "WhatsApp message dispatched successfully", result },
            });
        } else if (channel === "EMAIL") {
            const html = renderEmailLayout({
                previewText: message.slice(0, 100),
                bodyHtml: `<p style="white-space:pre-wrap;margin:0 0 16px;">${message}</p>`,
            });

            const result = await notificationService.sendEmail(
                {
                    to: recipient,
                    subject: subject || "Notification from Aan Finance",
                    html,
                    text: message,
                },
                meta,
            );
            res.status(200).json({
                success: true,
                data: { message: "Email dispatched successfully", result },
            });
        } else {
            res.status(400).json({
                success: false,
                error: { message: `Unsupported channel: ${channel}` },
            });
        }
    } catch (err: any) {
        res.status(500).json({
            success: false,
            error: { message: err.message || "Failed to dispatch notification" },
        });
    }
};

export const triggerScheduledSweep: RequestHandler = async (_req, res) => {
    const result = await runDailyNotificationSweep();
    res.status(200).json({ success: true, data: result });
};

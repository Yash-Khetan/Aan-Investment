/**
 * Audit module — public surface.
 *
 * Audit is CROSS-CUTTING, not a business module. It knows nothing about loans,
 * borrowers, interest, repayments, payments, collections or documents, and it
 * must stay that way: every business module depends on audit, audit depends on
 * none of them. That one-way arrow is what makes it reusable forever.
 *
 * ── For a business module (Loan, Borrower, Interest, Repayment, Payment,
 *    Collection, Documents, …), the entire integration is:
 *
 *      import { auditService, AUDIT_ENTITY, type AuditContext } from "../audit";
 *
 *      // controller — capture the actor at the HTTP edge:
 *      const ctx: AuditContext = {
 *          userId: req.user?.id ?? null,
 *          ipAddress: req.ip ?? null,
 *          userAgent: req.headers["user-agent"] ?? null,
 *      };
 *      await paymentService.recordPayment(input, ctx);
 *
 *      // service — after the action has actually succeeded:
 *      await auditService.record({
 *          ...ctx,
 *          entityType: AUDIT_ENTITY.PAYMENT,   // or any string; it's a varchar
 *          entityId: payment.id,
 *          action: "CREATE",                   // CREATE | UPDATE | DELETE | LOGIN | LOGOUT
 *          previousValue: before,              // omit on CREATE
 *          newValue: after,                    // omit on DELETE
 *          description: "Payment received",    // optional
 *      });
 *
 * No new function, no new column and no change to this module is needed to add
 * a module. `record()` never throws, so it cannot break your flow.
 *
 * app.ts mounts `auditRouter`; everything else here is for other modules to use.
 * Internals (repository, controller, validators) stay private to the module.
 */
export { auditRouter } from "./audit.routes";
export { auditService, record, listMyLogs, getMyLogById } from "./audit.service";
export { AUDIT_ENTITY, AUDIT_ACTIONS } from "./audit.constants";
export type {
    AuditAction,
    AuditContext,
    AuditLogView,
    RecordAuditInput,
} from "./audit.types";

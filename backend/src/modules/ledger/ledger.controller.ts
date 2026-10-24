import type { Request, RequestHandler } from "express";
import { UnauthorizedError } from "../../common/errors";
import type { AuditActor } from "../audit";
import {
  deleteLedgerEntry,
  getLoanLedger,
  recordPaymentOrReceipt,
  getSettings,
  updateLedgerEntry,
} from "./ledger.service";
import { getDpdGrid } from "./dpd.service";
import { syncLoanStatusWithLedger } from "./loanStatus";
import { notifyPaymentReceipt } from "../notifications/services/event-notifications";
import type { EntryPatch } from "./entryRules";

/** Who is making the change and from where — recorded on the entry's audit trail entry. */
function auditActor(req: Request): AuditActor & { userId: string } {
  if (!req.user) throw new UnauthorizedError("Not authenticated");
  return { userId: req.user.id, ipAddress: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}

export const getLedger: RequestHandler = async (req, res, next) => {
  try {
    const { loanId } = req.valid!.params as { loanId: string };
    const ledger = await getLoanLedger(loanId);
    res.json({ success: true, data: ledger });
  } catch (err) {
    next(err);
  }
};

export const createEntry: RequestHandler = async (req, res, next) => {
  try {
    const { loanId } = req.valid!.params as { loanId: string };
    const body = req.valid!.body as {
      entryDate: string;
      vchType: "PAYMENT" | "RECEIPT";
      amount: number;
      narration?: string;
    };
    const entry = await recordPaymentOrReceipt({ loanId, ...body });
    // A receipt that clears the loan closes it; a disbursement on a closed loan reopens it.
    await syncLoanStatusWithLedger(loanId);

    // Fire payment receipt notification asynchronously to borrower
    if (body.vchType === "RECEIPT") {
      notifyPaymentReceipt({
        loanId,
        amount: body.amount,
        paymentDate: body.entryDate,
        receiptNumber: entry.id.slice(0, 8).toUpperCase(),
      }).catch(() => {});
    }

    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /:loanId/entries/:entryId — edit a hand-recorded Payment or Receipt.
 * A locked (imported) or system-posted entry is refused by the service, which
 * writes nothing on the way to that refusal.
 */
export const updateEntry: RequestHandler = async (req, res, next) => {
  try {
    const { loanId, entryId } = req.valid!.params as { loanId: string; entryId: string };
    const entry = await updateLedgerEntry({
      loanId,
      entryId,
      patch: req.valid!.body as EntryPatch,
      actor: auditActor(req),
    });
    // The edit can settle the loan or reopen it, exactly as recording one can.
    await syncLoanStatusWithLedger(loanId);

    res.json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
};

/** DELETE /:loanId/entries/:entryId — remove a hand-recorded Payment or Receipt. */
export const deleteEntry: RequestHandler = async (req, res, next) => {
  try {
    const { loanId, entryId } = req.valid!.params as { loanId: string; entryId: string };
    const entry = await deleteLedgerEntry({ loanId, entryId, actor: auditActor(req) });
    await syncLoanStatusWithLedger(loanId);

    res.json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
};

export const getLedgerSettings: RequestHandler = async (req, res, next) => {
  try {
    const { loanId } = req.valid!.params as { loanId: string };
    const settings = await getSettings(loanId);
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
};

export const getDpdHistory: RequestHandler = async (req, res, next) => {
  try {
    const { loanId } = req.valid!.params as { loanId: string };
    const grid = await getDpdGrid(loanId);
    res.json({ success: true, data: grid });
  } catch (err) {
    next(err);
  }
};

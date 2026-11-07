import type { RequestHandler } from "express";
import { actorFrom } from "../../common/http/actor";
import {
  getLoanLedger,
  getSettings,
  requestDeleteLedgerEntry,
  requestRecordPaymentOrReceipt,
  requestUpdateLedgerEntry,
} from "./ledger.service";
import { getDpdGrid } from "./dpd.service";
import { notifyPaymentReceipt } from "../notifications/services/event-notifications";
import type { EntryPatch } from "./entryRules";

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
    const result = await requestRecordPaymentOrReceipt({ loanId, ...body }, actorFrom(req));

    // Only fire the borrower notification once the entry has actually been
    // posted — an employee's request pending approval has not moved any
    // money yet.
    if (result.entry && body.vchType === "RECEIPT") {
      notifyPaymentReceipt({
        loanId,
        amount: body.amount,
        paymentDate: body.entryDate,
        receiptNumber: result.entry.id.slice(0, 8).toUpperCase(),
      }).catch(() => {});
    }

    res.status(201).json({ success: true, data: result });
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
    const result = await requestUpdateLedgerEntry(loanId, entryId, req.valid!.body as EntryPatch, actorFrom(req));
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/** DELETE /:loanId/entries/:entryId — remove a hand-recorded Payment or Receipt. */
export const deleteEntry: RequestHandler = async (req, res, next) => {
  try {
    const { loanId, entryId } = req.valid!.params as { loanId: string; entryId: string };
    const result = await requestDeleteLedgerEntry(loanId, entryId, actorFrom(req));
    res.json({ success: true, data: result });
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

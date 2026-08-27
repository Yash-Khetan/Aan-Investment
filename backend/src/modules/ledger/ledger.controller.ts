import type { RequestHandler } from "express";
import {
  getLoanLedger,
  recordPaymentOrReceipt,
  editJournalEntryRate,
  getSettings,
  updateLedgerSettings,
} from "./ledger.service";

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
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
};

export const editRate: RequestHandler = async (req, res, next) => {
  try {
    const { loanId, entryId } = req.valid!.params as { loanId: string; entryId: string };
    const { ratePercent } = req.valid!.body as { ratePercent: number };
    await editJournalEntryRate(entryId, ratePercent);
    const ledger = await getLoanLedger(loanId);
    res.json({ success: true, data: ledger });
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

export const putLedgerSettings: RequestHandler = async (req, res, next) => {
  try {
    const { loanId } = req.valid!.params as { loanId: string };
    const body = req.valid!.body as { defaultInterestRatePercent: number; defaultTdsRatePercent: number };
    const settings = await updateLedgerSettings(loanId, body);
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
};

import type { RequestHandler } from "express";
import {
  getBorrowerLedger,
  recordPaymentOrReceipt,
  editJournalEntryRate,
  getSettings,
  updateLedgerSettings,
} from "./borrowerLedger.service";

export const getLedger: RequestHandler = async (req, res, next) => {
  try {
    const { borrowerId } = req.valid!.params as { borrowerId: string };
    const ledger = await getBorrowerLedger(borrowerId);
    res.json({ success: true, data: ledger });
  } catch (err) {
    next(err);
  }
};

export const createEntry: RequestHandler = async (req, res, next) => {
  try {
    const { borrowerId } = req.valid!.params as { borrowerId: string };
    const body = req.valid!.body as {
      entryDate: string;
      vchType: "PAYMENT" | "RECEIPT";
      amount: number;
      narration?: string;
    };
    const entry = await recordPaymentOrReceipt({ borrowerId, ...body });
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
};

export const editRate: RequestHandler = async (req, res, next) => {
  try {
    const { borrowerId, entryId } = req.valid!.params as { borrowerId: string; entryId: string };
    const { ratePercent } = req.valid!.body as { ratePercent: number };
    await editJournalEntryRate(entryId, ratePercent);
    const ledger = await getBorrowerLedger(borrowerId);
    res.json({ success: true, data: ledger });
  } catch (err) {
    next(err);
  }
};

export const getLedgerSettings: RequestHandler = async (req, res, next) => {
  try {
    const { borrowerId } = req.valid!.params as { borrowerId: string };
    const settings = await getSettings(borrowerId);
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
};

export const putLedgerSettings: RequestHandler = async (req, res, next) => {
  try {
    const { borrowerId } = req.valid!.params as { borrowerId: string };
    const body = req.valid!.body as { defaultInterestRatePercent: number; defaultTdsRatePercent: number };
    const settings = await updateLedgerSettings(borrowerId, body);
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
};

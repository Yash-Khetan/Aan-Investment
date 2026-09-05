import type { RequestHandler } from "express";
import { getLoanLedger, recordPaymentOrReceipt, getSettings } from "./ledger.service";

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

export const getLedgerSettings: RequestHandler = async (req, res, next) => {
  try {
    const { loanId } = req.valid!.params as { loanId: string };
    const settings = await getSettings(loanId);
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
};

import type { RequestHandler } from "express";
import { recordDisbursement, recordWriteOff, getLoanLedger } from "./accounting.service";

export const createDisbursementEntry: RequestHandler = async (req, res, next) => {
  try {
    const body = req.valid!.body as { loanId: string; amount: number; entryDate: string };
    const entry = await recordDisbursement(body.loanId, body.amount, body.entryDate);
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
};

export const createWriteOffEntry: RequestHandler = async (req, res, next) => {
  try {
    const body = req.valid!.body as { loanId: string; amount: number; entryDate: string };
    const entry = await recordWriteOff(body.loanId, body.amount, body.entryDate);
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
};

export const getLedger: RequestHandler = async (req, res, next) => {
  try {
    const { loanId } = req.valid!.params as { loanId: string };
    const entries = await getLoanLedger(loanId);
    res.json({ success: true, data: entries });
  } catch (err) {
    next(err);
  }
};
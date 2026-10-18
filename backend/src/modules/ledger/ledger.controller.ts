import type { RequestHandler } from "express";
import { getLoanLedger, recordPaymentOrReceipt, getSettings } from "./ledger.service";
import { getDpdGrid } from "./dpd.service";
import { syncLoanStatusWithLedger } from "./loanStatus";
import { notifyPaymentReceipt } from "../notifications/services/event-notifications";

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

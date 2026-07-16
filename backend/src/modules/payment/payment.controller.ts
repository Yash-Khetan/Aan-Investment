import type { RequestHandler } from "express";
import { getLoanPaymentHistory, recordPayment } from "./payment.service";

export const createPayment: RequestHandler = async (req, res, next) => {
  try {
    const body = req.valid!.body as {
      loanId: string;
      paymentRefNumber: string;
      amount: number;
      paymentDate: string;
      paymentMode: string;
      transactionRef?: string;
      receivedBy?: string;
      remarks?: string;
      installmentId?: string;
      outstandingPenalty: number;
      outstandingInterest: number;
      outstandingPrincipal: number;
      autoApplyOverflow?: boolean;
    };

    const result = await recordPayment(body);

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const listPayments: RequestHandler = async (req, res, next) => {
  try {
    const { loanId } = req.valid!.params as { loanId: string };
    const payments = await getLoanPaymentHistory(loanId);
    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
};
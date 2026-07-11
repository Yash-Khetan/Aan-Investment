import type { RequestHandler } from "express";
import { recordPayment } from "./payment.service";

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
    };

    const result = await recordPayment(body);

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
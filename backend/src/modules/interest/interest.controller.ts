import type { RequestHandler } from "express";
import { NotFoundError } from "../../common/errors";
import { createInterestConfigRevision, getCurrentInterestConfig } from "./interest.repository";
import { calculateInterestForLoan } from "./interest.service";

export const createInterestConfig: RequestHandler = async (req, res, next) => {
  try {
    const body = req.valid!.body as {
      loanId: string;
      annualRate: number;
      interestBasis: string;
      ruleType?: string;
      effectiveFrom: string;
      remarks?: string;
    };

    const created = await createInterestConfigRevision({
      loanId: body.loanId,
      annualRate: String(body.annualRate),
      interestBasis: body.interestBasis,
      ruleType: body.ruleType,
      effectiveFrom: body.effectiveFrom,
      remarks: body.remarks,
    });

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

export const getInterestConfig: RequestHandler = async (req, res, next) => {
  try {
    const { loanId } = req.valid!.params as { loanId: string };

    const config = await getCurrentInterestConfig(loanId);
    if (!config) {
      throw new NotFoundError(`No current interest config found for loan ${loanId}`);
    }

    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
};

export const calculateInterest: RequestHandler = async (req, res, next) => {
  try {
    const { loanId } = req.valid!.params as { loanId: string };
    const body = req.valid!.body as {
      asOfDate: string;
      loanDisbursementDate: string;
      outstandingPrincipal: number;
      overdueInstallmentAmount: number;
      daysLate: number;
      wasExtended: boolean;
      installments: { id: string; dueDate: string; status: any }[];
    };

    const result = await calculateInterestForLoan({
      loanId,
      asOfDate: new Date(body.asOfDate),
      loanDisbursementDate: new Date(body.loanDisbursementDate),
      outstandingPrincipal: body.outstandingPrincipal,
      overdueInstallmentAmount: body.overdueInstallmentAmount,
      daysLate: body.daysLate,
      wasExtended: body.wasExtended,
      installments: body.installments.map((i) => ({
        ...i,
        dueDate: new Date(i.dueDate),
      })),
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
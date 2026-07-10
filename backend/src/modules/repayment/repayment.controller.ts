import type { RequestHandler } from "express";
import { NotFoundError } from "../../common/errors";
import { generateAndSaveSchedule, getCurrentScheduleWithInstallments } from "./repayment.service";

export const generateSchedule: RequestHandler = async (req, res, next) => {
  try {
    const body = req.valid!.body as {
      loanId: string;
      principal: number;
      annualRate: number;
      tenureMonths: number;
      moratoriumMonths: number;
      disbursementDate: string;
      repaymentType: string;
      remarks?: string;
    };

    const schedule = await generateAndSaveSchedule(
      {
        loanId: body.loanId,
        principal: body.principal,
        annualRate: body.annualRate,
        tenureMonths: body.tenureMonths,
        moratoriumMonths: body.moratoriumMonths,
        disbursementDate: new Date(body.disbursementDate),
        repaymentType: body.repaymentType as any,
      },
      body.remarks
    );

    res.status(201).json({ success: true, data: schedule });
  } catch (err) {
    next(err);
  }
};

export const getSchedule: RequestHandler = async (req, res, next) => {
  try {
    const { loanId } = req.valid!.params as { loanId: string };

    const result = await getCurrentScheduleWithInstallments(loanId);
    if (!result) {
      throw new NotFoundError(`No current repayment schedule found for loan ${loanId}`);
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
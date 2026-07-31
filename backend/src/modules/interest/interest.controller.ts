import type { RequestHandler } from "express";
import { NotFoundError } from "../../common/errors";
import { calculateInterestForLoan } from "./interest.service";
import { syncRepaymentSchedule } from "../repayment/repayment.service";

import { createInterestConfigRevision, getCurrentInterestConfig, createInterestRule, deleteInterestRule, createPenalRule, getPenalRulesForLoan, getInterestRulesForConfig } from "./interest.repository";

export const createInterestConfig: RequestHandler = async (req, res, next) => {
  try {
    const body = req.valid!.body as {
      loanId: string;
      annualRate: number;
      interestBasis: string;
      ruleType?: string;
      effectiveFrom: string;
      remarks?: string;
      customFormula?: string;
      includeOpeningClosingDays?: boolean;
      calculationMethod?: string;
    };

    const created = await createInterestConfigRevision({
      loanId: body.loanId,
      annualRate: String(body.annualRate),
      interestBasis: body.interestBasis,
      ruleType: body.ruleType,
      effectiveFrom: body.effectiveFrom,
      remarks: body.remarks,
      customFormula: body.customFormula,
      includeOpeningClosingDays: body.includeOpeningClosingDays,
      calculationMethod: body.calculationMethod,
    });

    // A new/changed interest config directly affects the repayment schedule's
    // interest math — keep it in sync (auto-regenerates if nothing's been
    // paid yet, otherwise leaves it for the operator to confirm).
    await syncRepaymentSchedule(body.loanId);

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

export const createRule: RequestHandler = async (req, res, next) => {
  try {
    const body = req.valid!.body as {
      interestConfigId: string;
      fromMonth?: number;
      toMonth?: number;
      rate: number;
      triggerEvent?: string;
      remarks?: string;
    };

    const rule = await createInterestRule({
      interestConfigId: body.interestConfigId,
      fromMonth: body.fromMonth,
      toMonth: body.toMonth,
      rate: String(body.rate),
      triggerEvent: body.triggerEvent,
      remarks: body.remarks,
    });

    res.status(201).json({ success: true, data: rule });
  } catch (err) {
    next(err);
  }
};

export const removeRule: RequestHandler = async (req, res, next) => {
  try {
    const { ruleId } = req.valid!.params as { ruleId: string };
    await deleteInterestRule(ruleId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const createPenalty: RequestHandler = async (req, res, next) => {
  try {
    const body = req.valid!.body as {
      loanId: string;
      penalType: string;
      penalRate?: number;
      penalAmount?: number;
      penalBase?: string;
      gracePeriodDays?: number;
      remarks?: string;
    };

    const rule = await createPenalRule({
      loanId: body.loanId,
      penalType: body.penalType,
      penalRate: body.penalRate !== undefined ? String(body.penalRate) : undefined,
      penalAmount: body.penalAmount !== undefined ? String(body.penalAmount) : undefined,
      penalBase: body.penalBase,
      gracePeriodDays: body.gracePeriodDays,
      remarks: body.remarks,
    });

    res.status(201).json({ success: true, data: rule });
  } catch (err) {
    next(err);
  }
};


export const listRules: RequestHandler = async (req, res, next) => {
  try {
    const { configId } = req.valid!.params as { configId: string };
    const rules = await getInterestRulesForConfig(configId);
    res.json({ success: true, data: rules });
  } catch (err) {
    next(err);
  }
};

export const listPenalRules: RequestHandler = async (req, res, next) => {
  try {
    const { loanId } = req.valid!.params as { loanId: string };
    const rules = await getPenalRulesForLoan(loanId);
    res.json({ success: true, data: rules });
  } catch (err) {
    next(err);
  }
};
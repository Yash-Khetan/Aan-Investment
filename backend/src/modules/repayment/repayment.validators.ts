import { z } from "zod";

// Every scheduling input (principal, rate, tenure, disbursement date, repayment
// type) is now derived entirely from the loan + its interest config — see
// repayment.service.ts's buildScheduleInput. The only thing the operator can
// still provide is an optional remark.
export const generateScheduleSchema = z.object({
  loanId: z.string().uuid(),
  remarks: z.string().optional(),
});

export const loanIdParamSchema = z.object({
  loanId: z.string().uuid(),
});

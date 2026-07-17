import { z } from "zod";

const paymentModeValues = [
  "NEFT", "RTGS", "IMPS", "UPI", "CHEQUE", "CASH", "BANK_TRANSFER", "OTHER",
] as const;

export const recordPaymentSchema = z.object({
  loanId: z.string().uuid(),
  paymentRefNumber: z.string().min(1),
  amount: z.coerce.number().positive(),
  paymentDate: z.string().date(),
  paymentMode: z.enum(paymentModeValues),
  transactionRef: z.string().optional(),
  receivedBy: z.string().uuid().optional(),
  remarks: z.string().optional(),
  installmentId: z.string().uuid().optional(),
  outstandingPenalty: z.coerce.number().nonnegative().default(0),
  outstandingInterest: z.coerce.number().nonnegative().default(0),
  outstandingPrincipal: z.coerce.number().nonnegative(),
  autoApplyOverflow: z.boolean().optional().default(false),
});

export const loanIdParamSchema = z.object({
  loanId: z.string().uuid(),
});
import { NotFoundError } from "../../common/errors/AppError";
import { db } from "../../db/index";
import { recordDisbursement as postDisbursementJournalEntry } from "../accounting/accounting.service";
import * as disbursementRepository from "./disbursement.repository";
import type { CreateDisbursementInput, LoanTranche } from "./disbursement.types";

/**
 * Disbursement business layer. A "disbursement" is a tranche drawn down
 * against a loan — Sr. No. (tranche number), date, and amount. Recording one
 * here is the single place this happens: it appends the tranche, rolls the
 * amount into the loan's running `disbursedAmount`/`firstDisbursementDate`,
 * and posts the matching DISBURSEMENT journal entry so the accounting ledger
 * stays in sync automatically (previously a separate manual step).
 */

const assertLoanExists = async (loanId: string): Promise<void> => {
    if (!(await disbursementRepository.loanExists(loanId))) {
        throw new NotFoundError(`Loan '${loanId}' not found`);
    }
};

export const listDisbursementsForLoan = async (
    loanId: string,
): Promise<LoanTranche[]> => {
    await assertLoanExists(loanId);
    return disbursementRepository.listByLoan(loanId);
};

export const recordDisbursement = async (
    loanId: string,
    input: CreateDisbursementInput,
): Promise<LoanTranche> => {
    const loan = await disbursementRepository.findLoanById(loanId);
    if (!loan) throw new NotFoundError(`Loan '${loanId}' not found`);

    const tranche = await db.transaction(async (tx) => {
        const trancheNumber = (await disbursementRepository.countByLoan(loanId, tx)) + 1;

        const created = await disbursementRepository.create(
            {
                loanId,
                trancheNumber,
                amount: input.amount.toFixed(2),
                disbursementDate: input.disbursementDate,
                remarks: input.remarks,
            },
            tx,
        );

        const newDisbursedAmount = (Number(loan.disbursedAmount) || 0) + input.amount;
        await disbursementRepository.patchLoanDisbursedAmount(
            loanId,
            {
                disbursedAmount: newDisbursedAmount.toFixed(2),
                firstDisbursementDate: loan.firstDisbursementDate ?? input.disbursementDate,
            },
            tx,
        );

        return created;
    });

    await postDisbursementJournalEntry(loanId, input.amount, input.disbursementDate);

    return tranche;
};

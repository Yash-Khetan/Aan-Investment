import { BadRequestError, NotFoundError } from "../../common/errors/AppError";
import * as guarantorRepository from "./guarantor.repository";
import type {
    CreateGuarantorInput,
    Guarantor,
    NewGuarantor,
    UpdateGuarantorInput,
} from "./guarantor.types";

/**
 * Guarantor business layer. Owns all rules and orchestration; delegates every
 * DB operation to the repository. Controllers must not touch the repository.
 * Guarantors are always scoped to (and only ever managed through) a loan.
 */

const num = (value: number | undefined): string | undefined =>
    value === undefined ? undefined : value.toString();

/** Ensure the referenced loan exists. */
const assertLoanExists = async (loanId: string): Promise<void> => {
    if (!(await guarantorRepository.loanExists(loanId))) {
        throw new BadRequestError("loanId does not reference an existing loan", {
            field: "loanId",
        });
    }
};

/** Fetch a guarantor and confirm it belongs to the given loan. */
const getOwnedGuarantor = async (
    loanId: string,
    id: string,
): Promise<Guarantor> => {
    const guarantor = await guarantorRepository.findById(id);
    if (!guarantor || guarantor.loanId !== loanId) {
        throw new NotFoundError(`Guarantor '${id}' not found for this loan`);
    }
    return guarantor;
};

export const createGuarantor = async (
    loanId: string,
    input: CreateGuarantorInput,
): Promise<Guarantor> => {
    await assertLoanExists(loanId);

    const values: NewGuarantor = {
        loanId,
        name: input.name,
        guaranteeType: input.guaranteeType,
    };

    if (input.pan !== undefined) values.pan = input.pan;
    if (input.phone !== undefined) values.phone = input.phone;
    if (input.email !== undefined) values.email = input.email;
    if (input.addressLine1 !== undefined) values.addressLine1 = input.addressLine1;
    if (input.city !== undefined) values.city = input.city;
    if (input.state !== undefined) values.state = input.state;
    if (input.pincode !== undefined) values.pincode = input.pincode;
    if (input.netWorth !== undefined) values.netWorth = num(input.netWorth);

    return guarantorRepository.create(values);
};

export const listGuarantorsForLoan = async (
    loanId: string,
): Promise<Guarantor[]> => {
    await assertLoanExists(loanId);
    return guarantorRepository.findAllByLoanId(loanId);
};

export const getGuarantorById = async (
    loanId: string,
    id: string,
): Promise<Guarantor> => getOwnedGuarantor(loanId, id);

export const updateGuarantor = async (
    loanId: string,
    id: string,
    input: UpdateGuarantorInput,
): Promise<Guarantor> => {
    await getOwnedGuarantor(loanId, id);

    const patch: Partial<NewGuarantor> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.guaranteeType !== undefined) patch.guaranteeType = input.guaranteeType;
    if ("pan" in input) patch.pan = input.pan ?? null;
    if ("phone" in input) patch.phone = input.phone ?? null;
    if ("email" in input) patch.email = input.email ?? null;
    if ("addressLine1" in input) patch.addressLine1 = input.addressLine1 ?? null;
    if ("city" in input) patch.city = input.city ?? null;
    if ("state" in input) patch.state = input.state ?? null;
    if ("pincode" in input) patch.pincode = input.pincode ?? null;
    if ("netWorth" in input)
        patch.netWorth = input.netWorth !== null ? num(input.netWorth) : null;

    const updated = await guarantorRepository.update(id, patch);
    if (!updated) throw new NotFoundError(`Guarantor '${id}' not found`);
    return updated;
};

export const deleteGuarantor = async (
    loanId: string,
    id: string,
): Promise<void> => {
    await getOwnedGuarantor(loanId, id);

    const deleted = await guarantorRepository.softDelete(id);
    if (!deleted) throw new NotFoundError(`Guarantor '${id}' not found`);
};

import { BadRequestError, NotFoundError } from "../../common/errors/AppError";
import * as promoterRepository from "./promoter.repository";
import type {
    CreatePromoterInput,
    NewPromoter,
    Promoter,
    UpdatePromoterInput,
} from "./borrower.types";

/**
 * Related-person (promoter) business layer. Owns all rules and orchestration;
 * delegates every DB operation to the repository. Controllers must not touch
 * the repository.
 *
 * Related persons are the CIBIL commercial sheet's "Related Person" block, so
 * they are always scoped to — and only ever managed through — a COMMERCIAL
 * borrower.
 */

const num = (value: number | undefined): string | undefined =>
    value === undefined ? undefined : value.toString();

/** Ensure the borrower exists and is one that may hold related persons. */
const assertCommercialBorrower = async (borrowerId: string): Promise<void> => {
    const borrowerType = await promoterRepository.findBorrowerType(borrowerId);
    if (!borrowerType) {
        throw new NotFoundError(`Borrower '${borrowerId}' not found`);
    }
    if (borrowerType !== "COMMERCIAL") {
        throw new BadRequestError(
            "Related persons apply only to COMMERCIAL borrowers",
            { field: "borrowerId" },
        );
    }
};

/** Fetch a related person and confirm it belongs to the given borrower. */
const getOwnedPromoter = async (
    borrowerId: string,
    id: string,
): Promise<Promoter> => {
    const promoter = await promoterRepository.findById(id);
    if (!promoter || promoter.borrowerId !== borrowerId) {
        throw new NotFoundError(
            `Related person '${id}' not found for this borrower`,
        );
    }
    return promoter;
};

export const createPromoter = async (
    borrowerId: string,
    input: CreatePromoterInput,
): Promise<Promoter> => {
    await assertCommercialBorrower(borrowerId);

    const values: NewPromoter = { borrowerId, name: input.name };

    if (input.designation !== undefined) values.designation = input.designation;
    if (input.gender !== undefined) values.gender = input.gender;
    if (input.relatedPersonType !== undefined)
        values.relatedPersonType = input.relatedPersonType;
    if (input.relationship !== undefined) values.relationship = input.relationship;
    if (input.dateOfBirth !== undefined) values.dateOfBirth = input.dateOfBirth;
    if (input.pan !== undefined) values.pan = input.pan;
    if (input.aadhar !== undefined) values.aadhar = input.aadhar;
    if (input.din !== undefined) values.din = input.din;
    if (input.phone !== undefined) values.phone = input.phone;
    if (input.email !== undefined) values.email = input.email;
    if (input.addressLine1 !== undefined) values.addressLine1 = input.addressLine1;
    if (input.city !== undefined) values.city = input.city;
    if (input.district !== undefined) values.district = input.district;
    if (input.state !== undefined) values.state = input.state;
    if (input.pincode !== undefined) values.pincode = input.pincode;
    if (input.shareholdingPercent !== undefined)
        values.shareholdingPercent = num(input.shareholdingPercent);

    return promoterRepository.create(values);
};

export const listPromotersForBorrower = async (
    borrowerId: string,
): Promise<Promoter[]> => {
    await assertCommercialBorrower(borrowerId);
    return promoterRepository.findAllByBorrowerId(borrowerId);
};

export const getPromoterById = async (
    borrowerId: string,
    id: string,
): Promise<Promoter> => getOwnedPromoter(borrowerId, id);

export const updatePromoter = async (
    borrowerId: string,
    id: string,
    input: UpdatePromoterInput,
): Promise<Promoter> => {
    await assertCommercialBorrower(borrowerId);
    await getOwnedPromoter(borrowerId, id);

    const patch: Partial<NewPromoter> = {};
    if (input.name !== undefined) patch.name = input.name;
    if ("designation" in input) patch.designation = input.designation ?? null;
    if ("gender" in input) patch.gender = input.gender ?? null;
    if ("relatedPersonType" in input)
        patch.relatedPersonType = input.relatedPersonType ?? null;
    if ("relationship" in input) patch.relationship = input.relationship ?? null;
    if ("dateOfBirth" in input) patch.dateOfBirth = input.dateOfBirth ?? null;
    if ("pan" in input) patch.pan = input.pan ?? null;
    if ("aadhar" in input) patch.aadhar = input.aadhar ?? null;
    if ("din" in input) patch.din = input.din ?? null;
    if ("phone" in input) patch.phone = input.phone ?? null;
    if ("email" in input) patch.email = input.email ?? null;
    if ("addressLine1" in input) patch.addressLine1 = input.addressLine1 ?? null;
    if ("city" in input) patch.city = input.city ?? null;
    if ("district" in input) patch.district = input.district ?? null;
    if ("state" in input) patch.state = input.state ?? null;
    if ("pincode" in input) patch.pincode = input.pincode ?? null;
    if ("shareholdingPercent" in input)
        patch.shareholdingPercent =
            input.shareholdingPercent !== null && input.shareholdingPercent !== undefined
                ? num(input.shareholdingPercent)
                : null;

    const updated = await promoterRepository.update(id, patch);
    if (!updated) throw new NotFoundError(`Related person '${id}' not found`);
    return updated;
};

export const deletePromoter = async (
    borrowerId: string,
    id: string,
): Promise<void> => {
    await assertCommercialBorrower(borrowerId);
    await getOwnedPromoter(borrowerId, id);

    const deleted = await promoterRepository.softDelete(id);
    if (!deleted) throw new NotFoundError(`Related person '${id}' not found`);
};

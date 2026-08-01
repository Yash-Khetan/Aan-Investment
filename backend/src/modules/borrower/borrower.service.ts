import {
    BadRequestError,
    ConflictError,
    NotFoundError,
} from "../../common/errors/AppError";
import {
    buildPaginationMeta,
    type PaginatedResult,
} from "../../common/http/pagination";
import type { PaginationMeta } from "../../common/http/apiResponse";
import * as borrowerRepository from "./borrower.repository";
import type {
    BorrowerDetail,
    BorrowerWithManager,
    CreateBorrowerInput,
    ListBorrowersQuery,
    NewBorrower,
    NewPromoter,
    UpdateBorrowerInput,
} from "./borrower.types";

/**
 * Borrower business layer. Owns all rules and orchestration; delegates every DB
 * operation to the repository. Controllers must not touch the repository.
 */

const num = (value: number | undefined): string | undefined =>
    value === undefined ? undefined : value.toString();

/** Ensure the borrower code is not already taken by another borrower. */
const assertBorrowerCodeUnique = async (
    borrowerCode: string,
    excludeId?: string,
): Promise<void> => {
    if (await borrowerRepository.existsByBorrowerCode(borrowerCode, excludeId)) {
        throw new ConflictError(
            `A borrower with code '${borrowerCode}' already exists`,
            { field: "borrowerCode" },
        );
    }
};

/** Ensure the referenced relationship manager (user) exists, when provided. */
const assertRelationshipManagerExists = async (
    userId: string,
): Promise<void> => {
    if (!(await borrowerRepository.userExists(userId))) {
        throw new BadRequestError(
            "relationshipManagerId does not reference an existing user",
            { field: "relationshipManagerId" },
        );
    }
};

const mapPromoters = (
    input: CreateBorrowerInput["promoters"],
): Omit<NewPromoter, "borrowerId">[] =>
    (input ?? []).map((p) => {
        const row: Omit<NewPromoter, "borrowerId"> = { name: p.name };
        if (p.designation !== undefined) row.designation = p.designation;
        if (p.gender !== undefined) row.gender = p.gender;
        if (p.relatedPersonType !== undefined)
            row.relatedPersonType = p.relatedPersonType;
        if (p.relationship !== undefined) row.relationship = p.relationship;
        if (p.dateOfBirth !== undefined) row.dateOfBirth = p.dateOfBirth;
        if (p.pan !== undefined) row.pan = p.pan;
        if (p.aadhar !== undefined) row.aadhar = p.aadhar;
        if (p.din !== undefined) row.din = p.din;
        if (p.phone !== undefined) row.phone = p.phone;
        if (p.email !== undefined) row.email = p.email;
        if (p.addressLine1 !== undefined) row.addressLine1 = p.addressLine1;
        if (p.city !== undefined) row.city = p.city;
        if (p.district !== undefined) row.district = p.district;
        if (p.state !== undefined) row.state = p.state;
        if (p.pincode !== undefined) row.pincode = p.pincode;
        if (p.shareholdingPercent !== undefined)
            row.shareholdingPercent = num(p.shareholdingPercent);
        return row;
    });

export const createBorrower = async (
    input: CreateBorrowerInput,
): Promise<BorrowerDetail> => {
    await assertBorrowerCodeUnique(input.borrowerCode);
    if (input.relationshipManagerId) {
        await assertRelationshipManagerExists(input.relationshipManagerId);
    }

    const values: NewBorrower = {
        borrowerType: input.borrowerType,
        borrowerCode: input.borrowerCode,
        name: input.name,
        constitution: input.constitution,
    };

    if (input.groupName !== undefined) values.groupName = input.groupName;
    if (input.email !== undefined) values.email = input.email;
    if (input.phone !== undefined) values.phone = input.phone;
    if (input.alternatePhone !== undefined)
        values.alternatePhone = input.alternatePhone;
    if (input.addressLine1 !== undefined) values.addressLine1 = input.addressLine1;
    if (input.addressLine2 !== undefined) values.addressLine2 = input.addressLine2;
    if (input.city !== undefined) values.city = input.city;
    if (input.district !== undefined) values.district = input.district;
    if (input.state !== undefined) values.state = input.state;
    if (input.pincode !== undefined) values.pincode = input.pincode;
    if (input.pan !== undefined) values.pan = input.pan;
    if (input.gst !== undefined) values.gst = input.gst;
    if (input.cin !== undefined) values.cin = input.cin;
    if (input.aadhaar !== undefined) values.aadhaar = input.aadhaar;
    if (input.dateOfIncorporation !== undefined)
        values.dateOfIncorporation = input.dateOfIncorporation;
    if (input.natureOfBusiness !== undefined)
        values.natureOfBusiness = input.natureOfBusiness;

    /* CIBIL consumer fields */
    if (input.gender !== undefined) values.gender = input.gender;
    if (input.dateOfBirth !== undefined) values.dateOfBirth = input.dateOfBirth;
    if (input.addressCategory !== undefined)
        values.addressCategory = input.addressCategory;
    if (input.residenceCode !== undefined)
        values.residenceCode = input.residenceCode;
    if (input.ownershipIndicator !== undefined)
        values.ownershipIndicator = input.ownershipIndicator;
    if (input.ckycNumber !== undefined) values.ckycNumber = input.ckycNumber;

    /* CIBIL commercial fields */
    if (input.businessCategory !== undefined)
        values.businessCategory = input.businessCategory;
    if (input.businessType !== undefined)
        values.businessType = input.businessType;
    if (input.classOfActivity1 !== undefined)
        values.classOfActivity1 = input.classOfActivity1;
    if (input.applicantType !== undefined)
        values.applicantType = input.applicantType;

    if (input.internalRating !== undefined)
        values.internalRating = input.internalRating;
    if (input.ratingRemarks !== undefined)
        values.ratingRemarks = input.ratingRemarks;
    if (input.relationshipManagerId !== undefined)
        values.relationshipManagerId = input.relationshipManagerId;
    if (input.status !== undefined) values.status = input.status;
    if (input.notes !== undefined) values.notes = input.notes;

    return borrowerRepository.create(values, {
        promoters: mapPromoters(input.promoters),
    });
};

export const getBorrowerById = async (
    id: string,
): Promise<BorrowerDetail> => {
    const borrower = await borrowerRepository.findById(id);
    if (!borrower) throw new NotFoundError(`Borrower '${id}' not found`);
    return borrower;
};

export const listBorrowers = async (
    query: ListBorrowersQuery,
): Promise<{ data: BorrowerWithManager[]; meta: PaginationMeta }> => {
    const { rows, total }: PaginatedResult<BorrowerWithManager> =
        await borrowerRepository.findAll(query);
    return {
        data: rows,
        meta: buildPaginationMeta(query.page, query.limit, total),
    };
};

export const updateBorrower = async (
    id: string,
    input: UpdateBorrowerInput,
): Promise<BorrowerDetail> => {
    const existing = await borrowerRepository.findById(id);
    if (!existing) throw new NotFoundError(`Borrower '${id}' not found`);

    if (
        input.borrowerCode !== undefined &&
        input.borrowerCode !== existing.borrowerCode
    ) {
        await assertBorrowerCodeUnique(input.borrowerCode, id);
    }
    if (input.relationshipManagerId) {
        await assertRelationshipManagerExists(input.relationshipManagerId);
    }

    const patch: Partial<NewBorrower> = {};
    if (input.borrowerType !== undefined) patch.borrowerType = input.borrowerType;
    if (input.borrowerCode !== undefined) patch.borrowerCode = input.borrowerCode;
    if (input.name !== undefined) patch.name = input.name;
    if ("groupName" in input) patch.groupName = input.groupName ?? null;
    if (input.constitution !== undefined) patch.constitution = input.constitution;
    if ("email" in input) patch.email = input.email ?? null;
    if ("phone" in input) patch.phone = input.phone ?? null;
    if ("alternatePhone" in input)
        patch.alternatePhone = input.alternatePhone ?? null;
    if ("addressLine1" in input) patch.addressLine1 = input.addressLine1 ?? null;
    if ("addressLine2" in input) patch.addressLine2 = input.addressLine2 ?? null;
    if ("city" in input) patch.city = input.city ?? null;
    if ("district" in input) patch.district = input.district ?? null;
    if ("state" in input) patch.state = input.state ?? null;
    if ("pincode" in input) patch.pincode = input.pincode ?? null;
    if ("pan" in input) patch.pan = input.pan ?? null;
    if ("gst" in input) patch.gst = input.gst ?? null;
    if ("cin" in input) patch.cin = input.cin ?? null;
    if ("aadhaar" in input) patch.aadhaar = input.aadhaar ?? null;
    if ("dateOfIncorporation" in input)
        patch.dateOfIncorporation = input.dateOfIncorporation ?? null;
    if ("natureOfBusiness" in input)
        patch.natureOfBusiness = input.natureOfBusiness ?? null;

    /* CIBIL consumer fields */
    if ("gender" in input) patch.gender = input.gender ?? null;
    if ("dateOfBirth" in input) patch.dateOfBirth = input.dateOfBirth ?? null;
    if ("addressCategory" in input)
        patch.addressCategory = input.addressCategory ?? null;
    if ("residenceCode" in input)
        patch.residenceCode = input.residenceCode ?? null;
    if ("ownershipIndicator" in input)
        patch.ownershipIndicator = input.ownershipIndicator ?? null;
    if ("ckycNumber" in input) patch.ckycNumber = input.ckycNumber ?? null;

    /* CIBIL commercial fields */
    if ("businessCategory" in input)
        patch.businessCategory = input.businessCategory ?? null;
    if ("businessType" in input) patch.businessType = input.businessType ?? null;
    if ("classOfActivity1" in input)
        patch.classOfActivity1 = input.classOfActivity1 ?? null;
    if ("applicantType" in input)
        patch.applicantType = input.applicantType ?? null;

    if ("internalRating" in input)
        patch.internalRating = input.internalRating ?? null;
    if ("ratingRemarks" in input)
        patch.ratingRemarks = input.ratingRemarks ?? null;
    if ("relationshipManagerId" in input)
        patch.relationshipManagerId = input.relationshipManagerId ?? null;
    if (input.status !== undefined) patch.status = input.status;
    if ("notes" in input) patch.notes = input.notes ?? null;

    const updated = await borrowerRepository.update(id, patch);
    if (!updated) throw new NotFoundError(`Borrower '${id}' not found`);
    return updated;
};

export const deleteBorrower = async (id: string): Promise<void> => {
    const deleted = await borrowerRepository.softDelete(id);
    if (!deleted) throw new NotFoundError(`Borrower '${id}' not found`);
};

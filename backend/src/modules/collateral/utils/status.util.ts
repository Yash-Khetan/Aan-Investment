import type { CollateralStatus } from "../types/collateral.types";
import { isPastDate } from "./date.util";

export function isActiveStatus(status: CollateralStatus | null | undefined): boolean {
    return status === "ACTIVE";
}

export function isInactiveStatus(status: CollateralStatus | null | undefined): boolean {
    return status === "INACTIVE";
}

export type InsuranceHealth = "VALID" | "EXPIRING_SOON" | "EXPIRED" | "UNKNOWN";

const EXPIRING_SOON_WINDOW_DAYS = 30;

/** Classifies an insurance policy's health from its expiry date, for dashboards/alerts. */
export function getInsuranceHealth(expiryDate: string | Date | null | undefined): InsuranceHealth {
    if (!expiryDate) {
        return "UNKNOWN";
    }

    if (isPastDate(expiryDate)) {
        return "EXPIRED";
    }

    const soonThreshold = new Date();
    soonThreshold.setDate(soonThreshold.getDate() + EXPIRING_SOON_WINDOW_DAYS);

    return isPastDate(expiryDate, soonThreshold) ? "EXPIRING_SOON" : "VALID";
}

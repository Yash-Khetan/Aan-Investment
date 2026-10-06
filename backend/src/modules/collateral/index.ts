/**
 * Public surface of the collateral module. Other parts of the application
 * should import only from this file, never from internal folders directly.
 */

export { collateralRouter } from "./routes/collateral.routes";
export { CollateralService } from "./services/collateral.service";

export type {
    CollateralType,
    CollateralStatus,
    CreateCollateralInput,
    UpdateCollateralInput,
    UpdateValuationInput,
    UpdateInsuranceInput,
    CollateralRecord,
    InsuranceRecord,
    LtvResult,
} from "./types/collateral.types";

export {
    CollateralError,
    CollateralNotFoundError,
    LoanNotFoundError,
    InvalidCollateralTypeError,
    ValidationError,
    DuplicateCollateralError,
    LtvCalculationError,
    CollateralPersistenceError,
} from "./utils/errors";

export { calculateLtv } from "./utils/ltv.util";
export { getInsuranceHealth, isActiveStatus, isInactiveStatus } from "./utils/status.util";
export { formatDate, isPastDate, isValidDateString } from "./utils/date.util";

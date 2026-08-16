import { Card } from "../../../components/ui/Card";
import { SelectField } from "../../../components/ui/Field";
import { BORROWER_TYPES, BORROWER_TYPE_LABELS, clearFieldsForOtherType } from "../types";
import type { BorrowerFormState, BorrowerType } from "../types";
import { CommercialBorrowerFields } from "./CommercialBorrowerFields";
import { ConsumerBorrowerFields } from "./ConsumerBorrowerFields";
import { SectionTitle } from "./borrowerFormShared";

export { PHONE_PATTERN, PHONE_TITLE } from "./borrowerFormShared";

/**
 * Borrower master-data fields shared by the create and edit pages.
 *
 * Borrower Type sits at the top and decides which CIBIL field set is rendered
 * beneath it — Consumer for individuals, Commercial for companies, LLPs,
 * partnership firms and the like. Both render inline on this same page; there
 * is no separate route or window.
 *
 * Each side collects exactly its sheet's columns and nothing else. Columns the
 * borrower record still carries but neither sheet lists (group name, internal
 * rating, remarks, GSTIN, CIN) are left untouched: they round-trip through form
 * state on save, so no stored value is lost, they are simply not edited here.
 *
 * Related persons are handled separately (create only — the backend has no
 * update endpoint for them yet). Guarantors now belong to loans, not borrowers.
 */
export function BorrowerMasterFields({
  form,
  onChange,
  showStatus,
}: {
  form: BorrowerFormState;
  onChange: (patch: Partial<BorrowerFormState>) => void;
  showStatus?: boolean;
}) {
  /**
   * Switching type drops whatever the other sheet had filled in, so a half-typed
   * Commercial record cannot leak into a Consumer submission. Consumers are
   * individuals by definition, so their constitution is pinned rather than asked.
   */
  function handleBorrowerTypeChange(borrowerType: BorrowerType) {
    const next = clearFieldsForOtherType({ ...form, borrowerType });
    onChange({
      ...next,
      constitution: borrowerType === "CONSUMER" ? "INDIVIDUAL" : next.constitution,
    });
  }

  return (
    <>
      <Card className="p-4">
        <SectionTitle>Borrower Type</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField
            label="Borrower Type"
            value={form.borrowerType}
            onChange={(e) => handleBorrowerTypeChange(e.target.value as BorrowerType)}
            required
          >
            {BORROWER_TYPES.map((t) => (
              <option key={t} value={t}>
                {BORROWER_TYPE_LABELS[t]}
              </option>
            ))}
          </SelectField>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Determines which CIBIL field set is captured below. Changing it clears the fields that do not apply.
        </p>
      </Card>

      {form.borrowerType === "CONSUMER" ? (
        <ConsumerBorrowerFields form={form} onChange={onChange} showStatus={showStatus} />
      ) : (
        <CommercialBorrowerFields form={form} onChange={onChange} showStatus={showStatus} />
      )}
    </>
  );
}

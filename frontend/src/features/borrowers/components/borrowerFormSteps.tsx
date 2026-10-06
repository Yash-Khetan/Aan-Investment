import type { ReactNode } from "react";
import type { FormStep } from "../../../components/ui/StepForm";
import { BorrowerMasterFields } from "./BorrowerMasterFields";
import type { BorrowerFormSection } from "./ConsumerBorrowerFields";
import type { BorrowerFormState } from "../types";

/**
 * The borrower form, one step per part — shared by the create and edit pages.
 * `relatedPersons`, when given, is added as a last step for commercial
 * borrowers (consumers have none).
 */
export function borrowerFormSteps(
  form: BorrowerFormState,
  onChange: (patch: Partial<BorrowerFormState>) => void,
  opts: { showStatus?: boolean; relatedPersons?: ReactNode } = {},
): FormStep[] {
  const isConsumer = form.borrowerType === "CONSUMER";
  const part = (section: BorrowerFormSection) => (
    <BorrowerMasterFields form={form} onChange={onChange} showStatus={opts.showStatus} section={section} />
  );

  const steps: FormStep[] = [
    {
      key: "basic",
      title: isConsumer ? "Personal details" : "Business details",
      description: "The type of borrower decides which details are asked for.",
      content: part("basic"),
    },
    {
      key: "identity",
      title: "Identity",
      description: isConsumer ? "PAN, Aadhaar and CKYC, with a scan of each." : "PAN and other registration numbers.",
      content: part("identity"),
    },
    { key: "contact", title: "Contact", description: "How to reach the borrower.", content: part("contact") },
    {
      key: "address",
      title: isConsumer ? "Address" : "Registered address",
      content: part("address"),
    },
  ];

  if (!isConsumer && opts.relatedPersons) {
    steps.push({
      key: "related",
      title: "Related persons",
      description: "Promoters, directors, partners and shareholders. Optional.",
      content: opts.relatedPersons,
    });
  }

  return steps;
}

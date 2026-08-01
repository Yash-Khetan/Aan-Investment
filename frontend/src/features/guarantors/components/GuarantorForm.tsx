import { useState } from "react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/Field";
import { useAuth } from "../../auth/AuthContext";
import { useAutosaveDraft, loadDraft } from "../../../hooks/useAutosaveDraft";
import type { CreateGuarantorInput, Guarantor, UpdateGuarantorInput } from "../types";

/** Matches the backend's Indian-mobile format (an optional +91 prefix, then a 10-digit number starting 6-9). */
const PHONE_PATTERN = "^(\\+91[- ]?)?[6-9][0-9]{9}$";
const PHONE_TITLE = "Enter a valid 10-digit Indian mobile number, e.g. 9876543210 or +91 9876543210";

interface FormValues {
  name: string;
  guaranteeType: string;
  pan: string;
  phone: string;
  email: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
  netWorth: string;
}

const EMPTY: FormValues = {
  name: "",
  guaranteeType: "",
  pan: "",
  phone: "",
  email: "",
  addressLine1: "",
  city: "",
  state: "",
  pincode: "",
  netWorth: "",
};

function guarantorToFormValues(g: Guarantor): FormValues {
  return {
    name: g.name,
    guaranteeType: g.guaranteeType,
    pan: g.pan ?? "",
    phone: g.phone ?? "",
    email: g.email ?? "",
    addressLine1: g.addressLine1 ?? "",
    city: g.city ?? "",
    state: g.state ?? "",
    pincode: g.pincode ?? "",
    netWorth: g.netWorth ?? "",
  };
}

/**
 * Add/edit form for a single guarantor. Used both to create a new guarantor
 * against a loan and to edit an existing one in place — `initial` distinguishes
 * the two modes and `submitLabel` reflects it in the UI.
 */
export function GuarantorForm({
  initial,
  submitLabel,
  isSubmitting,
  error,
  onSubmit,
  onCancel,
  draftKey,
}: {
  initial?: Guarantor;
  submitLabel: string;
  isSubmitting: boolean;
  error?: unknown;
  onSubmit: (input: CreateGuarantorInput | UpdateGuarantorInput) => void;
  onCancel: () => void;
  /** When set, autosaves this form's in-progress values to localStorage every 30s (used for the "add new" flow, not row-edit). */
  draftKey?: string;
}) {
  const { status } = useAuth();
  const [form, setForm] = useState<FormValues>(() => {
    if (initial) return guarantorToFormValues(initial);
    return (draftKey && loadDraft<FormValues>(draftKey)) || EMPTY;
  });

  useAutosaveDraft(draftKey ?? "", form, !!draftKey && status === "authenticated");

  function patch(p: Partial<FormValues>) {
    setForm((f) => ({ ...f, ...p }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name: form.name,
      guaranteeType: form.guaranteeType,
      pan: form.pan || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      addressLine1: form.addressLine1 || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      pincode: form.pincode || undefined,
      netWorth: form.netWorth ? Number(form.netWorth) : undefined,
    });
  }

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextField label="Name" value={form.name} onChange={(e) => patch({ name: e.target.value })} required />
          <TextField
            label="Guarantee Type"
            value={form.guaranteeType}
            onChange={(e) => patch({ guaranteeType: e.target.value })}
            placeholder="PERSONAL / CORPORATE"
            required
          />
          <TextField label="PAN" value={form.pan} onChange={(e) => patch({ pan: e.target.value.toUpperCase() })} />
          <TextField
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={(e) => patch({ phone: e.target.value })}
            pattern={PHONE_PATTERN}
            title={PHONE_TITLE}
          />
          <TextField label="Email" type="email" value={form.email} onChange={(e) => patch({ email: e.target.value })} />
          <TextField label="Address" value={form.addressLine1} onChange={(e) => patch({ addressLine1: e.target.value })} />
          <TextField label="City" value={form.city} onChange={(e) => patch({ city: e.target.value })} />
          <TextField label="State" value={form.state} onChange={(e) => patch({ state: e.target.value })} />
          <TextField label="Pincode" value={form.pincode} onChange={(e) => patch({ pincode: e.target.value })} />
          <TextField
            label="Net Worth (INR)"
            type="number"
            min="0"
            value={form.netWorth}
            onChange={(e) => patch({ netWorth: e.target.value })}
          />
        </div>

        {error !== undefined && error !== null && (
          <div className="text-xs text-red-600">
            {error instanceof Error ? error.message : "Failed to save guarantor."}
          </div>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : submitLabel}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

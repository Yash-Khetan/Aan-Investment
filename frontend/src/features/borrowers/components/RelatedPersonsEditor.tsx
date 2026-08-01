import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { SelectField, TextField } from "../../../components/ui/Field";
import { FormErrors } from "../../../components/ui/FormErrors";
import { LoadingState } from "../../../components/ui/States";
import {
  createPromoter,
  deletePromoter,
  listPromoters,
  updatePromoter,
} from "../api";
import {
  GENDERS,
  RELATED_PERSON_RELATIONSHIPS,
  RELATED_PERSON_TYPES,
  promoterToCreateInput,
  promoterToUpdateInput,
  todayIso,
} from "../types";
import type { Promoter } from "../types";
import { ChooseOption, PHONE_PATTERN, PHONE_TITLE, SectionTitle } from "./borrowerFormShared";

const BLANK: Promoter = { name: "", pan: "", phone: "" };

/**
 * Add, edit and remove a commercial borrower's related persons after the
 * borrower already exists. Each row is saved individually against the nested
 * `/borrowers/:id/promoters` endpoints, so one bad row cannot block the others.
 */
export function RelatedPersonsEditor({ borrowerId }: { borrowerId: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Promoter | null>(null);
  const [editing, setEditing] = useState<Record<string, Promoter>>({});

  const { data: promoters, isLoading } = useQuery({
    queryKey: ["promoters", borrowerId],
    queryFn: () => listPromoters(borrowerId),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["promoters", borrowerId] });
    queryClient.invalidateQueries({ queryKey: ["borrower", borrowerId] });
  };

  const addMutation = useMutation({
    mutationFn: (p: Promoter) => createPromoter(borrowerId, promoterToCreateInput(p)),
    onSuccess: () => { setDraft(null); refresh(); },
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, p }: { id: string; p: Promoter }) =>
      updatePromoter(borrowerId, id, promoterToUpdateInput(p)),
    onSuccess: (_data, vars) => {
      setEditing((rows) => {
        const next = { ...rows };
        delete next[vars.id];
        return next;
      });
      refresh();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deletePromoter(borrowerId, id),
    onSuccess: refresh,
  });

  const busy = addMutation.isPending || saveMutation.isPending || removeMutation.isPending;
  const error = addMutation.error ?? saveMutation.error ?? removeMutation.error;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle>Related Persons</SectionTitle>
        {!draft && (
          <Button type="button" variant="secondary" onClick={() => setDraft({ ...BLANK })}>
            + Add Related Person
          </Button>
        )}
      </div>

      {isLoading && <LoadingState label="Loading related persons..." />}
      {!isLoading && (promoters?.length ?? 0) === 0 && !draft && (
        <p className="text-sm text-slate-400">No related persons added.</p>
      )}

      <div className="flex flex-col gap-3">
        {promoters?.map((p) => {
          const row = editing[p.id!];
          return row ? (
            <PromoterFields
              key={p.id}
              value={row}
              onChange={(patch) => setEditing((rows) => ({ ...rows, [p.id!]: { ...rows[p.id!]!, ...patch } }))}
              disabled={busy}
              actions={
                <>
                  <Button type="button" onClick={() => saveMutation.mutate({ id: p.id!, p: row })} disabled={busy}>
                    {saveMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      setEditing((rows) => {
                        const next = { ...rows };
                        delete next[p.id!];
                        return next;
                      })
                    }
                  >
                    Cancel
                  </Button>
                </>
              }
            />
          ) : (
            <div key={p.id} className="flex items-start justify-between gap-3 rounded-md border border-slate-100 p-3">
              <div className="text-sm">
                <div className="font-medium text-slate-800">{p.name}</div>
                <div className="mt-0.5 text-xs text-slate-400">
                  {[
                    RELATED_PERSON_RELATIONSHIPS.find((r) => r.value === p.relationship)?.label,
                    p.pan,
                    p.phone,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No further details"}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setEditing((rows) => ({ ...rows, [p.id!]: { ...p } }))}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Remove related person "${p.name}"?`)) removeMutation.mutate(p.id!);
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          );
        })}

        {draft && (
          <PromoterFields
            value={draft}
            onChange={(patch) => setDraft((d) => ({ ...d!, ...patch }))}
            disabled={busy}
            actions={
              <>
                <Button type="button" onClick={() => addMutation.mutate(draft)} disabled={busy || !draft.name.trim()}>
                  {addMutation.isPending ? "Adding..." : "Add"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setDraft(null)} disabled={busy}>
                  Cancel
                </Button>
              </>
            }
          />
        )}
      </div>

      {error && (
        <div className="mt-3">
          <FormErrors error={error} />
        </div>
      )}
    </Card>
  );
}

/** The CIBIL "Related Person" columns, laid out identically for add and edit. */
function PromoterFields({
  value,
  onChange,
  disabled,
  actions,
}: {
  value: Promoter;
  onChange: (patch: Partial<Promoter>) => void;
  disabled?: boolean;
  actions: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          label="Full Name"
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          disabled={disabled}
          required
        />
        <SelectField
          label="Gender"
          value={value.gender ?? ""}
          onChange={(e) => onChange({ gender: e.target.value })}
          disabled={disabled}
        >
          <ChooseOption label="Gender" />
          {GENDERS.map((g) => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </SelectField>
        <SelectField
          label="Related Type"
          value={value.relatedPersonType ?? ""}
          onChange={(e) => onChange({ relatedPersonType: e.target.value })}
          disabled={disabled}
        >
          <ChooseOption label="Related Type" />
          {RELATED_PERSON_TYPES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </SelectField>
        <SelectField
          label="Relationship"
          value={value.relationship ?? ""}
          onChange={(e) => onChange({ relationship: e.target.value })}
          disabled={disabled}
        >
          <ChooseOption label="Relationship" />
          {RELATED_PERSON_RELATIONSHIPS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </SelectField>
        <TextField
          label="Date of Birth"
          type="date"
          max={todayIso()}
          value={value.dateOfBirth ?? ""}
          onChange={(e) => onChange({ dateOfBirth: e.target.value })}
          disabled={disabled}
        />
        <TextField
          label="PAN"
          value={value.pan ?? ""}
          onChange={(e) => onChange({ pan: e.target.value.toUpperCase() })}
          disabled={disabled}
        />
        <TextField
          label="Address"
          value={value.addressLine1 ?? ""}
          onChange={(e) => onChange({ addressLine1: e.target.value })}
          disabled={disabled}
        />
        <TextField
          label="City"
          value={value.city ?? ""}
          onChange={(e) => onChange({ city: e.target.value })}
          disabled={disabled}
        />
        <TextField
          label="District"
          value={value.district ?? ""}
          onChange={(e) => onChange({ district: e.target.value })}
          disabled={disabled}
        />
        <TextField
          label="State"
          value={value.state ?? ""}
          onChange={(e) => onChange({ state: e.target.value })}
          disabled={disabled}
        />
        <TextField
          label="Pin Code"
          value={value.pincode ?? ""}
          onChange={(e) => onChange({ pincode: e.target.value })}
          disabled={disabled}
        />
        <TextField
          label="Mobile"
          type="tel"
          value={value.phone ?? ""}
          onChange={(e) => onChange({ phone: e.target.value })}
          pattern={PHONE_PATTERN}
          title={PHONE_TITLE}
          disabled={disabled}
        />
      </div>
      <div className="mt-3 flex gap-2">{actions}</div>
    </div>
  );
}

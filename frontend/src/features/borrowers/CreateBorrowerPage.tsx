import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/Layout";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/Field";
import { FormErrors } from "../../components/ui/FormErrors";
import { BorrowerMasterFields, PHONE_PATTERN, PHONE_TITLE } from "./components/BorrowerMasterFields";
import { createBorrower } from "./api";
import { uploadDocument } from "../documents/api";
import { EMPTY_BORROWER_FORM, formStateToCreateInput } from "./types";
import type { BorrowerFormState, Promoter } from "./types";

const emptyPromoter: Promoter = { name: "", designation: "", pan: "", phone: "", email: "" };

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>;
}

export function CreateBorrowerPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<BorrowerFormState>(EMPTY_BORROWER_FORM);
  const [promoters, setPromoters] = useState<Promoter[]>([]);
  const [panFile, setPanFile] = useState<File | null>(null);
  const [gstFile, setGstFile] = useState<File | null>(null);
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async (input: ReturnType<typeof formStateToCreateInput>) => {
      const borrower = await createBorrower(input);
      if (panFile) {
        await uploadDocument({ entityType: "BORROWER", entityId: borrower.id, documentType: "PAN_CARD", name: "PAN", file: panFile });
      }
      if (gstFile) {
        await uploadDocument({ entityType: "BORROWER", entityId: borrower.id, documentType: "GSTIN_CERTIFICATE", name: "GSTIN", file: gstFile });
      }
      if (aadhaarFile) {
        await uploadDocument({ entityType: "BORROWER", entityId: borrower.id, documentType: "AADHAAR", name: "Aadhaar", file: aadhaarFile });
      }
      return borrower;
    },
    onSuccess: (borrower) => navigate(`/borrowers`, { state: { createdId: borrower.id } }),
  });

  function patch(p: Partial<BorrowerFormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  function updatePromoter(index: number, patchVal: Partial<Promoter>) {
    setPromoters((rows) => rows.map((r, i) => (i === index ? { ...r, ...patchVal } : r)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate(formStateToCreateInput(form, promoters));
  }

  return (
    <div>
      <PageHeader title="New Borrower" description="Borrower master — identity, address, and internal details." />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <BorrowerMasterFields
          form={form}
          onChange={patch}
          panFile={panFile}
          onPanFileChange={setPanFile}
          gstFile={gstFile}
          onGstFileChange={setGstFile}
          aadhaarFile={aadhaarFile}
          onAadhaarFileChange={setAadhaarFile}
        />

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <SectionTitle>Promoters</SectionTitle>
            <Button type="button" variant="secondary" onClick={() => setPromoters((rows) => [...rows, { ...emptyPromoter }])}>
              + Add Promoter
            </Button>
          </div>
          {promoters.length === 0 && <p className="text-sm text-slate-400">No promoters added.</p>}
          <div className="flex flex-col gap-3">
            {promoters.map((p, i) => (
              <div key={i} className="grid grid-cols-1 gap-3 rounded-md border border-slate-100 p-3 sm:grid-cols-2 lg:grid-cols-4">
                <TextField label="Name" value={p.name} onChange={(e) => updatePromoter(i, { name: e.target.value })} required />
                <TextField
                  label="Designation"
                  value={p.designation ?? ""}
                  onChange={(e) => updatePromoter(i, { designation: e.target.value })}
                />
                <TextField label="PAN" value={p.pan ?? ""} onChange={(e) => updatePromoter(i, { pan: e.target.value.toUpperCase() })} />
                <TextField
                  label="Phone"
                  type="tel"
                  value={p.phone ?? ""}
                  onChange={(e) => updatePromoter(i, { phone: e.target.value })}
                  pattern={PHONE_PATTERN}
                  title={PHONE_TITLE}
                />
                <TextField
                  label="Email"
                  type="email"
                  value={p.email ?? ""}
                  onChange={(e) => updatePromoter(i, { email: e.target.value })}
                />
                <TextField
                  label="Shareholding %"
                  type="number"
                  min="0"
                  max="100"
                  value={p.shareholdingPercent ?? ""}
                  onChange={(e) => updatePromoter(i, { shareholdingPercent: e.target.value ? Number(e.target.value) : undefined })}
                />
                <div className="flex items-end">
                  <Button type="button" variant="ghost" onClick={() => setPromoters((rows) => rows.filter((_, idx) => idx !== i))}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {mutation.isError && <FormErrors error={mutation.error} />}

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Create Borrower"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate("/borrowers")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

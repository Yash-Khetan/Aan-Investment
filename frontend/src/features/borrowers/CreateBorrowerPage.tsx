import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/Layout";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { SelectField, TextField } from "../../components/ui/Field";
import { FormErrors } from "../../components/ui/FormErrors";
import { BorrowerMasterFields, PHONE_PATTERN, PHONE_TITLE } from "./components/BorrowerMasterFields";
import { ChooseOption } from "./components/borrowerFormShared";
import { createBorrower } from "./api";
import { listDocuments, uploadDocument } from "../documents/api";
import {
  BORROWER_DOCUMENT_LABELS,
  BorrowerDocumentsProvider,
  type BorrowerDocumentType,
  type PendingBorrowerFiles,
} from "./BorrowerDocumentsContext";
import { useAuth } from "../auth/AuthContext";
import { useAutosaveDraft, loadDraft, clearDraft } from "../../hooks/useAutosaveDraft";
import {
  EMPTY_BORROWER_FORM,
  GENDERS,
  RELATED_PERSON_RELATIONSHIPS,
  RELATED_PERSON_TYPES,
  formStateToCreateInput,
  todayIso,
} from "./types";
import type { BorrowerFormState, Promoter } from "./types";

/** A blank CIBIL "Related Person" row. */
const emptyPromoter: Promoter = { name: "", pan: "", phone: "" };

const DRAFT_KEY = "borrower:create";

interface BorrowerDraft {
  form: BorrowerFormState;
  promoters: Promoter[];
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>;
}

export function CreateBorrowerPage() {
  const navigate = useNavigate();
  const { status } = useAuth();
  const draft = loadDraft<BorrowerDraft>(DRAFT_KEY);

  const [form, setForm] = useState<BorrowerFormState>(draft?.form ?? EMPTY_BORROWER_FORM);
  const [promoters, setPromoters] = useState<Promoter[]>(draft?.promoters ?? []);

  // Deliberately NOT part of the autosaved draft: useAutosaveDraft JSON-serializes
  // to localStorage, and a File serializes to {}. Picked files are lost on reload,
  // which is correct - the bytes were never persisted anywhere.
  const [pendingFiles, setPendingFiles] = useState<PendingBorrowerFiles>({});

  // Set once the borrower row exists. From that point the identity fields switch
  // to edit mode (immediate upload), and submitting must not create a second borrower.
  const [createdBorrowerId, setCreatedBorrowerId] = useState<string | null>(null);
  const [failedUploads, setFailedUploads] = useState<string[]>([]);

  // Only fetched after creation, so successfully uploaded documents render as
  // attached rather than reverting to an empty picker.
  const { data: createdDocuments } = useQuery({
    queryKey: ["documents", "BORROWER", createdBorrowerId, "IDENTITY"],
    queryFn: () => listDocuments("BORROWER", createdBorrowerId!, "IDENTITY"),
    enabled: !!createdBorrowerId,
  });

  function setPendingFile(documentType: BorrowerDocumentType, file: File | null) {
    setPendingFiles((prev) => {
      const next = { ...prev };
      if (file) next[documentType] = file;
      else delete next[documentType];
      return next;
    });
  }

  useAutosaveDraft(DRAFT_KEY, { form, promoters }, status === "authenticated");

  /**
   * Uploads every held file against the freshly created borrower. Returns the
   * display names of the ones that failed - an empty array means all succeeded.
   * Uses allSettled so one failure cannot abandon the others.
   */
  async function uploadPendingFiles(borrowerId: string): Promise<string[]> {
    const entries = Object.entries(pendingFiles) as [BorrowerDocumentType, File][];
    if (entries.length === 0) return [];

    const results = await Promise.allSettled(
      entries.map(([documentType, file]) =>
        uploadDocument({
          entityType: "BORROWER",
          entityId: borrowerId,
          documentType,
          source: "IDENTITY",
          name: BORROWER_DOCUMENT_LABELS[documentType],
          file,
        }),
      ),
    );

    const failed: string[] = [];
    entries.forEach(([documentType], i) => {
      if (results[i].status === "fulfilled") setPendingFile(documentType, null);
      else failed.push(BORROWER_DOCUMENT_LABELS[documentType]);
    });

    return failed;
  }

  const mutation = useMutation({
    mutationFn: (input: ReturnType<typeof formStateToCreateInput>) => createBorrower(input),
    onSuccess: async (borrower) => {
      // Recorded before the uploads run: the borrower now exists, so a second
      // submit must never POST /borrowers again.
      setCreatedBorrowerId(borrower.id);

      const failed = await uploadPendingFiles(borrower.id);
      if (failed.length > 0) {
        // Stay put so the user can retry in place - the fields are in edit mode now.
        setFailedUploads(failed);
        return;
      }

      clearDraft(DRAFT_KEY);
      navigate(`/borrowers`, { state: { createdId: borrower.id } });
    },
  });

  function patch(p: Partial<BorrowerFormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  function updatePromoter(index: number, patchVal: Partial<Promoter>) {
    setPromoters((rows) => rows.map((r, i) => (i === index ? { ...r, ...patchVal } : r)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // The borrower was already created and only the uploads failed. Submitting
    // now means "I'm done retrying" - never "create another borrower".
    if (createdBorrowerId) {
      clearDraft(DRAFT_KEY);
      navigate(`/borrowers`, { state: { createdId: createdBorrowerId } });
      return;
    }

    mutation.mutate(formStateToCreateInput(form, promoters));
  }

  return (
    <div>
      <PageHeader title="New Borrower" description="Borrower master — identity, address, and internal details." />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <BorrowerDocumentsProvider
          borrowerId={createdBorrowerId ?? undefined}
          documents={createdDocuments}
          pendingFiles={pendingFiles}
          setPendingFile={setPendingFile}
        >
          <BorrowerMasterFields form={form} onChange={patch} />
        </BorrowerDocumentsProvider>

        {/* "Related Person" is a Commercial-sheet block — consumers have none. */}
        {form.borrowerType === "COMMERCIAL" && (
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle>Related Persons</SectionTitle>
              <Button type="button" variant="secondary" onClick={() => setPromoters((rows) => [...rows, { ...emptyPromoter }])}>
                + Add Related Person
              </Button>
            </div>
            {promoters.length === 0 && <p className="text-sm text-slate-400">No related persons added.</p>}
            <div className="flex flex-col gap-3">
              {promoters.map((p, i) => (
                <div key={i} className="grid grid-cols-1 gap-3 rounded-md border border-slate-100 p-3 sm:grid-cols-2 lg:grid-cols-4">
                  <TextField label="Full Name" value={p.name} onChange={(e) => updatePromoter(i, { name: e.target.value })} required />
                  <SelectField
                    label="Gender"
                    value={p.gender ?? ""}
                    onChange={(e) => updatePromoter(i, { gender: e.target.value || undefined })}
                  >
                    <ChooseOption label="Gender" />
                    {GENDERS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    label="Related Type"
                    value={p.relatedPersonType ?? ""}
                    onChange={(e) => updatePromoter(i, { relatedPersonType: e.target.value || undefined })}
                  >
                    <ChooseOption label="Related Type" />
                    {RELATED_PERSON_TYPES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    label="Relationship"
                    value={p.relationship ?? ""}
                    onChange={(e) => updatePromoter(i, { relationship: e.target.value || undefined })}
                  >
                    <ChooseOption label="Relationship" />
                    {RELATED_PERSON_RELATIONSHIPS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    label="Date of Birth"
                    type="date"
                    max={todayIso()}
                    value={p.dateOfBirth ?? ""}
                    onChange={(e) => updatePromoter(i, { dateOfBirth: e.target.value || undefined })}
                  />
                  <TextField label="PAN" value={p.pan ?? ""} onChange={(e) => updatePromoter(i, { pan: e.target.value.toUpperCase() })} />
                  <TextField
                    label="Address"
                    value={p.addressLine1 ?? ""}
                    onChange={(e) => updatePromoter(i, { addressLine1: e.target.value })}
                  />
                  <TextField label="City" value={p.city ?? ""} onChange={(e) => updatePromoter(i, { city: e.target.value })} />
                  <TextField label="District" value={p.district ?? ""} onChange={(e) => updatePromoter(i, { district: e.target.value })} />
                  <TextField label="State" value={p.state ?? ""} onChange={(e) => updatePromoter(i, { state: e.target.value })} />
                  <TextField label="Pin Code" value={p.pincode ?? ""} onChange={(e) => updatePromoter(i, { pincode: e.target.value })} />
                  <TextField
                    label="Mobile"
                    type="tel"
                    value={p.phone ?? ""}
                    onChange={(e) => updatePromoter(i, { phone: e.target.value })}
                    pattern={PHONE_PATTERN}
                    title={PHONE_TITLE}
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
        )}

        {mutation.isError && <FormErrors error={mutation.error} />}

        {failedUploads.length > 0 && (
          <Card className="border-amber-300 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">
              Borrower created, but {failedUploads.join(" and ")} failed to upload. Pick{" "}
              {failedUploads.length > 1 ? "those files" : "that file"} again above to retry &mdash; it uploads straight
              away now &mdash; then press Done.
            </p>
          </Card>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {createdBorrowerId ? "Done" : mutation.isPending ? "Saving..." : "Create Borrower"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate("/borrowers")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

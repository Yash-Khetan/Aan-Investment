import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/Layout";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { LoadingState, ErrorState } from "../../components/ui/States";
import { FormErrors } from "../../components/ui/FormErrors";
import { BorrowerMasterFields } from "./components/BorrowerMasterFields";
import { getBorrower, updateBorrower } from "./api";
import { EMPTY_BORROWER_FORM, borrowerToFormState, formStateToUpdateInput } from "./types";
import type { BorrowerFormState } from "./types";

export function EditBorrowerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<BorrowerFormState>(EMPTY_BORROWER_FORM);
  const [loaded, setLoaded] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["borrower", id],
    queryFn: () => getBorrower(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (data && !loaded) {
      setForm(borrowerToFormState(data));
      setLoaded(true);
    }
  }, [data, loaded]);

  const mutation = useMutation({
    mutationFn: () => updateBorrower(id!, formStateToUpdateInput(form)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrowers"] });
      queryClient.invalidateQueries({ queryKey: ["borrower", id] });
      navigate("/borrowers");
    },
  });

  function patch(p: Partial<BorrowerFormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <div>
      <PageHeader title="Edit Borrower" description="Update borrower master data." />

      {isLoading && <LoadingState label="Loading borrower..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Failed to load borrower."} />}

      {data && loaded && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <BorrowerMasterFields form={form} onChange={patch} showStatus />

          {(data.promoters.length > 0 || data.guarantors.length > 0) && (
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Promoters &amp; Guarantors
              </h2>
              <p className="mb-3 text-xs text-slate-400">Read-only here — editing these isn't supported yet.</p>
              <div className="flex flex-col gap-1.5 text-sm text-slate-700">
                {data.promoters.map((p) => (
                  <div key={p.id}>
                    <span className="text-slate-400">Promoter —</span> {p.name} {p.designation ? `(${p.designation})` : ""}
                  </div>
                ))}
                {data.guarantors.map((g) => (
                  <div key={g.id}>
                    <span className="text-slate-400">Guarantor —</span> {g.name} ({g.guaranteeType})
                  </div>
                ))}
              </div>
            </Card>
          )}

          {mutation.isError && <FormErrors error={mutation.error} />}

          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate("/borrowers")}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

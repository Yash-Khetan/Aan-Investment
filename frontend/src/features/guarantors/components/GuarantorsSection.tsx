import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { LoadingState, ErrorState } from "../../../components/ui/States";
import { listGuarantors, createGuarantor } from "../api";
import { GuarantorForm } from "./GuarantorForm";
import { GuarantorRow } from "./GuarantorRow";
import type { CreateGuarantorInput } from "../types";

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>;
}

/**
 * Guarantor(s) for a loan — list, add, edit, and remove. A guarantor only
 * ever exists against a loan (never a borrower), so this needs a persisted
 * `loanId` and is embedded in the create/edit loan pages once one exists.
 */
export function GuarantorsSection({ loanId }: { loanId: string }) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["guarantors", loanId],
    queryFn: () => listGuarantors(loanId),
    enabled: !!loanId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateGuarantorInput) => createGuarantor(loanId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guarantors", loanId] });
      setAdding(false);
    },
  });

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle>Guarantors</SectionTitle>
        {!adding && (
          <Button type="button" variant="secondary" onClick={() => setAdding(true)}>
            + Add Guarantor
          </Button>
        )}
      </div>

      {isLoading && <LoadingState label="Loading guarantors..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Failed to load guarantors."} />}

      {adding && (
        <div className="mb-3">
          <GuarantorForm
            submitLabel="Add Guarantor"
            isSubmitting={createMutation.isPending}
            error={createMutation.error}
            onSubmit={(input) => createMutation.mutate(input as CreateGuarantorInput)}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {data && data.length === 0 && !adding && <p className="text-sm text-slate-400">No guarantors added.</p>}

      <div className="flex flex-col gap-3">
        {data?.map((g) => (
          <GuarantorRow key={g.id} guarantor={g} loanId={loanId} />
        ))}
      </div>
    </Card>
  );
}

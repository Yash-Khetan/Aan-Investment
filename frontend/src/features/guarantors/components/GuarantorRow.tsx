import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { deleteGuarantor, updateGuarantor } from "../api";
import { GuarantorForm } from "./GuarantorForm";
import type { Guarantor, UpdateGuarantorInput } from "../types";

export function GuarantorRow({ guarantor, loanId }: { guarantor: Guarantor; loanId: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["guarantors", loanId] });

  const updateMutation = useMutation({
    mutationFn: (input: UpdateGuarantorInput) => updateGuarantor(loanId, guarantor.id, input),
    onSuccess: () => {
      invalidate();
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteGuarantor(loanId, guarantor.id),
    onSuccess: invalidate,
  });

  function handleDelete() {
    if (window.confirm(`Remove guarantor "${guarantor.name}" from this loan?`)) {
      deleteMutation.mutate();
    }
  }

  if (editing) {
    return (
      <GuarantorForm
        initial={guarantor}
        submitLabel="Save Guarantor"
        isSubmitting={updateMutation.isPending}
        error={updateMutation.error}
        onSubmit={(input) => updateMutation.mutate(input)}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-800">
            {guarantor.name} <span className="text-xs font-normal text-slate-500">({guarantor.guaranteeType})</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
            {guarantor.pan && <span>PAN: {guarantor.pan}</span>}
            {guarantor.phone && <span>Phone: {guarantor.phone}</span>}
            {guarantor.email && <span>Email: {guarantor.email}</span>}
            {guarantor.netWorth && <span>Net Worth: {guarantor.netWorth}</span>}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleteMutation.isPending}>
            Remove
          </Button>
        </div>
      </div>
    </Card>
  );
}

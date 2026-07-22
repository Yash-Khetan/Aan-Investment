import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { SelectField, TextField, TextAreaField } from "../../../components/ui/Field";
import { createActivity } from "../api";
import { ACTIVITY_TYPES } from "../types";

export function LogActivityForm({ loanId, onDone }: { loanId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [activityType, setActivityType] = useState<string>("CALL");
  const [contactPerson, setContactPerson] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [promiseDate, setPromiseDate] = useState("");
  const [promiseAmount, setPromiseAmount] = useState("");

  const mutation = useMutation({
    mutationFn: createActivity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections", loanId] });
      onDone();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      loanId,
      activityType,
      contactPerson: contactPerson || undefined,
      followUpDate: followUpDate || undefined,
      remarks: remarks || undefined,
      promiseDate: promiseDate || undefined,
      promiseAmount: promiseAmount ? Number(promiseAmount) : undefined,
    });
  }

  const needsPromise = activityType === "PROMISE_TO_PAY_CREATED";

  return (
    <Card className="mb-4 p-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField label="Activity Type" value={activityType} onChange={(e) => setActivityType(e.target.value)} required>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </SelectField>
          <TextField label="Contact Person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          <TextField label="Follow-up Date" type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
          {needsPromise && (
            <>
              <TextField label="Promise Date" type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} required />
              <TextField
                label="Promise Amount"
                type="number"
                min="0"
                value={promiseAmount}
                onChange={(e) => setPromiseAmount(e.target.value)}
                required
              />
            </>
          )}
        </div>
        <TextAreaField label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />

        {mutation.isError && (
          <div className="text-xs text-red-600">
            {mutation.error instanceof Error ? mutation.error.message : "Failed to log activity."}
          </div>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Log Activity"}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

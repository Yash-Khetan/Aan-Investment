import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/Layout";
import { Button } from "../../components/ui/Button";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { LoanSelect } from "../lookup/LoanSelect";
import { getLoanActivities } from "./api";
import { LogActivityForm } from "./components/LogActivityForm";
import { ActivityRow } from "./components/ActivityRow";

export function CollectionsPage() {
  const [loanId, setLoanId] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["collections", loanId],
    queryFn: () => getLoanActivities(loanId),
    enabled: loanId !== "",
  });

  const sorted = data ? [...data].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")) : [];

  return (
    <div>
      <PageHeader title="Collections" description="Recovery activity trail, follow-ups, and Promises to Pay." />

      <div className="mb-6 flex items-end gap-3">
        <div className="w-96">
          <LoanSelect value={loanId} onChange={setLoanId} />
        </div>
        {loanId && <Button onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "+ Log Activity"}</Button>}
      </div>

      {!loanId && <EmptyState message="Select a loan to view or log collection activity." />}

      {loanId && showForm && <LogActivityForm loanId={loanId} onDone={() => setShowForm(false)} />}

      {loanId && isLoading && <LoadingState label="Loading activity..." />}
      {loanId && isError && <ErrorState message={error instanceof Error ? error.message : "Failed to load activity."} />}
      {loanId && data && data.length === 0 && <EmptyState message="No collection activity logged for this loan yet." />}

      <div className="flex flex-col gap-3">
        {sorted.map((activity) => (
          <ActivityRow key={activity.id} activity={activity} loanId={loanId} />
        ))}
      </div>
    </div>
  );
}

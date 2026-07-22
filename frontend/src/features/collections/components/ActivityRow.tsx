import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { formatCurrency, formatDate } from "../../../lib/format";
import { closePromiseToPay } from "../api";
import type { CollectionActivityRecord } from "../types";

export function ActivityRow({ activity, loanId }: { activity: CollectionActivityRecord; loanId: string }) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["collections", loanId] });

  const closeMutation = useMutation({
    mutationFn: (kept: boolean) => closePromiseToPay(activity.id, kept),
    onSuccess: invalidate,
  });

  const hasOpenPromise = activity.promiseDate !== null && activity.promiseKept === null;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-800">{activity.activityType.replace(/_/g, " ")}</span>
            <Badge status={activity.status} />
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {formatDate(activity.followUpDate)} {activity.contactPerson && `· ${activity.contactPerson}`}
          </div>
          {activity.remarks && <div className="mt-2 text-sm text-slate-600">{activity.remarks}</div>}
          {activity.promiseDate && (
            <div className="mt-2 rounded bg-purple-50 px-2 py-1 text-xs text-purple-800">
              Promise: {formatCurrency(activity.promiseAmount)} by {formatDate(activity.promiseDate)}
              {activity.promiseKept === true && " — kept"}
              {activity.promiseKept === false && " — broken"}
            </div>
          )}
        </div>

        {hasOpenPromise && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => closeMutation.mutate(true)} disabled={closeMutation.isPending}>
              Mark Kept
            </Button>
            <Button variant="danger" onClick={() => closeMutation.mutate(false)} disabled={closeMutation.isPending}>
              Mark Broken
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

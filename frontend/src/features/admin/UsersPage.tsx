import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/Layout";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Table, type Column } from "../../components/ui/Table";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { activateUser, deactivateUser, listUsers } from "./api";
import type { PublicUser } from "../auth/types";

export function UsersPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: listUsers,
  });

  const activateMutation = useMutation({
    mutationFn: activateUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const toggling = activateMutation.isPending || deactivateMutation.isPending;

  const columns: Column<PublicUser>[] = [
    { key: "name", header: "Name", render: (u) => `${u.firstName} ${u.lastName ?? ""}`.trim() },
    { key: "email", header: "Email", render: (u) => u.email },
    { key: "roles", header: "Roles", render: (u) => u.roles.join(", ") },
    { key: "status", header: "Status", render: (u) => <Badge status={u.isActive ? "ACTIVE" : "INACTIVE"} /> },
    {
      key: "actions",
      header: "",
      render: (u) =>
        u.isActive ? (
          <Button variant="danger" disabled={toggling} onClick={() => deactivateMutation.mutate(u.id)}>
            Deactivate
          </Button>
        ) : (
          <Button variant="secondary" disabled={toggling} onClick={() => activateMutation.mutate(u.id)}>
            Activate
          </Button>
        ),
      className: "text-right",
    },
  ];

  return (
    <div>
      <PageHeader title="Users" description="Manage employee and admin accounts." />

      <div className="mb-6 flex justify-end">
        <Link to="/admin/users/new">
          <Button>+ New User</Button>
        </Link>
      </div>

      {isLoading && <LoadingState label="Loading users..." />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "Failed to load users."} />}
      {(activateMutation.isError || deactivateMutation.isError) && (
        <div className="mb-4">
          <ErrorState
            message={
              (activateMutation.error ?? deactivateMutation.error) instanceof Error
                ? ((activateMutation.error ?? deactivateMutation.error) as Error).message
                : "Failed to update user."
            }
          />
        </div>
      )}
      {data && data.length === 0 && <EmptyState message="No users yet." />}
      {data && data.length > 0 && <Table columns={columns} rows={data} rowKey={(u) => u.id} />}
    </div>
  );
}

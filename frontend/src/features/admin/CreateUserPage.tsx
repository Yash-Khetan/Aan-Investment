import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/Layout";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/Field";
import { FormErrors } from "../../components/ui/FormErrors";
import { createUser } from "./api";
import type { RegisterInput } from "../auth/types";

const EMPTY_FORM: RegisterInput = { firstName: "", lastName: "", email: "", password: "" };

export function CreateUserPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterInput>(EMPTY_FORM);

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => navigate("/admin/users"),
  });

  function patch(p: Partial<RegisterInput>) {
    setForm((f) => ({ ...f, ...p }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate(form);
  }

  return (
    <div>
      <PageHeader title="New User" description="Provision an account. New users get the default EMPLOYEE role." />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card className="p-4">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="First name" value={form.firstName} onChange={(e) => patch({ firstName: e.target.value })} required />
            <TextField label="Last name" value={form.lastName} onChange={(e) => patch({ lastName: e.target.value })} required />
            <TextField label="Email" type="email" value={form.email} onChange={(e) => patch({ email: e.target.value })} required />
            <TextField
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => patch({ password: e.target.value })}
              required
            />
          </div>
        </Card>

        {mutation.isError && <FormErrors error={mutation.error} />}

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Create User"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate("/admin/users")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

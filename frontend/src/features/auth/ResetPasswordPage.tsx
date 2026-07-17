import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/Field";
import { ErrorState, SuccessState } from "../../components/ui/States";
import { ApiError } from "../../lib/api";
import { resetPassword } from "./api";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("This reset link is invalid or missing a token.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await resetPassword({ token, newPassword });
      setMessage(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Aan Investment</div>
          <div className="text-lg font-semibold text-slate-900">Set a new password</div>
        </div>

        {message ? (
          <SuccessState message={message} />
        ) : !token ? (
          <ErrorState message="This reset link is invalid or missing a token. Please request a new one." />
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <TextField
                label="New password"
                type="password"
                required
                minLength={8}
                autoFocus
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-400">At least 8 characters, with a letter and a number.</p>
            </div>
            <TextField
              label="Confirm new password"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            {error && <ErrorState message={error} />}

            <Button type="submit" disabled={submitting} className="w-full justify-center">
              {submitting ? "Resetting..." : "Reset password"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">
          <Link to="/login" className="font-medium text-slate-900 hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}

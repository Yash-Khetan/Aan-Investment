import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/Field";
import { ErrorState, SuccessState } from "../../components/ui/States";
import { ApiError } from "../../lib/api";
import { forgotPassword } from "./api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await forgotPassword({ email });
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
          <div className="text-lg font-semibold text-slate-900">Reset your password</div>
          <p className="mt-2 text-xs text-slate-500">
            Enter your account email and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        {message ? (
          <SuccessState message={message} />
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <TextField
              label="Email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {error && <ErrorState message={error} />}

            <Button type="submit" disabled={submitting} className="w-full justify-center">
              {submitting ? "Sending..." : "Send reset link"}
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

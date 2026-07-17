import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/Field";
import { ErrorState, SuccessState } from "../../components/ui/States";
import { ApiError } from "../../lib/api";
import { useAuth } from "./AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const state = location.state as { from?: string; message?: string } | null;
  const from = state?.from ?? "/dashboard";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Aan Investment</div>
          <div className="text-lg font-semibold text-slate-900">Sign in to LMS</div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {state?.message && <SuccessState message={state.message} />}

          <TextField
            label="Email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div>
            <TextField
              label="Password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Link to="/forgot-password" className="mt-1.5 inline-block text-xs font-medium text-slate-500 hover:text-slate-700">
              Forgot password?
            </Link>
          </div>

          {error && <ErrorState message={error} />}

          <Button type="submit" disabled={submitting} className="w-full justify-center">
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        {/* <p className="mt-6 text-center text-xs text-slate-500">
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="font-medium text-slate-900 hover:underline">
            Sign up
          </Link>
        </p> */}
      </div>
    </div>
  );
}

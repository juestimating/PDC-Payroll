"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Lock, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { getSupabaseBrowser, hasSupabaseBrowserEnv } from "@/lib/supabase/client";

const POINTS = [
  { icon: Wallet, text: "Run monthly payroll for every entity in one place" },
  { icon: BarChart3, text: "See the financial story at a glance, then drill into any figure" },
  { icon: ShieldCheck, text: "Role-based access — people only see what they should" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const next =
      (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("next")) ||
      "/overview";

    // Demo/mock mode (no Supabase env): skip straight in.
    if (!hasSupabaseBrowserEnv()) {
      router.push(next);
      return;
    }

    setSubmitting(true);
    const { error: signInError } = await getSupabaseBrowser().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);

    if (signInError) {
      setError(
        /invalid login credentials/i.test(signInError.message)
          ? "Incorrect email or password."
          : signInError.message,
      );
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div
        className="relative hidden flex-col justify-between p-12 text-white lg:flex"
        style={{
          backgroundImage: "linear-gradient(150deg, var(--color-brand-600), var(--color-brand-900))",
        }}
      >
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 text-base font-bold">
            P
          </span>
          <span className="text-lg font-semibold">PDC Payroll</span>
        </div>

        <div className="max-w-md">
          <h1 className="text-3xl font-bold leading-tight">
            Payroll, tax, and finance — finally effortless.
          </h1>
          <p className="mt-3 text-white/70">
            One system to replace the scattered spreadsheets. Visual, accurate, and built for your
            whole organization.
          </p>
          <ul className="mt-8 space-y-4">
            {POINTS.map((p) => (
              <li key={p.text} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/15">
                  <p.icon className="h-4 w-4" />
                </span>
                <span className="text-sm text-white/85">{p.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/50">PKR · Monthly cycle · Secured with row-level access</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-base font-bold text-primary-foreground">
                P
              </span>
              <span className="text-lg font-semibold">PDC Payroll</span>
            </div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
          <p className="mt-1 text-sm text-muted">Sign in to continue to your dashboard.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-negative/30 bg-negative-soft px-3 py-2 text-sm text-negative"
              >
                {error}
              </div>
            ) : null}
            <Field label="Email">
              <Input
                type="email"
                required
                autoComplete="email"
                placeholder="name@pdc.com.pk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!error}
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!error}
              />
            </Field>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-muted">
                <input type="checkbox" className="rounded border-border" defaultChecked />
                Remember me
              </label>
              <button type="button" className="font-medium text-brand-600 hover:underline">
                Forgot password?
              </button>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              <Lock className="h-4 w-4" />
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

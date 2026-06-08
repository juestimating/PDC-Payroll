"use client";

import { useRouter } from "next/navigation";
import { BarChart3, Lock, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

const POINTS = [
  { icon: Wallet, text: "Run monthly payroll for every department in one place" },
  { icon: BarChart3, text: "See the financial story at a glance, then drill into any figure" },
  { icon: ShieldCheck, text: "Role-based access — people only see what they should" },
];

export default function LoginPage() {
  const router = useRouter();

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

          <form
            onSubmit={(e) => {
              e.preventDefault();
              router.push("/dashboard");
            }}
            className="mt-8 space-y-4"
          >
            <Field label="Email">
              <Input type="email" placeholder="name@pdc.com.pk" defaultValue="admin@pdc.com.pk" />
            </Field>
            <Field label="Password">
              <Input type="password" placeholder="••••••••" defaultValue="demo" />
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
            <Button type="submit" className="w-full">
              <Lock className="h-4 w-4" />
              Sign in
            </Button>
          </form>

          <p className="mt-6 rounded-lg bg-surface-muted px-3 py-2 text-center text-xs text-muted">
            Demo preview — any credentials work. Switch roles from the top bar once inside.
          </p>
        </div>
      </div>
    </div>
  );
}

import { ArrowRight, BadgeCheck, Landmark, ShieldCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";

import { login } from "../lib/api";
import { useAuthStore } from "../store/auth";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Input";

const loginSchema = z.object({
  phone: z.string().min(1, "Phone or admin ID is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.accessToken);
  const setSession = useAuthStore((state) => state.setSession);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginForm, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [values, setValues] = useState<LoginForm>({ phone: "", password: "" });

  if (token) return <Navigate to="/app" replace />;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setFieldErrors({});

    const parsed = loginSchema.safeParse({
      phone: values.phone.trim(),
      password: values.password,
    });
    if (!parsed.success) {
      setFieldErrors({
        phone: parsed.error.flatten().fieldErrors.phone?.[0],
        password: parsed.error.flatten().fieldErrors.password?.[0],
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const session = await login(parsed.data.phone, parsed.data.password);
      setSession(session.access, session.refresh, session.user);
      navigate("/app");
    } catch {
      setError("Login failed. Check your credentials and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex items-center px-5 py-10 sm:px-8 lg:px-14">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-white">
                <Landmark size={23} />
              </div>
              <div>
                <p className="text-xl font-bold">Alternative Trust Layer</p>
                <p className="text-sm text-muted-foreground">Micro-merchant trust intelligence</p>
              </div>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Sign in</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              One secure login for merchants, loan teams, and administrators.
            </p>

            <form className="mt-8 space-y-5" onSubmit={onSubmit}>
              <Field label="Phone or admin ID" error={fieldErrors.phone}>
                <Input
                  placeholder="+9779800000101 or admin"
                  autoComplete="username"
                  value={values.phone}
                  onChange={(event) => {
                    setValues((current) => ({ ...current, phone: event.target.value }));
                    setFieldErrors((current) => ({ ...current, phone: undefined }));
                  }}
                />
              </Field>
              <Field label="Password" error={fieldErrors.password}>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={values.password}
                  onChange={(event) => {
                    setValues((current) => ({ ...current, password: event.target.value }));
                    setFieldErrors((current) => ({ ...current, password: undefined }));
                  }}
                />
              </Field>
              {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Signing in" : "Continue"} <ArrowRight size={18} />
              </Button>
              <p className="text-sm text-muted-foreground">
                New merchant?{" "}
                <Link to="/signup" className="font-semibold text-primary hover:underline">
                  Create an account
                </Link>
              </p>
            </form>
          </div>
        </section>

        <section className="hidden border-l border-border bg-white lg:block">
          <div className="flex h-full flex-col justify-center px-14">
            <div className="max-w-lg">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-success">Financial inclusion</p>
              <h2 className="mt-4 text-4xl font-bold leading-tight text-foreground">
                Underwrite real trust for merchants without formal credit files.
              </h2>
              <div className="mt-8 grid gap-4">
                {[
                  { icon: BadgeCheck, title: "Social graph", text: "Guarantor strength, PageRank, and ring checks." },
                  { icon: ShieldCheck, title: "Behavioral signals", text: "Utility, QR, airtime, and bank statement analysis." },
                  { icon: Landmark, title: "Loan readiness", text: "Fast review workflows for loan department teams." },
                ].map((item) => (
                  <div key={item.title} className="rounded-lg border border-border p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md bg-sky-50 text-primary">
                        <item.icon size={19} />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{item.title}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

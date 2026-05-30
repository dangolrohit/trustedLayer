import { ArrowLeft, ArrowRight, Landmark } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Input";
import { login, registerMerchant } from "../lib/api";
import { useAuthStore } from "../store/auth";

const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name is too long"),
    phone: z.string().trim().min(1, "Phone is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupForm = z.infer<typeof signupSchema>;

export function SignupPage() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.accessToken);
  const setSession = useAuthStore((state) => state.setSession);

  const [values, setValues] = useState<SignupForm>({
    name: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof SignupForm, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (token) return <Navigate to="/app" replace />;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setFieldErrors({});

    const parsed = signupSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors({
        name: parsed.error.flatten().fieldErrors.name?.[0],
        phone: parsed.error.flatten().fieldErrors.phone?.[0],
        password: parsed.error.flatten().fieldErrors.password?.[0],
        confirmPassword: parsed.error.flatten().fieldErrors.confirmPassword?.[0],
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = parsed.data;
      await registerMerchant({
        name: payload.name,
        phone: payload.phone,
        password: payload.password,
      });
      const session = await login(payload.phone, payload.password);
      setSession(session.access, session.refresh, session.user);
      navigate("/app");
    } catch {
      setError("Signup failed. Try another phone number or check your details.");
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
                <p className="text-sm text-muted-foreground">Merchant onboarding</p>
              </div>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Create merchant account</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Sign up to start building your trust profile for faster loan decisions.
            </p>

            <form className="mt-8 space-y-5" onSubmit={onSubmit}>
              <Field label="Full name" error={fieldErrors.name}>
                <Input
                  placeholder="Maya Kirana Store"
                  autoComplete="name"
                  value={values.name}
                  onChange={(event) => {
                    setValues((current) => ({ ...current, name: event.target.value }));
                    setFieldErrors((current) => ({ ...current, name: undefined }));
                  }}
                />
              </Field>
              <Field label="Phone" error={fieldErrors.phone}>
                <Input
                  placeholder="+9779800000101"
                  autoComplete="tel"
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
                  autoComplete="new-password"
                  value={values.password}
                  onChange={(event) => {
                    setValues((current) => ({ ...current, password: event.target.value }));
                    setFieldErrors((current) => ({ ...current, password: undefined }));
                  }}
                />
              </Field>
              <Field label="Confirm password" error={fieldErrors.confirmPassword}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={values.confirmPassword}
                  onChange={(event) => {
                    setValues((current) => ({ ...current, confirmPassword: event.target.value }));
                    setFieldErrors((current) => ({ ...current, confirmPassword: undefined }));
                  }}
                />
              </Field>

              {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating account" : "Create account"} <ArrowRight size={18} />
              </Button>

              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                <ArrowLeft size={16} /> Back to login
              </Link>
            </form>
          </div>
        </section>

        <section className="hidden border-l border-border bg-white lg:block">
          <div className="flex h-full items-center px-14">
            <div className="max-w-lg rounded-xl border border-border p-7">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-success">What happens next</p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                <li>1. Complete your profile and upload your bank statement.</li>
                <li>2. Add guarantors and behavioral signals.</li>
                <li>3. Build trust score history before your first loan request.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

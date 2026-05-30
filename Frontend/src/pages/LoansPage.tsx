import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../components/ui/Button";
import { Field, Input, Textarea } from "../components/ui/Input";
import { Panel } from "../components/ui/Panel";
import { formatCurrency } from "../lib/utils";
import { listLoans, reviewLoan, submitLoan } from "../lib/api";
import { useAuthStore } from "../store/auth";
import type { LoanApplication } from "../types/api";

const loanSchema = z.object({
  amount_requested: z.string().min(1, "Amount is required"),
  purpose: z.string().min(8, "Purpose needs more detail"),
});

type LoanForm = z.infer<typeof loanSchema>;

export function LoansPage() {
  const user = useAuthStore((state) => state.user);
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [message, setMessage] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<LoanForm>({
    resolver: zodResolver(loanSchema),
    defaultValues: { amount_requested: "", purpose: "" },
  });

  const refresh = () => listLoans().then(setLoans);

  useEffect(() => {
    refresh();
  }, []);

  const onSubmit = async (values: LoanForm) => {
    await submitLoan(values);
    reset();
    setMessage("Loan application submitted.");
    await refresh();
  };

  const onReview = async (id: number, status: "approved" | "rejected") => {
    await reviewLoan(id, {
      status,
      notes: reviewNotes[id] || (status === "approved" ? "Approved after trust score review." : "Rejected after risk review."),
    });
    setReviewNotes((current) => ({ ...current, [id]: "" }));
    await refresh();
  };

  const canReview = user?.role === "admin" || user?.role === "loan_department";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Loan Applications</h1>
        <p className="mt-1 text-sm text-muted-foreground">Submit, track, and review requests using trust score context.</p>
      </div>

      {user?.role === "merchant" ? (
        <Panel>
          <form className="grid gap-4 md:grid-cols-[220px_1fr_auto] md:items-start" onSubmit={handleSubmit(onSubmit)}>
            <Field label="Amount" error={errors.amount_requested?.message}>
              <Input placeholder="75000" {...register("amount_requested")} />
            </Field>
            <Field label="Purpose" error={errors.purpose?.message}>
              <Textarea placeholder="Inventory expansion, equipment purchase, working capital..." {...register("purpose")} />
            </Field>
            <Button type="submit" disabled={isSubmitting} className="md:mt-7">Submit</Button>
          </form>
          {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
        </Panel>
      ) : null}

      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="py-3 font-medium">Merchant</th>
                <th className="py-3 font-medium">Amount</th>
                <th className="py-3 font-medium">Score</th>
                <th className="py-3 font-medium">Status</th>
                <th className="py-3 font-medium">Purpose</th>
                <th className="py-3 font-medium">Notes</th>
                {canReview ? <th className="py-3 font-medium">Review</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loans.map((loan) => (
                <tr key={loan.id}>
                  <td className="py-3">{loan.merchant_phone}</td>
                  <td className="py-3">{formatCurrency(loan.amount_requested)}</td>
                  <td className="py-3">{loan.trust_score_at_application}</td>
                  <td className="py-3 capitalize">{loan.status}</td>
                  <td className="max-w-xs truncate py-3">{loan.purpose}</td>
                  <td className="max-w-xs py-3 text-muted-foreground">{loan.notes || "-"}</td>
                  {canReview ? (
                    <td className="py-3">
                      {loan.status === "pending" ? (
                        <div className="grid min-w-72 gap-2">
                          <Textarea
                            placeholder="Add review notes"
                            value={reviewNotes[loan.id] ?? ""}
                            onChange={(event) => setReviewNotes((current) => ({ ...current, [loan.id]: event.target.value }))}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => onReview(loan.id, "approved")}>
                              <CheckCircle2 size={16} /> Approve
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => onReview(loan.id, "rejected")}>
                              <XCircle size={16} /> Reject
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Reviewed</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

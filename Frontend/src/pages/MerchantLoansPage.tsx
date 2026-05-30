import React, { useEffect, useState } from "react";
import { submitLoan, listLoans } from "../lib/api";
import { useAuthStore } from "../store/auth";

export function MerchantLoansPage() {
  const user = useAuthStore((s) => s.user);
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [loans, setLoans] = useState<any[]>([]);

  const loadLoans = async () => {
    try {
      const all = await listLoans();
      const mine = all.filter((l: any) => l.merchant === user?.id);
      setLoans(mine);
    } catch (err) {
      // ignore for now
    }
  };

  useEffect(() => {
    loadLoans();
  }, [user?.id]);

  const submit = async () => {
    if (!amount || !purpose) return setMessage("Please provide amount and purpose.");
    setLoading(true);
    setMessage("");
    try {
      await submitLoan({ amount_requested: amount, purpose });
      setMessage("Loan application submitted.");
      setAmount("");
      setPurpose("");
      await loadLoans();
    } catch (err: any) {
      setMessage(err?.response?.data?.detail || err?.message || "Submission failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold">Loans</h1>
      <p className="mt-2 text-sm text-muted-foreground">Apply for loans, view status, and manage repayments.</p>

      <div className="mt-6 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm">Amount</span>
            <input className="mt-1 block w-full" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm">Purpose</span>
            <input className="mt-1 block w-full" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </label>
        </div>
        <div className="flex gap-3">
          <button className="btn-primary" onClick={submit} disabled={loading}>{loading ? "Submitting..." : "Apply for loan"}</button>
        </div>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

        <div className="mt-6">
          <h2 className="font-semibold">My applications</h2>
          <div className="mt-2">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Requested</th>
                  <th className="text-left">Purpose</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Applied</th>
                </tr>
              </thead>
              <tbody>
                {loans.length ? (
                  loans.map((l) => (
                    <tr key={l.id}>
                      <td>{l.amount_requested}</td>
                      <td>{l.purpose}</td>
                      <td>{l.status}</td>
                      <td>{new Date(l.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-sm text-muted-foreground">No applications yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

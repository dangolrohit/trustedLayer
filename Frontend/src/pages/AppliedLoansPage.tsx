import React, { useEffect, useState } from "react";
import { listLoans, reviewLoan } from "../lib/api";

export function AppliedLoansPage() {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const all = await listLoans();
      setLoans(all.filter((l: any) => l.status === "pending"));
    } catch (err) {
      setMessage("Failed to load loans.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleReview = async (id: number, action: "approved" | "rejected") => {
    setMessage("");
    try {
      await reviewLoan(id, { status: action, notes: action === "rejected" ? "Rejected by loan officer" : "Approved" });
      setMessage(`Loan ${id} ${action}.`);
      await load();
    } catch (err: any) {
      setMessage(err?.response?.data?.detail || "Review failed.");
    }
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold">Applied Loans</h1>
      <p className="mt-2 text-sm text-muted-foreground">View and manage loan applications submitted by merchants.</p>

      <div className="mt-6">
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        <div className="mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Merchant</th>
                <th>Amount</th>
                <th>Purpose</th>
                <th>Applied</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>Loading...</td>
                </tr>
              ) : loans.length ? (
                loans.map((l) => (
                  <tr key={l.id}>
                    <td>{l.merchant_phone}</td>
                    <td>{l.amount_requested}</td>
                    <td>{l.purpose}</td>
                    <td>{new Date(l.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="mr-2 btn-approve" onClick={() => handleReview(l.id, "approved")}>Approve</button>
                      <button className="btn-reject" onClick={() => handleReview(l.id, "rejected")}>Reject</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-sm text-muted-foreground">No pending applications.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

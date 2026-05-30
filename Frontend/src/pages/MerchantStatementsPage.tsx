import React, { useState } from "react";
import { uploadBankStatement, listBankStatements, getTrustScore } from "../lib/api";
import { useAuthStore } from "../store/auth";

export function MerchantStatementsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [statement, setStatement] = useState<any | null>(null);
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    setFile(f ?? null);
  };

  const submit = async () => {
    if (!file) return setMessage("Please select a file to upload.");
    setLoading(true);
    setMessage("");
    try {
      const data = await uploadBankStatement(file, user?.id);
      // API returns { statement, trust_score }
      setStatement(data.statement);
      // update local user profile with new trust score
      const score = data.trust_score;
      const updated = { ...(user ?? {}), profile: { ...(user?.profile as any), trust_score: score.score, score_last_updated: new Date().toISOString() } } as any;
      setUser(updated);
      setMessage(`Upload successful — new trust score: ${score.score}`);
    } catch (err: any) {
      setMessage(err?.response?.data?.detail || err?.message || "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold">Statements</h1>
      <p className="mt-2 text-sm text-muted-foreground">Upload and view your bank statements and parsed transactions.</p>

      <div className="mt-6 space-y-4">
        <label className="block">
          <input type="file" accept=".pdf,.xls,.xlsx,.xlsb,.csv" onChange={onFileChange} />
        </label>
        <div className="flex gap-3">
          <button className="btn-primary" onClick={submit} disabled={loading || !file}>
            {loading ? "Uploading..." : "Upload statement"}
          </button>
        </div>

        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

        {statement ? (
          <div className="mt-4">
            <h3 className="font-semibold">Parsed transactions</h3>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left">Date</th>
                    <th className="text-left">Description</th>
                    <th className="text-right">Credit</th>
                    <th className="text-right">Debit</th>
                    <th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(statement.parsed_transactions) && statement.parsed_transactions.length ? (
                    statement.parsed_transactions.map((t: any, i: number) => (
                      <tr key={i}>
                        <td>{t.date}</td>
                        <td>{t.description}</td>
                        <td className="text-right">{t.credit ?? ""}</td>
                        <td className="text-right">{t.debit ?? ""}</td>
                        <td className="text-right">{t.balance ?? ""}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-sm text-muted-foreground">No transactions parsed.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

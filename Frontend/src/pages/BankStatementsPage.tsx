import { FileUp, ReceiptText } from "lucide-react";
import { useEffect, useState } from "react";
import type { AxiosError } from "axios";

import { Button } from "../components/ui/Button";
import { Panel } from "../components/ui/Panel";
import { formatCurrency } from "../lib/utils";
import { listBankStatements, listMerchants, uploadBankStatement } from "../lib/api";
import { useAuthStore } from "../store/auth";
import type { BankStatement, User } from "../types/api";

export function BankStatementsPage() {
  const user = useAuthStore((state) => state.user);
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  const refresh = () => listBankStatements().then(setStatements);

  useEffect(() => {
    refresh();
    if (user?.role === "admin" || user?.role === "loan_department") {
      listMerchants().then(setUsers).catch(() => setMessage("Unable to load merchant list."));
    }
  }, [user?.role]);

  const onUpload = async () => {
    if (!selectedFile) return;
    const merchantId = selectedMerchantId ? Number(selectedMerchantId) : undefined;
    if (user?.role !== "merchant" && !merchantId) {
      setMessage("Choose a merchant before uploading a statement.");
      return;
    }
    setUploading(true);
    setMessage("");
    try {
      const result = await uploadBankStatement(selectedFile, merchantId);
      setSelectedFile(null);
      setSelectedMerchantId("");
      setMessage(`Statement uploaded and analyzed. Current trust score: ${result.trust_score.score}.`);
      await refresh();
    } catch (error) {
      const axiosError = error as AxiosError<{ detail?: string }>;
      const detail = axiosError.response?.data?.detail;
      setMessage(detail || "Upload failed. Use a PDF/Excel file under 5MB and check backend/Supabase settings.");
    } finally {
      setUploading(false);
    }
  };

  const latest = statements[0];
  const merchants = users.filter((item) => item.role === "merchant");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Banks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Link a bank or upload a statement to review extracted transaction records and cash-flow signals.
        </p>
      </div>

      <Panel>
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          {user?.role !== "merchant" ? (
            <label>
              <span className="mb-2 block text-sm font-medium">Merchant</span>
              <select
                className="focus-ring h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground"
                value={selectedMerchantId}
                onChange={(event) => setSelectedMerchantId(event.target.value)}
              >
                <option value="">Select merchant</option>
                {merchants.map((merchant) => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchant.profile?.name || merchant.phone}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            <span className="mb-2 block text-sm font-medium">Upload statement file (PDF or Excel)</span>
            <input
              type="file"
              accept=".pdf,.xlsx,.xls,.xlsm,.xlsb,.xltx,.xltm,.xlt,.xla,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="block w-full rounded-md border border-border bg-white text-sm file:mr-4 file:h-11 file:border-0 file:bg-primary file:px-4 file:text-sm file:font-semibold file:text-white"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <Button onClick={onUpload} disabled={!selectedFile || uploading || (user?.role !== "merchant" && !selectedMerchantId)}>
            <FileUp size={18} /> {uploading ? "Uploading" : "Upload"}
          </Button>
        </div>
        {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
      </Panel>

      {latest ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Panel>
            <p className="text-sm text-muted-foreground">Monthly income</p>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(Number(latest.analysis_summary.monthly_income ?? 0))}</p>
          </Panel>
          <Panel>
            <p className="text-sm text-muted-foreground">Average balance</p>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(Number(latest.analysis_summary.avg_balance ?? 0))}</p>
          </Panel>
          <Panel>
            <p className="text-sm text-muted-foreground">Consistency</p>
            <p className="mt-2 text-2xl font-bold">{latest.analysis_summary.consistency_score ?? 0}</p>
          </Panel>
          <Panel>
            <p className="text-sm text-muted-foreground">Bank score</p>
            <p className="mt-2 text-2xl font-bold">{latest.analysis_summary.bank_behavior_score ?? 0}</p>
          </Panel>
        </div>
      ) : null}

      {latest && latest.parsed_transactions.length ? (
        <Panel>
          <h2 className="mb-4 font-semibold">Latest statement transactions</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="py-3 font-medium">Date</th>
                  <th className="py-3 font-medium">Description</th>
                  <th className="py-3 font-medium">Credit</th>
                  <th className="py-3 font-medium">Debit</th>
                  <th className="py-3 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {latest.parsed_transactions.map((tx, index) => (
                  <tr key={`${tx.date}-${index}`}>
                    <td className="py-3">{tx.date}</td>
                    <td className="py-3">{tx.description || "-"}</td>
                    <td className="py-3">{formatCurrency(Number(tx.credit ?? 0))}</td>
                    <td className="py-3">{formatCurrency(Number(tx.debit ?? 0))}</td>
                    <td className="py-3">{formatCurrency(Number(tx.balance ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <Panel>
        <div className="mb-4 flex items-center gap-2">
          <ReceiptText className="text-primary" size={20} />
          <h2 className="font-semibold">Recent statements</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="py-3 font-medium">Uploaded</th>
                <th className="py-3 font-medium">Transactions</th>
                <th className="py-3 font-medium">Income</th>
                <th className="py-3 font-medium">Volatility</th>
                <th className="py-3 font-medium">Bounced</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {statements.map((statement) => (
                <tr key={statement.id}>
                  <td className="py-3">{new Date(statement.uploaded_at).toLocaleString()}</td>
                  <td className="py-3">{statement.parsed_transactions.length}</td>
                  <td className="py-3">{formatCurrency(Number(statement.analysis_summary.monthly_income ?? 0))}</td>
                  <td className="py-3">{statement.analysis_summary.volatility ?? 0}</td>
                  <td className="py-3">{statement.analysis_summary.bounced_count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

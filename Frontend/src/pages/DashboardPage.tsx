import { useEffect, useState } from "react";
import { AlertCircle, Banknote, FileText, TrendingUp } from "lucide-react";

import { BreakdownChart } from "../components/BreakdownChart";
import { ScoreGauge } from "../components/ScoreGauge";
import { Panel, StatPanel } from "../components/ui/Panel";
import { getDashboard } from "../lib/api";
import { formatCurrency } from "../lib/utils";
import type { Dashboard } from "../types/api";

export function DashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getDashboard().then(setDashboard).catch(() => setError("Unable to load dashboard."));
  }, []);

  if (error) return <Panel><p className="text-sm text-rose-600">{error}</p></Panel>;
  if (!dashboard) return <Panel><p className="text-sm text-muted-foreground">Loading dashboard...</p></Panel>;

  const latestLoan = dashboard.recent_loans[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {dashboard.profile.name || dashboard.profile.phone} · {dashboard.profile.trade_type || "Merchant"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatPanel label="Trust score" value={dashboard.trust_score.score} detail="Latest calculated score" />
        <StatPanel label="Bank statements" value={dashboard.bank_statement_count} detail="Analyzed documents" />
        <StatPanel
          label="Latest loan"
          value={latestLoan ? formatCurrency(latestLoan.amount_requested) : "None"}
          detail={latestLoan?.status ?? "No applications yet"}
        />
        <StatPanel label="Bank impact" value={dashboard.trust_score.breakdown.bank_impact} detail="Behavioral adjustment" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Panel>
          <ScoreGauge score={dashboard.trust_score.score} />
          <p className="mt-4 rounded-md bg-sky-50 p-3 text-sm leading-6 text-slate-700">
            {dashboard.trust_score.explanation}
          </p>
        </Panel>
        <Panel>
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="text-primary" size={20} />
            <h2 className="font-semibold text-foreground">Score breakdown</h2>
          </div>
          <BreakdownChart score={dashboard.trust_score} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel>
          <Banknote className="text-success" size={22} />
          <p className="mt-3 font-semibold">Behavior score</p>
          <p className="mt-1 text-2xl font-bold">{dashboard.trust_score.breakdown.behavioral_component}</p>
        </Panel>
        <Panel>
          <FileText className="text-primary" size={22} />
          <p className="mt-3 font-semibold">Psychometric score</p>
          <p className="mt-1 text-2xl font-bold">{dashboard.trust_score.breakdown.psychometric_component}</p>
        </Panel>
        <Panel>
          <AlertCircle className="text-amber-600" size={22} />
          <p className="mt-3 font-semibold">Social score</p>
          <p className="mt-1 text-2xl font-bold">{dashboard.trust_score.breakdown.social_component}</p>
        </Panel>
      </div>
    </div>
  );
}

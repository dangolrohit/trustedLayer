import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { TrustScore } from "../types/api";

export function BreakdownChart({ score }: { score: TrustScore }) {
  const data = [
    { name: "Social", value: score.breakdown.social_component },
    { name: "Psycho", value: score.breakdown.psychometric_component },
    { name: "Behavior", value: score.breakdown.behavioral_component },
    { name: "Bank", value: score.behavioral_signals.bank_statement_score },
  ];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip cursor={{ fill: "#f1f5f9" }} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#0f92bd" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

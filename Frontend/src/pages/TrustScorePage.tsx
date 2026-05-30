import { zodResolver } from "@hookform/resolvers/zod";
import { Calculator } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { BreakdownChart } from "../components/BreakdownChart";
import { ScoreGauge } from "../components/ScoreGauge";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Input";
import { Panel } from "../components/ui/Panel";
import { getTrustHistory, getTrustScore, simulateScore } from "../lib/api";
import type { TrustScore, TrustScoreHistory } from "../types/api";

const simulatorSchema = z.object({
  social_component: z.coerce.number().min(0).max(100),
  psychometric_component: z.coerce.number().min(0).max(100),
  behavioral_component: z.coerce.number().min(0).max(100),
});

type SimulatorForm = z.infer<typeof simulatorSchema>;

export function TrustScorePage() {
  const [score, setScore] = useState<TrustScore | null>(null);
  const [history, setHistory] = useState<TrustScoreHistory[]>([]);
  const [simulated, setSimulated] = useState<TrustScore | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<SimulatorForm>({
    resolver: zodResolver(simulatorSchema),
    defaultValues: { social_component: 60, psychometric_component: 70, behavioral_component: 75 },
  });

  useEffect(() => {
    Promise.all([getTrustScore(), getTrustHistory()]).then(([scoreData, historyData]) => {
      setScore(scoreData);
      setHistory(historyData);
      reset({
        social_component: scoreData.breakdown.social_component,
        psychometric_component: scoreData.breakdown.psychometric_component,
        behavioral_component: scoreData.breakdown.behavioral_component,
      });
    });
  }, [reset]);

  const onSimulate = async (values: SimulatorForm) => {
    setSimulated(await simulateScore(values));
  };

  if (!score) return <Panel><p className="text-sm text-muted-foreground">Loading trust score...</p></Panel>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Trust Score</h1>
        <p className="mt-1 text-sm text-muted-foreground">Score components, explanation, and what-if simulation.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Panel>
          <ScoreGauge score={score.score} />
          <p className="mt-4 text-sm leading-6 text-muted-foreground">{score.explanation}</p>
        </Panel>
        <Panel>
          <BreakdownChart score={score} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <div className="mb-4 flex items-center gap-2">
            <Calculator className="text-primary" size={20} />
            <h2 className="font-semibold">What-if simulator</h2>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit(onSimulate)}>
            <Field label="Social component" error={errors.social_component?.message}>
              <Input type="number" min={0} max={100} {...register("social_component")} />
            </Field>
            <Field label="Psychometric component" error={errors.psychometric_component?.message}>
              <Input type="number" min={0} max={100} {...register("psychometric_component")} />
            </Field>
            <Field label="Behavioral component" error={errors.behavioral_component?.message}>
              <Input type="number" min={0} max={100} {...register("behavioral_component")} />
            </Field>
            <Button type="submit" disabled={isSubmitting}>Simulate</Button>
          </form>
          {simulated ? (
            <div className="mt-4 rounded-md bg-sky-50 p-3">
              <p className="text-sm text-muted-foreground">Simulated score</p>
              <p className="text-3xl font-bold text-primary">{simulated.score}</p>
            </div>
          ) : null}
        </Panel>

        <Panel>
          <h2 className="font-semibold">History</h2>
          <div className="mt-4 divide-y divide-border">
            {history.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">Score {item.score}</p>
                  <p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p>
                </div>
                <p className="text-sm text-muted-foreground">Bank impact {item.bank_impact}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

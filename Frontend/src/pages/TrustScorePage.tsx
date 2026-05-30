import { zodResolver } from "@hookform/resolvers/zod";
import { Calculator } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { BreakdownChart } from "../components/BreakdownChart";
import { ScoreGauge } from "../components/ScoreGauge";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Input";
import { Panel } from "../components/ui/Panel";
import { addGuarantor, getTrustHistory, getTrustScore, listMerchants, listUsers, simulateScore, submitPsychometric } from "../lib/api";
import { useAuthStore } from "../store/auth";
import type { TrustScore, TrustScoreHistory, User } from "../types/api";

const simulatorSchema = z.object({
  social_component: z.coerce.number().min(0).max(100),
  psychometric_component: z.coerce.number().min(0).max(100),
  behavioral_component: z.coerce.number().min(0).max(100),
});

type SimulatorForm = z.infer<typeof simulatorSchema>;

export function TrustScorePage() {
  const user = useAuthStore((state) => state.user);
  const [score, setScore] = useState<TrustScore | null>(null);
  const [history, setHistory] = useState<TrustScoreHistory[]>([]);
  const [simulated, setSimulated] = useState<TrustScore | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState("");
  const [psychometric, setPsychometric] = useState({ trait: "planning", score: "75" });
  const [guarantor, setGuarantor] = useState({ guarantor: "", vouch_strength: "4" });
  const [message, setMessage] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<SimulatorForm>({
    resolver: zodResolver(simulatorSchema),
    defaultValues: { social_component: 60, psychometric_component: 70, behavioral_component: 75 },
  });

  const loadScore = useCallback(async (merchantId?: number) => {
    const [scoreData, historyData] = await Promise.all([getTrustScore(merchantId), getTrustHistory(merchantId)]);
      setScore(scoreData);
      setHistory(historyData);
      setSimulated(null);
      reset({
        social_component: scoreData.breakdown.social_component,
        psychometric_component: scoreData.breakdown.psychometric_component,
        behavioral_component: scoreData.breakdown.behavioral_component,
      });
  }, [reset]);

  useEffect(() => {
    loadScore();
    const loadUsers = user?.role === "merchant" ? listMerchants : listUsers;
    loadUsers().then(setUsers).catch(() => undefined);
  }, [loadScore, user?.role]);

  const merchants = users.filter((item) => item.role === "merchant" && item.id !== user?.id);
  const selectedMerchant = selectedMerchantId ? Number(selectedMerchantId) : undefined;

  const onSimulate = async (values: SimulatorForm) => {
    setSimulated(await simulateScore({ ...values, merchant_id: selectedMerchant }));
  };

  const onMerchantChange = async (merchantId: string) => {
    setSelectedMerchantId(merchantId);
    await loadScore(merchantId ? Number(merchantId) : undefined);
  };

  const onPsychometricSubmit = async () => {
    setMessage("");
    await submitPsychometric({
      trait: psychometric.trait.trim(),
      score: Number(psychometric.score),
      responses_json: { submitted_from: "merchant_portal" },
    });
    setMessage("Psychometric response saved and score recalculated.");
    await loadScore();
  };

  const onGuarantorSubmit = async () => {
    setMessage("");
    await addGuarantor({
      guarantor: Number(guarantor.guarantor),
      vouch_strength: Number(guarantor.vouch_strength),
    });
    setMessage("Guarantor added and score recalculated.");
    await loadScore();
  };

  if (!score) return <Panel><p className="text-sm text-muted-foreground">Loading trust score...</p></Panel>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Trust Score</h1>
        <p className="mt-1 text-sm text-muted-foreground">Score components, explanation, and what-if simulation.</p>
      </div>

      {(user?.role === "admin" || user?.role === "loan_department") ? (
        <Panel>
          <Field label="View merchant score">
            <select
              className="focus-ring h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground"
              value={selectedMerchantId}
              onChange={(event) => void onMerchantChange(event.target.value)}
            >
              <option value="">Own workspace score</option>
              {users.filter((item) => item.role === "merchant").map((merchant) => (
                <option key={merchant.id} value={merchant.id}>
                  {merchant.profile?.name || merchant.phone}
                </option>
              ))}
            </select>
          </Field>
        </Panel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Panel>
          <ScoreGauge score={score.score} />
          <p className="mt-4 text-sm leading-6 text-muted-foreground">{score.explanation}</p>
        </Panel>
        <Panel>
          <BreakdownChart score={score} />
        </Panel>
      </div>

      {user?.role === "merchant" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel>
            <h2 className="font-semibold">Complete psychometric test</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_140px_auto] sm:items-end">
              <Field label="Trait">
                <Input value={psychometric.trait} onChange={(event) => setPsychometric((current) => ({ ...current, trait: event.target.value }))} />
              </Field>
              <Field label="Score">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={psychometric.score}
                  onChange={(event) => setPsychometric((current) => ({ ...current, score: event.target.value }))}
                />
              </Field>
              <Button type="button" onClick={onPsychometricSubmit}>Save</Button>
            </div>
          </Panel>

          <Panel>
            <h2 className="font-semibold">Add guarantor</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_140px_auto] sm:items-end">
              <Field label="Guarantor">
                <select
                  className="focus-ring h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground"
                  value={guarantor.guarantor}
                  onChange={(event) => setGuarantor((current) => ({ ...current, guarantor: event.target.value }))}
                >
                  <option value="">Select merchant</option>
                  {merchants.map((merchant) => (
                    <option key={merchant.id} value={merchant.id}>
                      {merchant.profile?.name || merchant.phone}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Strength">
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={guarantor.vouch_strength}
                  onChange={(event) => setGuarantor((current) => ({ ...current, vouch_strength: event.target.value }))}
                />
              </Field>
              <Button type="button" onClick={onGuarantorSubmit} disabled={!guarantor.guarantor}>Add</Button>
            </div>
          </Panel>
          {message ? <p className="text-sm text-muted-foreground lg:col-span-2">{message}</p> : null}
        </div>
      ) : null}

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

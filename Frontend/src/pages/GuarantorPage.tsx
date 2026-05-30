import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Input, Textarea, Field } from "../components/ui/Input";
import { addGuarantor, getTrustScore, listGuarantors, listMerchants } from "../lib/api";
import type { Guarantor } from "../types/api";

type LocalGuarantor = {
  id: number;
  name: string;
  phone: string;
  address?: string;
  relation?: string;
  vouch: number;
};

export function GuarantorPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [relation, setRelation] = useState("");
  const [vouch, setVouch] = useState(4);
  const [list, setList] = useState<LocalGuarantor[]>(() => {
    try {
      const raw = localStorage.getItem("local_guarantors");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [savedGuarantors, setSavedGuarantors] = useState<Guarantor[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [updatedTrustScore, setUpdatedTrustScore] = useState<number | null>(null);

  const refreshSavedGuarantors = async () => {
    try {
      const items = await listGuarantors();
      setSavedGuarantors(items as Guarantor[]);
    } catch {
      setSavedGuarantors([]);
    }
  };

  useEffect(() => {
    void refreshSavedGuarantors();
  }, []);

  const addToList = () => {
    if (!name.trim() || !phone.trim()) {
      setMessage("Please provide at least name and phone number before adding.");
      return;
    }
    const entry: LocalGuarantor = { id: Date.now(), name: name.trim(), phone: phone.trim(), address: address.trim(), relation: relation.trim(), vouch };
    const updated = [...list, entry];
    setList(updated);
    try {
      localStorage.setItem("local_guarantors", JSON.stringify(updated));
    } catch {}
    setName("");
    setPhone("");
    setAddress("");
    setRelation("");
    setVouch(4);
    setMessage("Guarantor added to the list.");
  };

  const removeFromList = (id: number) => {
    const updated = list.filter((l) => l.id !== id);
    setList(updated);
    try {
      localStorage.setItem("local_guarantors", JSON.stringify(updated));
    } catch {}
  };

  const submitAll = async () => {
    if (list.length === 0) {
      setMessage("No guarantors to submit.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const merchants = await listMerchants();
      const remaining: LocalGuarantor[] = [];
      for (const g of list) {
        const found = merchants.find((m: any) => m.phone === g.phone || (m.profile && m.profile.name === g.name));
        try {
          await addGuarantor({
            guarantor: found?.id ?? null,
            guarantor_name: g.name,
            guarantor_phone: g.phone,
            guarantor_address: g.address ?? "",
            relation: g.relation ?? "",
            vouch_strength: Number(g.vouch),
          });
        } catch (err) {
          // on API failure, keep locally
          remaining.push(g);
        }
      }
      setList(remaining);
      try {
        localStorage.setItem("local_guarantors", JSON.stringify(remaining));
      } catch {}
      setMessage(remaining.length === 0 ? "All guarantors submitted/linked." : `${remaining.length} guarantor(s) saved locally (not linked).`);
      try {
        const trust = await getTrustScore();
        setUpdatedTrustScore(trust.score);
      } catch {}
      await refreshSavedGuarantors();
      setTimeout(() => navigate("/app"), 900);
    } catch (err) {
      setMessage("Failed to submit guarantors. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const computeSocialScore = () => {
    const source = savedGuarantors.length > 0
      ? savedGuarantors.map((g) => ({ vouch: g.vouch_strength }))
      : list;
    if (!source || source.length === 0) return 0;
    const avgVouch = source.reduce((s, g) => s + (Number(g.vouch) || 0), 0) / source.length; // 1..5
    // base score from average vouch mapped to 0..100
    const base = Math.round(((avgVouch - 1) / 4) * 100);
    // reward more guarantors: scale factor up to 1.0 at 3 guarantors
    const scale = Math.min(1, source.length / 3);
    return Math.round(base * scale);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Guarantor</h1>
      <p className="mt-2 text-sm text-muted-foreground">Add or show all guarantors to help measure the social component.</p>

      <div className="mt-6 space-y-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </Field>

        <Field label="Phone number">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9812345678" />
        </Field>

        <Field label="Address">
          <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" />
        </Field>

        <Field label="Relation">
          <Input value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="Relation to you" />
        </Field>

        <Field label="Vouch strength (1-5)">
          <Input type="number" min={1} max={5} value={vouch} onChange={(e) => setVouch(Number(e.target.value))} />
        </Field>

        <div className="flex gap-3">
          <Button onClick={addToList}>Add to list</Button>
          <Button variant="ghost" onClick={() => { setName(""); setPhone(""); setAddress(""); setRelation(""); setVouch(4); }}>Clear</Button>
        </div>

        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-medium">Saved guarantors</h2>
            <Button variant="ghost" onClick={refreshSavedGuarantors}>Refresh saved</Button>
          </div>
          {savedGuarantors.length > 0 ? (
            <ul className="space-y-2">
              {savedGuarantors.map((g) => (
                <li key={g.id} className="rounded-md border p-3">
                  <div className="font-medium">{g.guarantor_name || g.linked_guarantor_phone || "Guarantor"}</div>
                  <div className="text-sm text-muted-foreground">
                    {g.guarantor_phone || g.linked_guarantor_phone || "-"} {g.relation ? `· ${g.relation}` : ""}
                  </div>
                  <div className="text-sm text-muted-foreground">{g.guarantor_address || ""}</div>
                  <div className="text-sm">Vouch: {g.vouch_strength} · Status: {g.status}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No saved guarantors yet.</p>
          )}
        </div>

        {list.length > 0 ? (
          <div className="mt-4">
            <h2 className="font-medium">Guarantor list</h2>
            <div className="mt-2 text-sm text-muted-foreground">Social score (preview): <strong>{computeSocialScore()}</strong></div>
            {updatedTrustScore !== null ? (
              <div className="mt-1 text-sm text-muted-foreground">Updated trust score: <strong>{updatedTrustScore}</strong></div>
            ) : null}
            <ul className="mt-2 space-y-2">
              {list.map((g) => (
                <li key={g.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div>
                    <div className="font-medium">{g.name} <span className="text-sm text-muted-foreground">({g.phone})</span></div>
                    <div className="text-sm text-muted-foreground">{g.relation} {g.address ? `· ${g.address}` : ""}</div>
                    <div className="text-sm">Vouch: {g.vouch} · contribution: <strong>{Math.round(((g.vouch - 1) / 4) * 100)}</strong></div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="ghost" onClick={() => removeFromList(g.id)}>Remove</Button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex gap-3">
              <Button onClick={submitAll} disabled={loading}>{loading ? "Submitting..." : "Submit all"}</Button>
              <Button variant="secondary" onClick={() => { setList([]); localStorage.removeItem("local_guarantors"); }}>Clear list</Button>
            </div>
          </div>
        ) : null}

        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </div>
  );
}

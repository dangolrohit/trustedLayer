import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { submitPsychometric } from "../lib/api";
import { useAuthStore } from "../store/auth";

const DEFAULT_QUESTIONS = [
  "I can adapt quickly to unexpected problems.",
  "I tell the truth even when it's difficult.",
  "I plan my work and follow a schedule.",
  "I stay calm under pressure.",
  "I consider consequences before acting.",
];

const OPTION_LABELS = [
  "Strongly disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly agree",
];

const QUESTIONS_KEY = "psychometric_questions";
const DRAFT_KEY = "psychometric_draft";

export function PsychometricPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [questions, setQuestions] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(QUESTIONS_KEY);
      return raw ? JSON.parse(raw) : DEFAULT_QUESTIONS;
    } catch {
      return DEFAULT_QUESTIONS;
    }
  });

  const [answers, setAnswers] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) return JSON.parse(raw).answers as number[];
    } catch {}
    return Array(questions.length).fill(0); // 0 = unanswered
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [newQuestion, setNewQuestion] = useState("");

  useEffect(() => {
    // keep draft in sync with questions length
    setAnswers((prev) => {
      if (prev.length === questions.length) return prev;
      const copy = [...prev];
      while (copy.length < questions.length) copy.push(0);
      return copy.slice(0, questions.length);
    });
  }, [questions]);

  useEffect(() => {
    // persist draft
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers }));
    } catch {}
  }, [answers]);

  function setAnswer(index: number, value: number) {
    setAnswers((cur) => {
      const copy = [...cur];
      copy[index] = value;
      return copy;
    });
    // auto-advance
    if (index < questions.length - 1) {
      setTimeout(() => setCurrentIndex((i) => Math.min(i + 1, questions.length - 1)), 150);
    }
  }

  const computeScore = () => {
    // answers are 1..5; ignore any zeros (but validation requires none)
    const vals = answers.map((v) => (v === 0 ? 3 : v));
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    return Math.round(((avg - 1) / 4) * 100);
  };

  const allAnswered = answers.every((a) => a >= 1 && a <= 5);

  const onSubmit = async () => {
    if (!allAnswered) {
      setMessage("Please answer all questions before submitting.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const score = computeScore();
      await submitPsychometric({ trait: "psychometric", score, responses_json: { answers } });
      setMessage("Psychometric responses saved.");
      localStorage.removeItem(DRAFT_KEY);
      setTimeout(() => navigate("/app"), 800);
    } catch (err) {
      setMessage("Failed to save. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const canAdd = user && (user.role === "admin" || user.role === "loan_department");

  const addQuestion = () => {
    if (!newQuestion.trim()) return;
    const updated = [...questions, newQuestion.trim()];
    setQuestions(updated);
    try {
      localStorage.setItem(QUESTIONS_KEY, JSON.stringify(updated));
    } catch {}
    setNewQuestion("");
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Psychometric questionnaire</h1>
      <p className="mt-2 text-sm text-muted-foreground">Answer the following statements using the scale provided.</p>

      <div className="mt-6 space-y-6">
        <div className="space-y-2">
          <p className="font-medium">Question {currentIndex + 1} of {questions.length}</p>
          <p className="font-semibold">{questions[currentIndex]}</p>

          <div className="mt-3 flex flex-col gap-2">
            {OPTION_LABELS.map((label, i) => (
              <label key={i} className="inline-flex items-center gap-3">
                <input
                  type="radio"
                  name={`q-${currentIndex}`}
                  checked={answers[currentIndex] === i + 1}
                  onChange={() => setAnswer(currentIndex, i + 1)}
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button variant="secondary" onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))} disabled={currentIndex === 0}>Previous</Button>
            <Button onClick={() => setCurrentIndex((i) => Math.min(i + 1, questions.length - 1))} disabled={currentIndex === questions.length - 1}>Next</Button>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button onClick={onSubmit} disabled={loading || !allAnswered}>{loading ? "Saving..." : "Submit"}</Button>
          <Button variant="secondary" onClick={() => navigate('/app')}>Cancel</Button>
        </div>

        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

        {canAdd ? (
          <div className="mt-6 border-t pt-4">
            <h2 className="font-medium">Add question (admin / loan department)</h2>
            <div className="mt-2 flex gap-2">
              <input className="flex-1 p-2 border rounded" value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="New statement" />
              <Button onClick={addQuestion}>Add</Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

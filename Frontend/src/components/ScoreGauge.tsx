import { scoreTone } from "../lib/utils";

export function ScoreGauge({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle cx="70" cy="70" r={radius} stroke="#e2e8f0" strokeWidth="13" fill="none" />
          <circle
            cx="70"
            cy="70"
            r={radius}
            stroke={score >= 75 ? "#10a37f" : score >= 55 ? "#0f92bd" : "#d97706"}
            strokeWidth="13"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-bold ${scoreTone(score)}`}>{score}</span>
          <span className="text-xs font-medium text-muted-foreground">Trust Score</span>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">Current profile</p>
        <p className="mt-1 text-lg font-semibold text-foreground">
          {score >= 75 ? "Strong" : score >= 55 ? "Developing" : "Needs signals"}
        </p>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          A blended view of social guarantees, psychometric responses, behavior data, and bank statement signals.
        </p>
      </div>
    </div>
  );
}

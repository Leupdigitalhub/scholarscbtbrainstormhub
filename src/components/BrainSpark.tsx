import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const LESSONS = [
  { t: "Honesty", b: "A grade earned honestly is worth more than a perfect score gained by cheating." },
  { t: "Discipline", b: "Small daily study beats last-minute cramming. Show up for yourself every day." },
  { t: "Integrity", b: "Integrity is doing the right thing even when no one is watching." },
  { t: "Perseverance", b: "Every expert was once a beginner who refused to give up." },
  { t: "Respect", b: "Treat teachers, classmates and yourself with respect — it opens every door." },
  { t: "Responsibility", b: "Own your mistakes. They are lessons, not failures." },
  { t: "Gratitude", b: "Thank those who teach you. Knowledge is a gift someone chose to share." },
  { t: "Humility", b: "The more you learn, the more you realise how much there is still to know." },
  { t: "Courage", b: "Ask the question you are afraid to ask. That is how understanding begins." },
  { t: "Patience", b: "Great results take time. Keep planting seeds, the harvest will come." },
  { t: "Kindness", b: "Help a classmate understand a topic — teaching it makes you stronger too." },
  { t: "Focus", b: "Put the phone away while studying. One hour of focus beats three distracted ones." },
];

/** Rotating moral lesson that changes every 30 seconds. */
export function BrainSpark() {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(Math.floor(Date.now() / 30000) % LESSONS.length);
    const t = setInterval(() => setI((n) => (n + 1) % LESSONS.length), 30000);
    return () => clearInterval(t);
  }, []);
  const l = LESSONS[i]!;
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border-2 border-warning/50 bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-warning">
        <Sparkles className="h-4 w-4" />Brain Spark · Moral lesson
      </div>
      <div key={i} className="animate-float-up mt-2">
        <p className="font-display text-lg font-extrabold">{l.t}</p>
        <p className="text-sm text-muted-foreground">{l.b}</p>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted"><div key={`b${i}`} className="h-full bg-warning" style={{ animation: "spark-bar 30s linear both" }} /></div>
    </div>
  );
}

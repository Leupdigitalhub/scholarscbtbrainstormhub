import { useState } from "react";
import { Calculator as CalcIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Safe arithmetic evaluator: digits, + - * / % . ( ) only
function evaluate(expr: string): string {
  if (!/^[\d+\-*/%.() ]+$/.test(expr) || expr.trim() === "") return expr;
  try {
    const result = Function(`"use strict"; return (${expr})`)() as number;
    if (typeof result !== "number" || !isFinite(result)) return "Error";
    return String(Math.round(result * 1e10) / 1e10);
  } catch {
    return "Error";
  }
}

const KEYS = [
  ["C", "⌫", "%", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "−"],
  ["1", "2", "3", "+"],
  ["0", ".", "(", ")"],
] as const;

export function Calculator() {
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState("");
  const [justEvaluated, setJustEvaluated] = useState(false);

  const press = (k: string) => {
    if (k === "C") { setExpr(""); setJustEvaluated(false); return; }
    if (k === "⌫") { setExpr((e) => e.slice(0, -1)); setJustEvaluated(false); return; }
    const map: Record<string, string> = { "÷": "/", "×": "*", "−": "-" };
    const v = map[k] ?? k;
    if (justEvaluated && /[\d.(]/.test(v)) { setExpr(v); setJustEvaluated(false); return; }
    setJustEvaluated(false);
    setExpr((e) => e + v);
  };

  const equals = () => {
    setExpr((e) => evaluate(e));
    setJustEvaluated(true);
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open calculator"
        className={cn(
          "fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border shadow-lg transition",
          open ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-accent"
        )}
      >
        {open ? <X className="h-5 w-5" /> : <CalcIcon className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed bottom-40 right-4 z-40 w-64 rounded-2xl border bg-card p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">CALCULATOR</span>
            <button onClick={() => setOpen(false)} aria-label="Close calculator" className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mb-2 min-h-12 overflow-x-auto rounded-lg border bg-background px-3 py-2 text-right font-mono text-xl font-bold tabular-nums">
            {expr || "0"}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {KEYS.flat().map((k) => (
              <button
                key={k}
                onClick={() => press(k)}
                className={cn(
                  "h-10 rounded-lg border text-base font-bold transition active:scale-95",
                  k === "C" || k === "⌫"
                    ? "bg-destructive/10 text-destructive"
                    : ["÷", "×", "−", "+", "%"].includes(k)
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-foreground hover:bg-accent"
                )}
              >
                {k}
              </button>
            ))}
            <button
              onClick={equals}
              className="col-span-4 h-10 rounded-lg bg-primary text-base font-bold text-primary-foreground transition active:scale-95"
            >
              =
            </button>
          </div>
        </div>
      )}
    </>
  );
}

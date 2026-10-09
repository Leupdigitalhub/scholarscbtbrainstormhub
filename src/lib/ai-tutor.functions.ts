import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Row = { id: string; text: string; type: string; subject: string; options: string[]; correct: string; answer: string };

const letter = (opts: string[], l: string) => {
  const i = l ? l.toUpperCase().charCodeAt(0) - 65 : -1;
  return i >= 0 && i < opts.length ? `${l.toUpperCase()}. ${opts[i]}` : l;
};

export const explainMistakes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ attemptId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // my_corrections only returns rows for the student's own attempt when corrections are enabled.
    const { data: rows, error } = await context.supabase.rpc("my_corrections", { _attempt_id: data.attemptId });
    if (error || !rows) return { ok: false as const, message: "Corrections are not available for this exam." };
    const missed = (rows as unknown as Row[]).filter((q) => {
      if (q.type === "written") return false;
      const a = (q.answer ?? "").trim().toLowerCase();
      if (!a) return true;
      if (q.type === "short") return !q.correct.split("|").some((x) => x.trim().toLowerCase() === a);
      return a !== q.correct.toLowerCase();
    }).slice(0, 25);
    if (missed.length === 0) return { ok: true as const, text: "Great work — you didn't miss any questions! Keep practising to stay sharp." };

    const list = missed.map((q, i) => {
      const choice = q.type === "mcq" || q.type === "true_false";
      const opts = q.type === "mcq" ? "\nOptions: " + q.options.map((o, j) => `${String.fromCharCode(65 + j)}. ${o}`).join(" | ") : "";
      const yours = !q.answer ? "Not answered" : choice ? letter(q.options, q.answer) : q.answer;
      const right = choice ? letter(q.options, q.correct) : q.correct.split("|")[0];
      return `Q${i + 1} [${q.subject || "General"}]: ${q.text}${opts}\nStudent answered: ${yours}\nCorrect answer: ${right}`;
    }).join("\n\n");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false as const, message: "AI tutor is not configured." };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        instructions:
          "You are a friendly Nigerian secondary-school tutor helping a student preparing for JAMB/UTME. For each missed question, write a heading 'Question N (Subject)', then a short numbered step-by-step explanation of how to reach the correct answer and why the student's answer was wrong. Keep each explanation under 120 words. Finish with a section 'Study tips' giving 3-5 targeted tips grouped by the weak topics you noticed. Use plain text with simple markdown (headings, numbered lists, bold). No LaTeX.",
        messages: [{ role: "user", content: `Here are the questions I missed:\n\n${list}` }],
        providerOptions: {
          openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] },
        },
      });
      const text = await result.text;
      if (!text.trim()) return { ok: false as const, message: "The AI tutor could not produce an explanation. Please try again later." };
      return { ok: true as const, text };
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      const message = status === 429 ? "The AI tutor is busy. Please try again in a minute."
        : status === 402 || status === 403 ? "The AI tutor is unavailable right now. Please tell your teacher."
        : "Something went wrong with the AI tutor. Please try again later.";
      console.error("explainMistakes", status, e);
      return { ok: false as const, message };
    }
  });

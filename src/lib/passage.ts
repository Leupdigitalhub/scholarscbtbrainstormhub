// Comprehension passages are stored inside the question text so no schema change is needed:
// "⟦P⟧title⟦T⟧passage body⟦/P⟧question text"
const OPEN = "⟦P⟧", MID = "⟦T⟧", CLOSE = "⟦/P⟧";

export function encodePassage(title: string, body: string, question: string) {
  return `${OPEN}${title}${MID}${body}${CLOSE}${question}`;
}

export type Split = { passage: { title: string; body: string } | null; question: string };

export function splitPassage(text: string): Split {
  if (!text?.startsWith(OPEN)) return { passage: null, question: text ?? "" };
  const end = text.indexOf(CLOSE);
  if (end < 0) return { passage: null, question: text };
  const inner = text.slice(OPEN.length, end);
  const mid = inner.indexOf(MID);
  return {
    passage: { title: mid >= 0 ? inner.slice(0, mid) : "", body: mid >= 0 ? inner.slice(mid + MID.length) : inner },
    question: text.slice(end + CLOSE.length),
  };
}

/** Plain question text without the passage, for lists and search. */
export const questionOnly = (text: string) => splitPassage(text).question;

/** "Summary" for summary/cloze blocks, otherwise "Passage". */
export const passageKind = (title: string) => (/summary|cloze/i.test(title) ? "Summary" : "Passage");

/** Question text with a short "[Passage: title]" tag, for admin lists and corrections. */
export const passageLabel = (text: string) => {
  const s = splitPassage(text);
  return s.passage ? `[${s.passage.title || "Passage"}] ${s.question}` : s.question;
};

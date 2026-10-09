// Turns pasted or uploaded text into questions.
//
// Accepted shape (blank line between questions is optional):
//   1. What is 5 x 6?
//   A. 30
//   B. 24
//   C. 12
//   D. 6
//   Answer: A
//
// Also accepts: "Q1)", "Question 1 -", options like "A)" / "(A)" / "a.",
// answer lines like "Ans: B" / "Correct answer: C" / "Correct option - D",
// and a mark label such as "[2 marks]" on the question line.

export type ParsedQ = {
  text: string;
  type: "mcq" | "true_false" | "short";
  options: string[];
  correct_answer: string;
  marks: number;
  explanation?: string;
};

const START = /^\s*(?:q(?:uestion)?\s*)?\d{1,4}\s*[.)\]:-]\s*(.{1,600})$/i;
const OPT = /^\s*[([{]?\s*([A-Ha-h])\s*[).:\]]\s+(.{1,600})$/;
const ANS = /^\s*(?:ans(?:wer)?|correct(?:\s+(?:answer|option))?|right\s+answer)\s*[:\-–—]\s*(.{1,300})$/i;
const EXP = /^\s*(?:explanation|reason|working|solution)\s*[:\-–—]\s*(.*)$/i;
const MARKS = /[[\(]?\s*(\d{1,3}(?:\.\d{1,2})?)\s*marks?\s*[\])]?/i;

const clean = (s: string) =>
  s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

type Block = { lines: string[] };

function toBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let cur: Block | null = null;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    // a blank line finishes the current question
    if (!line.trim()) { cur = null; continue; }
    const isStart = START.test(line) && !OPT.test(line);
    // a numbered line also starts a new question, even without a blank line
    if (!cur || (isStart && cur.lines.length > 0)) {
      cur = { lines: [] };
      blocks.push(cur);
    }
    cur.lines.push(line);
  }
  return blocks;
}

function one(q: ParsedQ): string {
  const opts = q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n");
  return [q.text, opts, `Answer: ${q.correct_answer}`, q.explanation ? `Explanation: ${q.explanation}` : ""].filter(Boolean).join("\n");
}

export function parseQuestions(raw: string): { questions: ParsedQ[]; problems: string[] } {
  const questions: ParsedQ[] = [];
  const problems: string[] = [];

  toBlocks(raw).forEach((b, idx) => {
    const n = idx + 1;
    let text = "";
    const options: string[] = [];
    let answer = "";
    let marks = 1;
    let nextLetter = "A";
    let explanation = "";
    let inExp = false;

    for (const line of b.lines) {
      const ex = EXP.exec(line);
      if (ex) { inExp = true; explanation = clean(ex[1] ?? ""); continue; }
      if (inExp) { explanation = explanation ? `${explanation}\n${clean(line)}` : clean(line); continue; }
      const a = ANS.exec(line);
      if (a && !OPT.test(line)) { answer = clean(a[1] ?? ""); continue; }

      const o = OPT.exec(line);
      if (o && text && (o[1] ?? "").toUpperCase() === nextLetter) {
        options.push(clean(o[2] ?? ""));
        nextLetter = String.fromCharCode(nextLetter.charCodeAt(0) + 1);
        continue;
      }

      if (!text) {
        const s = START.exec(line);
        let body = clean(s ? (s[1] ?? "") : line);
        const m = MARKS.exec(body);
        if (m) {
          marks = Math.max(0.25, Number(m[1] ?? "") || 1);
          body = clean(body.replace(m[0] ?? "", ""));
        }
        text = body;
        continue;
      }
      // extra lines before the options are part of the question (e.g. a passage)
      text = clean(`${text} ${clean(line)}`);
    }

    if (!text) { problems.push(`Item ${n} was skipped: no question text found.`); return; }

    const isTF =
      options.length === 2 &&
      (options[0] ?? "").toLowerCase() === "true" &&
      (options[1] ?? "").toLowerCase() === "false";

    if (!options.length) {
      if (!answer) { problems.push(`"${text.slice(0, 50)}…" was skipped: no correct answer found.`); return; }
      questions.push({ text, type: "short", options: [], correct_answer: answer, marks, explanation });
      return;
    }
    if (options.length < 2) { problems.push(`"${text.slice(0, 50)}…" was skipped: only one option found.`); return; }

    let correct = "";
    if (answer) {
      const t = answer.trim();
      const byLetter = /^([A-Ha-h])\b/.exec(t);
      if (byLetter) {
        const i = (byLetter[1] ?? "").toUpperCase().charCodeAt(0) - 65;
        if (i >= 0 && i < options.length) correct = String.fromCharCode(65 + i);
      }
      if (!correct) {
        const found = options.findIndex((o) => o.toLowerCase() === t.toLowerCase());
        if (found >= 0) correct = String.fromCharCode(65 + found);
      }
      if (!correct) { problems.push(`"${text.slice(0, 50)}…": answer "${t}" does not match any option — marked wrong until you fix it.`); }
    }
    if (!correct) { problems.push(`"${text.slice(0, 50)}…" was skipped: no correct answer found.`); return; }

    if (isTF) {
      questions.push({ text, type: "true_false", options: ["True", "False"], correct_answer: correct === "A" ? "True" : "False", marks, explanation });
    } else {
      questions.push({ text, type: "mcq", options, correct_answer: correct, marks, explanation });
    }
  });

  return { questions, problems };
}

export function sampleText() {
  const q1: ParsedQ = { text: "What is 5 x 6?", type: "mcq", options: ["30", "24", "12", "6"], correct_answer: "A", marks: 1, explanation: "5 groups of 6 make 30." };
  const q2: ParsedQ = { text: "The earth is flat.", type: "true_false", options: ["True", "False"], correct_answer: "False", marks: 1 };
  const q3: ParsedQ = { text: "Who is the capital of Nigeria? [2 marks]", type: "short", options: [], correct_answer: "Abuja", marks: 2 };
  return [q1, q2, q3].map(one).join("\n\n");
}

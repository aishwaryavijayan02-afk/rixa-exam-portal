import type { QuestionItem } from "./examStore";

export type PrintKind = "MCQ" | "Descriptive" | "Diagram";

export interface QuestionCheck {
  kind: PrintKind;
  /** Why the question cannot be printed (empty when it passes). */
  problems: string[];
}

// Instructions that require the student to draw, label or plot something.
const DIAGRAM_PATTERN =
  /\b(draw|sketch|neat (?:diagram|sketch|figure)|with (?:a |the )?(?:diagram|figure|sketch|flow ?chart)|(?:using|by) (?:a )?(?:diagram|flow ?chart)|illustrate (?:with|using)|label(?:led)? (?:the )?(?:diagram|figure|parts)|flow ?chart|block diagram|circuit diagram|plot (?:a|the)|graph(?:ically)?)\b/i;

const cleanOptions = (q: QuestionItem) => (q.options || []).map((o) => String(o || "").trim()).filter(Boolean);

/**
 * Content-based check used before a question can go on a printed paper.
 * The type is read from the question itself, not only from the stored
 * `type` field: 2+ answer options -> MCQ; an image, a "Problem Solving"
 * type or a draw / sketch / label / flowchart instruction -> Diagram;
 * everything else -> Descriptive.
 */
export function checkQuestion(q: QuestionItem): QuestionCheck {
  const text = (q.question || "").trim();
  const options = cleanOptions(q);
  const problems: string[] = [];

  let kind: PrintKind;
  if (options.length >= 2) kind = "MCQ";
  else if (q.imageUrl || (q as { raw?: { imageUrl?: string } }).raw?.imageUrl || q.type === "Problem Solving" || DIAGRAM_PATTERN.test(text)) kind = "Diagram";
  else kind = "Descriptive";

  if (text.length < 10) problems.push("Question text is too short");
  if (q.type === "MCQ" && options.length < 2) problems.push("MCQ has no answer options");
  if (kind === "MCQ" && new Set(options.map((o) => o.toLowerCase())).size < options.length) problems.push("MCQ has duplicate options");

  return { kind, problems };
}

const normalizeText = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Splits questions into printable MCQ / Descriptive / Diagram pools.
 * Questions that fail the check, and repeats of a question already in the
 * same subject, are returned in `rejected` with the reason.
 */
export function sortForPrint(questions: QuestionItem[]) {
  const pools: Record<PrintKind, QuestionItem[]> = { MCQ: [], Descriptive: [], Diagram: [] };
  const rejected: { question: QuestionItem; reason: string }[] = [];
  const seen = new Set<string>();
  questions.forEach((q) => {
    const { kind, problems } = checkQuestion(q);
    if (problems.length) {
      rejected.push({ question: q, reason: problems.join("; ") });
      return;
    }
    const key = `${normalizeText(q.subject || "")}|${normalizeText(q.question || "")}`;
    if (seen.has(key)) {
      rejected.push({ question: q, reason: "Duplicate of another question in this subject" });
      return;
    }
    seen.add(key);
    pools[kind].push(q);
  });
  return { pools, rejected };
}

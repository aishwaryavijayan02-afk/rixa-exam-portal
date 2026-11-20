/**
 * Bloom's Taxonomy compliance checks for staff uploads in the Academic Vault.
 *
 * Question bank: every question must carry an explicit Bloom's level, e.g.
 *   "L1", "K2", "BL3", "BTL4", "Level 5", "(Remember)", or a Bloom column in
 *   a spreadsheet. A bank must also span several levels (not only recall).
 * Syllabus: it must list Course Outcomes (CO1, CO2, ...) and each outcome must
 *   be written with a Bloom's action verb or tagged with a level.
 */

export const BLOOM_LEVELS = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"] as const;
export type BloomLevelName = (typeof BLOOM_LEVELS)[number];

const LEVEL_NAME_TO_NUMBER: Record<string, number> = {
  remember: 1, remembering: 1, knowledge: 1, recall: 1,
  understand: 2, understanding: 2, comprehension: 2,
  apply: 3, applying: 3, application: 3,
  analyze: 4, analyse: 4, analyzing: 4, analysing: 4, analysis: 4,
  evaluate: 5, evaluating: 5, evaluation: 5,
  create: 6, creating: 6, synthesis: 6,
};

/** Standard Bloom's action verbs per level (revised taxonomy). */
const ACTION_VERBS: Record<number, string[]> = {
  1: ["define", "list", "state", "name", "identify", "recall", "recognize", "recognise", "label", "match", "memorize", "outline", "reproduce", "select", "tell", "describe", "write", "mention", "find", "show", "what", "who", "when", "where", "which"],
  2: ["explain", "describe", "discuss", "summarize", "summarise", "classify", "compare", "interpret", "illustrate", "distinguish", "differentiate", "paraphrase", "infer", "predict", "translate", "understand", "demonstrate understanding", "give example", "represent", "relate", "express", "why", "how"],
  3: ["apply", "solve", "use", "compute", "calculate", "determine", "demonstrate", "implement", "execute", "carry out", "construct", "find", "operate", "practice", "prepare", "produce", "sketch", "draw", "modify", "plot", "simulate", "derive", "evaluate the value", "prove", "verify", "employ", "utilize", "utilise", "make use"],
  4: ["analyze", "analyse", "examine", "investigate", "categorize", "categorise", "differentiate", "distinguish", "compare", "contrast", "deconstruct", "inspect", "organize", "organise", "outline", "attribute", "break down", "test", "diagnose", "infer", "relate", "identify the cause"],
  5: ["evaluate", "assess", "justify", "critique", "criticize", "criticise", "judge", "appraise", "argue", "defend", "recommend", "rate", "support", "validate", "prioritize", "prioritise", "conclude", "decide", "select the best", "measure", "review"],
  6: ["create", "design", "develop", "formulate", "construct", "compose", "invent", "plan", "produce", "propose", "generate", "devise", "build", "assemble", "integrate", "combine", "originate", "author", "model", "synthesize", "synthesise", "improve", "innovate"],
};
const ALL_ACTION_VERBS = Array.from(new Set(Object.values(ACTION_VERBS).flat())).sort((a, b) => b.length - a.length);

export const BLOOM_HELP_TEXT =
  "Bloom's format: tag every question with its level — L1 Remember, L2 Understand, L3 Apply, L4 Analyze, L5 Evaluate, L6 Create (K1–K6 or BTL1–BTL6 also accepted).";

export function bloomLevelName(level: number): BloomLevelName {
  return BLOOM_LEVELS[Math.min(6, Math.max(1, level)) - 1];
}

/**
 * Reads an explicit Bloom's level from a question (or a dedicated cell value).
 * Returns 1–6, or null when the text carries no level tag.
 */
export function detectExplicitBloomLevel(text: string): number | null {
  const value = (text || "").trim();
  if (!value) return null;

  // Codes: L1, K2, BL3, BTL4, KL5, CL6 (optionally "L-1", "K 2", "BT 3")
  const code = value.match(/(?:^|[\s(\[|,;:/-])(?:BTL|BT|BL|KL|CL|K|L)\s*[-.]?\s*([1-6])(?=$|[\s)\],;:|./-])/i);
  if (code) return Number(code[1]);

  // "Level 3", "Bloom's Level: 4", "Bloom Level - Apply"
  const levelNumber = value.match(/\b(?:bloom'?s?\s*)?(?:taxonomy\s*)?level\s*[-:]?\s*([1-6])\b/i);
  if (levelNumber) return Number(levelNumber[1]);

  // A level name used as a tag: "(Remember)", "[Apply]", "- Analyze", "Bloom: Create",
  // or the whole cell being the level name.
  const names = Object.keys(LEVEL_NAME_TO_NUMBER).join("|");
  const whole = value.match(new RegExp(`^(?:bloom'?s?\\s*(?:level|taxonomy)?\\s*[-:]?\\s*)?(${names})$`, "i"));
  if (whole) return LEVEL_NAME_TO_NUMBER[whole[1].toLowerCase()];
  const tagged = value.match(new RegExp(`(?:[(\\[]\\s*(${names})\\s*[)\\]])|(?:bloom'?s?\\s*(?:level|taxonomy)?\\s*[-:]\\s*(${names})\\b)|(?:\\|\\s*(${names})\\s*(?:\\||$))`, "i"));
  if (tagged) return LEVEL_NAME_TO_NUMBER[(tagged[1] || tagged[2] || tagged[3]).toLowerCase()];

  return null;
}

/** True when the sentence uses a Bloom's action verb (any level). */
export function hasBloomActionVerb(text: string): boolean {
  const value = ` ${(text || "").toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ")} `;
  return ALL_ACTION_VERBS.some((verb) => value.includes(` ${verb} `));
}

export interface BloomQuestionInput {
  question: string;
  /** Value of a Bloom / BL / BTL / K-level column, when the file has one. */
  bloomCell?: string;
}

export interface BloomCheckResult {
  ok: boolean;
  /** Short reason shown as the dialog title. */
  title: string;
  /** Detailed, staff-facing explanation of what to fix. */
  details: string[];
  /** Detected level (1–6) per question, null when missing. */
  levels: (number | null)[];
}

export function validateQuestionBankBloom(questions: BloomQuestionInput[]): BloomCheckResult {
  const levels = questions.map((q) => detectExplicitBloomLevel(q.bloomCell || "") ?? detectExplicitBloomLevel(q.question));
  const missing = levels.map((level, index) => (level ? -1 : index)).filter((index) => index >= 0);
  const distinct = new Set(levels.filter((level): level is number => Boolean(level)));

  if (questions.length === 0) {
    return { ok: false, title: "No questions found", details: ["The file has no readable questions."], levels };
  }

  if (missing.length > 0) {
    const sample = missing.slice(0, 5).map((index) => {
      const text = questions[index].question.replace(/\s+/g, " ").trim();
      return `Q${index + 1}: “${text.length > 70 ? `${text.slice(0, 70)}…` : text}”`;
    });
    return {
      ok: false,
      title: "Question bank is not in Bloom's Taxonomy format",
      details: [
        `${missing.length} of ${questions.length} questions have no Bloom's level.`,
        ...sample,
        ...(missing.length > sample.length ? [`…and ${missing.length - sample.length} more.`] : []),
        BLOOM_HELP_TEXT,
        "Example: “1  CO1  L2  Explain the working of a transformer.” or add a “Bloom Level” column in Excel.",
        "Please convert the question bank to Bloom's Taxonomy format and upload again.",
      ],
      levels,
    };
  }

  if (questions.length >= 10 && distinct.size < 3) {
    const used = [...distinct].sort().map((level) => `L${level} ${bloomLevelName(level)}`).join(", ");
    return {
      ok: false,
      title: "Bloom's levels are not balanced",
      details: [
        `All ${questions.length} questions use only: ${used}.`,
        "A Bloom's Taxonomy question bank must cover at least 3 different levels (e.g. Remember, Understand, Apply, Analyze …).",
        "Please add higher-order questions and upload again.",
      ],
      levels,
    };
  }

  return { ok: true, title: "Bloom's Taxonomy verified", details: [], levels };
}

export function validateSyllabusBloom(text: string): BloomCheckResult {
  const lines = (text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // "CO1: Explain …", "CO 2 - Apply …", "CO3. …"; continuation lines are joined.
  const outcomes: { label: string; text: string }[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^(?:\(?\s*)(CO\s*[-.]?\s*\d{1,2})\s*\)?\s*[:.)\-–—]?\s*(.*)$/i);
    if (!match) continue;
    let body = match[2].trim();
    if (body.length < 12 && lines[i + 1] && !/^(?:CO\s*\d|unit\b|module\b)/i.test(lines[i + 1])) body = `${body} ${lines[i + 1]}`.trim();
    if (body.length < 5) continue;
    outcomes.push({ label: match[1].replace(/\s|[-.]/g, "").toUpperCase(), text: body });
  }

  if (outcomes.length === 0) {
    return {
      ok: false,
      title: "Syllabus is not in Bloom's Taxonomy format",
      details: [
        "No Course Outcomes (CO1, CO2, …) were found in this syllabus.",
        "A Bloom's Taxonomy syllabus must list Course Outcomes written with Bloom's action verbs, e.g.:",
        "CO1: Define the basic concepts of … (L1 Remember)",
        "CO2: Explain … (L2 Understand)   CO3: Apply … (L3 Apply)",
        "Please add Course Outcomes in Bloom's format and upload again.",
      ],
      levels: [],
    };
  }

  const weak = outcomes.filter((co) => detectExplicitBloomLevel(co.text) === null && !hasBloomActionVerb(co.text));
  if (weak.length > 0) {
    return {
      ok: false,
      title: "Course Outcomes are not in Bloom's Taxonomy format",
      details: [
        `${weak.length} of ${outcomes.length} Course Outcomes do not use a Bloom's action verb or level:`,
        ...weak.slice(0, 5).map((co) => `${co.label}: “${co.text.length > 70 ? `${co.text.slice(0, 70)}…` : co.text}”`),
        "Start each outcome with a Bloom's verb — Define, Explain, Apply, Analyze, Evaluate, Design … — or tag it with L1–L6.",
        "Please correct the Course Outcomes and upload again.",
      ],
      levels: outcomes.map((co) => detectExplicitBloomLevel(co.text)),
    };
  }

  return { ok: true, title: "Bloom's Taxonomy verified", details: [], levels: outcomes.map((co) => detectExplicitBloomLevel(co.text)) };
}

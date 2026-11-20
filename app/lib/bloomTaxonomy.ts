/**
 * Bloom's Taxonomy conversion for question banks uploaded to the Academic Vault.
 *
 * Staff may upload a question bank in any layout. After upload every question
 * is converted to the Bloom's Taxonomy pattern:
 *   - its Bloom's level comes from an explicit tag when the file has one
 *     ("L1", "K2", "BTL4", "Level 5", "(Remember)", a Bloom column in Excel),
 *     otherwise it is inferred from the question's action verb;
 *   - questions are arranged unit-wise, MCQs first and Descriptive after,
 *     each ordered from L1 Remember up to L6 Create.
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

/** Bloom's action verbs (revised taxonomy); each verb belongs to one level. */
const ACTION_VERBS: Record<number, string[]> = {
  1: ["define", "list", "state", "name", "identify", "recall", "recognize", "recognise", "label", "match", "memorize", "mention", "write", "enumerate", "tabulate", "what", "who", "when", "where", "which", "fill in", "choose", "true or false", "expand", "abbreviate"],
  2: ["explain", "describe", "discuss", "summarize", "summarise", "classify", "interpret", "illustrate", "outline", "paraphrase", "give an example", "give examples", "give example", "represent", "express", "elaborate", "indicate", "why", "how", "brief", "short note", "notes on", "translate", "predict", "understand"],
  3: ["apply", "solve", "use", "compute", "calculate", "determine", "demonstrate", "implement", "execute", "carry out", "construct", "find", "sketch", "draw", "plot", "derive", "prove", "verify", "show that", "estimate", "simulate", "convert", "employ", "utilize", "utilise", "make use", "modify", "operate", "prepare", "write a program", "write a query"],
  4: ["analyze", "analyse", "examine", "investigate", "compare", "contrast", "differentiate", "distinguish", "categorize", "categorise", "deconstruct", "inspect", "infer", "break down", "relate", "organize", "organise", "attribute", "diagnose", "identify the cause", "trace"],
  5: ["evaluate", "assess", "justify", "critique", "criticize", "criticise", "judge", "appraise", "argue", "defend", "recommend", "validate", "prioritize", "prioritise", "conclude", "decide", "comment on", "rate", "review", "select the best", "support your answer"],
  6: ["create", "design", "develop", "formulate", "compose", "invent", "plan", "propose", "generate", "devise", "build", "assemble", "integrate", "synthesize", "synthesise", "originate", "innovate", "improve", "construct a model"],
};

const VERB_TO_LEVEL: [string, number][] = Object.entries(ACTION_VERBS)
  .flatMap(([level, verbs]) => verbs.map((verb) => [verb, Number(level)] as [string, number]))
  // Longer phrases first so "write a program" beats "write".
  .sort((a, b) => b[0].length - a[0].length);

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

  // "Level 3", "Bloom's Level: 4"
  const levelNumber = value.match(/\b(?:bloom'?s?\s*)?(?:taxonomy\s*)?level\s*[-:]?\s*([1-6])\b/i);
  if (levelNumber) return Number(levelNumber[1]);

  // A level name used as a tag: "(Remember)", "[Apply]", "Bloom: Create",
  // or the whole cell being the level name.
  const names = Object.keys(LEVEL_NAME_TO_NUMBER).join("|");
  const whole = value.match(new RegExp(`^(?:bloom'?s?\\s*(?:level|taxonomy)?\\s*[-:]?\\s*)?(${names})$`, "i"));
  if (whole) return LEVEL_NAME_TO_NUMBER[whole[1].toLowerCase()];
  const tagged = value.match(new RegExp(`(?:[(\\[]\\s*(${names})\\s*[)\\]])|(?:bloom'?s?\\s*(?:level|taxonomy)?\\s*[-:]\\s*(${names})\\b)|(?:\\|\\s*(${names})\\s*(?:\\||$))`, "i"));
  if (tagged) return LEVEL_NAME_TO_NUMBER[(tagged[1] || tagged[2] || tagged[3]).toLowerCase()];

  return null;
}

/**
 * Infers a Bloom's level from the action verb a question uses. The verb that
 * appears earliest in the question wins ("Define and explain …" → Remember);
 * when two start at the same place the higher level wins. Returns null when
 * the question has no recognisable action verb.
 */
export function inferBloomLevel(text: string): number | null {
  const value = ` ${(text || "").toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim()} `;
  let best: { position: number; level: number } | null = null;
  for (const [verb, level] of VERB_TO_LEVEL) {
    const position = value.indexOf(` ${verb} `);
    if (position < 0) continue;
    if (!best || position < best.position || (position === best.position && level > best.level)) best = { position, level };
  }
  return best ? best.level : null;
}

/** Removes Bloom / CO tags ("CO1 L2", "(BTL3)", "[Apply]") around the question text. */
export function stripBloomTags(text: string): string {
  const names = Object.keys(LEVEL_NAME_TO_NUMBER).join("|");
  const tag = `(?:CO\\s*\\d{1,2}|(?:BTL|BT|BL|KL|CL|K|L)\\s*[-.]?\\s*[1-6])`;
  return (text || "")
    .replace(new RegExp(`^(?:\\s*[(\\[]?\\s*${tag}\\s*[)\\]]?\\s*[,|/:-]?)+\\s+`, "i"), "")
    .replace(new RegExp(`(?:\\s*[(\\[]\\s*(?:${tag}|${names})\\s*[)\\]])+\\s*$`, "i"), "")
    .replace(new RegExp(`(?:\\s+[|,/-]?\\s*${tag})+\\s*$`, "i"), "")
    .trim();
}

const ROMAN: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
function romanToNumber(value: string): number {
  let total = 0;
  for (let i = 0; i < value.length; i += 1) {
    const current = ROMAN[value[i]] || 0;
    const next = ROMAN[value[i + 1]] || 0;
    total += current < next ? -current : current;
  }
  return total;
}

/** "Unit III - Thermodynamics" → 3, "2" → 2, "Module 4" → 4; unknown → 99. */
export function unitNumber(unit: string | undefined): number {
  const value = (unit || "").trim().toLowerCase();
  const match = value.match(/^(?:unit|module|chapter)?\s*[-:]?\s*(\d+|[ivxlcdm]+)\b/);
  if (!match) return 99;
  const n = /^\d+$/.test(match[1]) ? Number(match[1]) : romanToNumber(match[1]);
  return n > 0 ? n : 99;
}

interface BloomConvertible {
  question: string;
  type?: string;
  unit?: string;
  options?: string[];
  marks?: number;
  bloomLevel?: string;
  /** Value of a Bloom / BL / BTL / K-level column, when the file has one. */
  bloomCell?: string;
}

/**
 * Converts any parsed question bank to the Bloom's Taxonomy pattern: assigns a
 * Bloom's level to every question, splits questions into MCQ and Descriptive,
 * and orders them unit-wise (MCQ before Descriptive, L1 → L6 within each).
 */
export function convertToBloomPattern<T extends BloomConvertible>(questions: T[]): (T & { type: "MCQ" | "Descriptive"; bloomLevel: BloomLevelName })[] {
  const converted = questions.map((q, index) => {
    const hasOptions = (q.options || []).filter((option) => option && option.trim()).length >= 2;
    const type: "MCQ" | "Descriptive" = hasOptions || /mcq|multiple[\s-]*choice|objective/i.test(q.type || "") ? "MCQ" : "Descriptive";
    const level =
      detectExplicitBloomLevel(q.bloomCell || "") ??
      detectExplicitBloomLevel(q.bloomLevel || "") ??
      detectExplicitBloomLevel(q.question) ??
      inferBloomLevel(q.question) ??
      (type === "MCQ" ? 1 : (q.marks || 0) >= 10 ? 4 : 2);
    const { bloomCell: _bloomCell, ...rest } = q;
    void _bloomCell;
    return {
      item: {
        ...rest,
        question: stripBloomTags(q.question) || q.question,
        options: hasOptions ? q.options : undefined,
        type,
        bloomLevel: bloomLevelName(level),
      } as unknown as T & { type: "MCQ" | "Descriptive"; bloomLevel: BloomLevelName },
      unit: unitNumber(q.unit),
      level,
      index,
    };
  });

  converted.sort(
    (a, b) =>
      a.unit - b.unit ||
      (a.item.type === b.item.type ? 0 : a.item.type === "MCQ" ? -1 : 1) ||
      a.level - b.level ||
      a.index - b.index,
  );
  return converted.map((entry) => entry.item);
}

/** Groups converted questions as Unit → { MCQ, Descriptive } for display. */
export function groupByUnitAndType<T extends { unit?: string; type?: string }>(questions: T[]) {
  const units = new Map<string, { unit: string; mcq: T[]; descriptive: T[] }>();
  questions.forEach((q) => {
    const n = unitNumber(q.unit);
    const key = n === 99 ? q.unit || "General" : `Unit ${n}`;
    const group = units.get(key) || { unit: n === 99 ? key : (q.unit && /[-–—:]/.test(q.unit) ? q.unit : key), mcq: [], descriptive: [] };
    (q.type === "MCQ" ? group.mcq : group.descriptive).push(q);
    units.set(key, group);
  });
  return [...units.values()];
}

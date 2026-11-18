import JSZip from "jszip";

export interface ParsedCourseOutcome {
  code: string;
  description: string;
}

export interface ParsedSyllabusUnit {
  id: string;
  num: string;
  name: string;
  topicsCount: number;
  subtopics: string[];
  coMapping: string[];
}

export interface ParsedSyllabusResult {
  subjectName?: string;
  subjectCode?: string;
  department?: string;
  semester?: string;
  courseOutcomes: ParsedCourseOutcome[];
  units: ParsedSyllabusUnit[];
  rawTextPreview: string;
}

/**
 * Unzips and extracts plain text from a .docx file using JSZip and DOMParser.
 */
export async function extractDocxText(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Search for word/document.xml (or main document file)
    let docFile = zip.file("word/document.xml");
    if (!docFile) {
      const files = zip.file(/word\/document\d*\.xml/i);
      if (files && files.length > 0) {
        docFile = files[0];
      }
    }

    if (!docFile) {
      console.warn("No word/document.xml entry found in DOCX zip archive.");
      return "";
    }

    const xmlContent = await docFile.async("string");
    if (!xmlContent) return "";

    // 1. Use DOMParser if available in browser environment
    if (typeof DOMParser !== "undefined") {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, "application/xml");
      const body = xmlDoc.getElementsByTagName("w:body")[0];
      const lines: string[] = [];

      // Text of a paragraph in document order. Tab stops (<w:tab/>) are kept as
      // "\t" so tab-aligned rows (e.g. a mark-distribution list typed with Tab
      // keys instead of a Word table) can still be shown as table columns.
      const paragraphText = (p: Element) => {
        let pText = "";
        const nodes = p.getElementsByTagName("*");
        for (let j = 0; j < nodes.length; j++) {
          const name = nodes[j].nodeName;
          if (name === "w:t") pText += nodes[j].textContent || "";
          else if (name === "w:tab" && nodes[j].parentNode?.nodeName === "w:r") pText += "\t";
        }
        return pText
          .replace(/[^\S\t]+/g, " ")
          .replace(/ *\t[\t ]*/g, "\t")
          .replace(/^\t+|\t+$/g, "")
          .trim();
      };

      const childElements = (el: Element, name: string) =>
        Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1 && (n as Element).nodeName === name);

      // Tables become one line per row with cells separated by TAB, so the
      // preview can rebuild the grid (e.g. CO-PO mapping) instead of showing
      // every cell on its own line.
      const tableLines = (tbl: Element) => {
        childElements(tbl, "w:tr").forEach((tr) => {
          const cells: string[] = [];
          childElements(tr, "w:tc").forEach((tc) => {
            const text = Array.from(tc.getElementsByTagName("w:p"))
              .map(paragraphText)
              .filter(Boolean)
              .join(" ");
            cells.push(text.replace(/\t/g, " "));
            const span = tc.getElementsByTagName("w:gridSpan")[0];
            const spanCount = Number(span?.getAttribute("w:val") || 1);
            for (let s = 1; s < spanCount; s++) cells.push("");
          });
          if (cells.some(Boolean)) lines.push(cells.join("\t"));
        });
        lines.push("");
      };

      const walk = (container: Element) => {
        Array.from(container.childNodes).forEach((node) => {
          if (node.nodeType !== 1) return;
          const el = node as Element;
          if (el.nodeName === "w:p") {
            const text = paragraphText(el);
            if (text) lines.push(text);
          } else if (el.nodeName === "w:tbl") {
            tableLines(el);
          } else if (el.nodeName === "w:sdt" || el.nodeName === "w:sdtContent" || el.nodeName === "w:customXml") {
            walk(el);
          }
        });
      };

      if (body) walk(body);

      if (lines.some((l) => l.trim())) {
        return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
      }
    }

    // 2. Fallback regex approach targeting <w:p> and <w:t> tags
    const paragraphMatches = xmlContent.match(/<w:p\b[^>]*>(.*?)<\/w:p>/gi);
    if (paragraphMatches && paragraphMatches.length > 0) {
      const lines: string[] = [];
      for (const pXml of paragraphMatches) {
        const wtMatches = pXml.match(/<w:t\b[^>]*>(.*?)<\/w:t>/gi);
        if (wtMatches) {
          const pText = wtMatches
            .map((t) => t.replace(/<[^>]+>/g, "").trim())
            .join("");
          if (pText.trim()) {
            lines.push(pText.trim());
          }
        }
      }
      if (lines.length > 0) {
        return lines.join("\n");
      }
    }

    // 3. Fallback targeting all <w:t> tags directly
    const wtMatches = xmlContent.match(/<w:t\b[^>]*>(.*?)<\/w:t>/gi);
    if (wtMatches) {
      return wtMatches
        .map((t) => t.replace(/<[^>]+>/g, "").trim())
        .filter(Boolean)
        .join("\n");
    }
  } catch (err) {
    console.error("extractDocxText via JSZip failed:", err);
  }

  return "";
}

/**
 * Main file text extractor handling DOCX, PDF, and plain text formats.
 */
/** Reads the cell text of an .xlsx workbook (shared strings + inline strings). */
export async function extractXlsxText(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const parts: string[] = [];
    const files = [zip.file("xl/sharedStrings.xml"), ...zip.file(/xl\/worksheets\/sheet\d*\.xml/i)].filter(Boolean);
    for (const entry of files) {
      const xml = await entry!.async("string");
      for (const match of xml.matchAll(/<t[^>]*>([^<]*)<\/t>/g)) parts.push(match[1]);
    }
    return parts.join("\n").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  } catch {
    return "";
  }
}

export interface SubjectCandidate {
  code: string;
  name: string;
}

/**
 * Finds which known subject an uploaded document belongs to, using the file
 * name and the document text. A subject code (e.g. "VIS-301", "VIS 301",
 * "VIS301") wins over a name match; among name matches the longest wins.
 */
export function detectSubjectFromDocument<T extends SubjectCandidate>(
  fileName: string,
  text: string,
  subjects: readonly T[],
): T | null {
  const baseName = fileName.replace(/\.[^/.]+$/, "");
  const haystack = `${baseName}\n${text || ""}`;
  // "&" and "and" are dropped so "Cinematography & Lighting" matches
  // "Cinematography_Lighting" and "Cinematography and Lighting".
  const flat = (value: string) => value.toLowerCase().replace(/&/g, " ").replace(/\band\b/g, " ").replace(/[^a-z0-9]+/g, "");

  let best: { subject: T; position: number } | null = null;
  for (const subject of subjects) {
    const [prefix, number] = subject.code.split(/[-\s]+/);
    if (!prefix || !number) continue;
    const pattern = new RegExp(`(^|[^a-z0-9])${prefix}[\\s\\-_]*${number}(?![0-9])`, "i");
    const found = pattern.exec(haystack);
    if (found && (!best || found.index < best.position)) best = { subject, position: found.index };
  }
  if (best) return best.subject;

  const flatHaystack = flat(haystack);
  let byName: T | null = null;
  for (const subject of subjects) {
    const key = flat(subject.name);
    if (key.length >= 6 && flatHaystack.includes(key) && (!byName || key.length > flat(byName.name).length)) byName = subject;
  }
  return byName;
}

export interface SubjectHeader {
  name: string;
  code: string;
  /** True when no code was written in the document and one was derived from the name. */
  codeGenerated: boolean;
  semester?: string;
  /** Department written in the document, e.g. "Mathematics" (without "Department of"). */
  department?: string;
}

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(And|Of|In|For|The|&)\b/g, (m) => m.toLowerCase())
    .replace(/^./, (m) => m.toUpperCase());

/** "DEPARTMENT OF MATHEMATICS" / "Dept. of Computer Science" -> "Mathematics" / "Computer Science". */
export function cleanDepartmentName(value: string): string {
  const cleaned = (value || "")
    .replace(/^(?:the\s+)?(?:department|dept\.?)\s+of\s+/i, "")
    .replace(/^(?:diploma|bachelor(?:'s)?|master(?:'s)?|b\.?\s?sc\.?|m\.?\s?sc\.?|b\.?\s?e\.?|b\.?\s?tech\.?|m\.?\s?tech\.?|b\.?\s?a\.?|m\.?\s?a\.?|b\.?\s?com\.?|m\.?\s?com\.?|bca|mca|bba|mba)\s+(?:of\s+|in\s+)?/i, "")
    .replace(/\s*(?:\(|,|\||-\s|–|—|\bsemester\b|\bcourse\b|\bregulation\b|\bscheme\b|\byear\b).*$/i, "")
    .replace(/[^a-zA-Z&\s.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned.length < 3 || cleaned.split(" ").length > 6) return "";
  if (/^[A-Z&.]{2,5}$/.test(cleaned)) return cleaned; // acronym such as "MBA", "ECE"
  return cleaned === cleaned.toUpperCase() || cleaned === cleaned.toLowerCase() ? titleCase(cleaned) : cleaned;
}

const DEPARTMENT_KEYWORDS: Array<[RegExp, string]> = [
  [/\b(math|mathematics|calculus|algebra|statistics|trigonometry|geometry|differential|integral|probability)\b/i, "Mathematics"],
  [/\b(physics|mechanics|optics|thermodynamics|electromagnet)/i, "Physics"],
  [/\b(chemistry|chemical|organic|inorganic)\b/i, "Chemistry"],
  [/\b(computer|programming|software|data structures?|algorithms?|database|operating systems?|java|python|c\+\+|web|network|artificial intelligence|machine learning|cyber)\b/i, "Computer Science"],
  [/\b(english|communication skills|literature|grammar)\b/i, "English"],
  [/\b(commerce|accounting|accountancy|taxation|banking|auditing)\b/i, "Commerce"],
  [/\b(management|marketing|finance|business|economics|entrepreneurship|hrm)\b/i, "Management"],
  [/\b(biology|botany|zoology|microbiology|biotechnology|biochemistry)\b/i, "Life Sciences"],
  [/\b(electrical|electronics|circuits?|signals?|microprocessor|embedded)\b/i, "Electronics"],
  [/\b(mechanical|manufacturing|machine design|fluid|automobile)\b/i, "Mechanical Engineering"],
  [/\b(civil|surveying|structural|construction)\b/i, "Civil Engineering"],
  [/\b(fashion|textile|apparel|garment)\b/i, "Fashion Design"],
  [/\b(visual|cinematography|animation|graphic design|photography|vfx|film|media)\b/i, "Visual Communication"],
  [/\b(psychology|sociology|history|political|philosophy)\b/i, "Humanities"],
];

/** Best-guess department for a subject name when the document does not state one. */
export function inferDepartmentFromSubject(subjectName: string): string {
  const match = DEPARTMENT_KEYWORDS.find(([pattern]) => pattern.test(subjectName || ""));
  return match ? match[1] : "";
}

const FILENAME_NOISE = new Set([
  "syllabus", "syllabi", "unit", "units", "wise", "unitwise", "co", "cos", "po", "pos", "scheme", "k", "i", "regulation", "reg",
  "outline", "curriculum", "course", "final", "revised", "updated", "draft", "copy", "new", "latest", "v", "ver", "version", "doc", "docx", "pdf",
  "question", "questions", "bank", "qb", "paper", "papers", "mcq", "mcqs", "set", "test", "upload", "file", "xlsx", "xls",
  "ques", "qns", "bloom", "blooms", "bloom's", "taxonomy", "answer", "answers", "key", "no", "with", "without", "only", "level", "levels",
]);

/**
 * Reads a syllabus' own subject name and code: labelled fields in the document
 * first ("Course Code: 22MA101", "Course Title: Basic Mathematics", including
 * label/value table cells), then the file name. When the document has no code,
 * a stable one is derived from the name's initials (e.g. "BM-101").
 */
export function extractSubjectHeader(fileName: string, text: string): SubjectHeader | null {
  const lines = (text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 80);
  const cellsOf = (line: string) => line.split("\t").map((cell) => cell.trim());
  const codeLabel = /^(?:course|subject|paper)\s*code\b|^code$/i;
  const nameLabel = /^(?:course|subject|paper)\s*(?:name|title)\b|^(?:subject|course|paper|title)$/i;
  const codeToken = /\b([A-Z]{0,3}\d{2}[A-Z]{2,5}\d{2,4}[A-Z]?|[A-Z]{2,5}[-\s]?\d{3,4}[A-Z]?)\b/;
  // Labelled values may also be purely numeric (e.g. MSBTE K-scheme "312301").
  const labelledCodeToken = new RegExp(`${codeToken.source}|\\b(\\d{5,7})\\b`);
  const cleanValue = (value: string) => value.replace(/^[\s:\-–—=]+/, "").trim();

  let name = "";
  let code = "";
  let semester = "";
  let department = "";
  const departmentLabel = /^(?:department|dept\.?|programme|program|branch|discipline)(?:\s*name)?$/i;
  for (const line of lines) {
    if (!department) {
      // Heading such as "DEPARTMENT OF MATHEMATICS" anywhere in the header lines.
      const heading = line.replace(/\t/g, " ").match(/\b(?:department|dept\.?)\s+of\s+([A-Za-z&.\s]{3,60})/i);
      if (heading) department = cleanDepartmentName(heading[1]);
    }
    const cells = cellsOf(line);
    cells.forEach((cell, index) => {
      const inline = cell.match(/^([A-Za-z ]{3,24}?)\s*[:\-–—]\s*(.+)$/);
      const label = inline ? inline[1].trim() : cell.replace(/[:\-–—]+$/, "").trim();
      const value = cleanValue(inline ? inline[2] : cells.slice(index + 1).find(Boolean) || "");
      if (!value) return;
      if (!code && codeLabel.test(label)) {
        const token = value.toUpperCase().match(labelledCodeToken);
        if (token) code = (token[1] || token[2]).replace(/\s+/g, "-");
      } else if (!name && nameLabel.test(label) && /[a-z]{3,}/i.test(value)) {
        name = cleanSubjectName(value).replace(/\s*\([^)]*\)\s*$/, "").trim();
      } else if (!department && departmentLabel.test(label)) {
        department = cleanDepartmentName(value);
      } else if (!semester && /^semester$|^sem$/i.test(label)) {
        const number = value.match(/\b([1-8]|i{1,3}|iv|v|vi{0,3})\b/i);
        if (number) {
          const roman: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8" };
          semester = `Semester ${roman[number[1].toLowerCase()] || number[1]}`;
        }
      }
    });
    if (name && code && semester && department) break;
  }

  if (!name) {
    const words = fileName
      .replace(/\.[^/.]+$/, "")
      .split(/[\s_\-.]+/)
      .filter((word) => !new RegExp(`^${codeToken.source}$`).test(word.toUpperCase()))
      // "100ques" -> "ques" (then dropped as filler)
      .map((word) => (/^\d+[a-z]/i.test(word) ? word.replace(/^\d+/, "") : word))
      .filter((word) => word && !FILENAME_NOISE.has(word.toLowerCase()) && !/^\d+$/.test(word));
    name = words.map((word) => (word === word.toUpperCase() && word.length > 3 ? word[0] + word.slice(1).toLowerCase() : word)).join(" ").trim();
  }
  if (!code) {
    const fromName = fileName.toUpperCase().match(codeToken);
    if (fromName) code = fromName[1].replace(/\s+/g, "-");
  }
  if (!name) return null;

  let codeGenerated = false;
  if (!code) {
    const initials = name.split(/\s+/).filter((word) => /^[a-z]/i.test(word) && !/^(and|of|the|for|in|to|&)$/i.test(word)).map((word) => word[0].toUpperCase()).join("").slice(0, 4);
    code = `${initials || "SUB"}-101`;
    codeGenerated = true;
  }
  return { name, code, codeGenerated, semester: semester || undefined, department: department || undefined };
}

export async function extractFileText(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  // 0. Excel workbook cell text
  if (fileName.endsWith(".xlsx")) {
    const xlsxText = await extractXlsxText(arrayBuffer);
    if (xlsxText.trim().length > 0) return xlsxText;
  }

  // 1. DOCX Handling
  if (fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
    const docxText = await extractDocxText(arrayBuffer);
    if (docxText && docxText.trim().length > 0) {
      return docxText;
    }
  }

  // 2. PDF Handling
  if (fileName.endsWith(".pdf")) {
    const rawText = new TextDecoder("utf-8", { fatal: false }).decode(arrayBuffer);
    const pdfStrings = rawText.match(/\(([^()]{2,})\)/g);
    if (pdfStrings && pdfStrings.length > 0) {
      const pdfText = pdfStrings
        .map((s) => s.slice(1, -1).trim())
        .filter((s) => s.length > 2 && /[a-zA-Z0-9]/.test(s))
        .join("\n");
      if (pdfText.length > 20) {
        return pdfText;
      }
    }
  }

  // 3. Binary protection check: Never decode raw binary ZIP/PDF data as text
  const firstBytes = new Uint8Array(arrayBuffer.slice(0, 10));
  const isZip = firstBytes[0] === 0x50 && firstBytes[1] === 0x4b; // 'PK' signature
  const isPdf = firstBytes[0] === 0x25 && firstBytes[1] === 0x50; // '%P' signature

  if (isZip || isPdf) {
    console.warn("File is binary (ZIP/PDF) but no readable text could be decompressed.");
    return "";
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(arrayBuffer);
}

/**
 * Cleans raw document text, removing XML tags, binary artifacts, and garbled symbols.
 */
export function cleanRawSyllabusText(text: string): string {
  if (!text) return "";

  // 1. Strip XML/HTML tags
  let cleaned = text.replace(/<[^>]+>/g, "\n");

  // 2. Remove null bytes and non-printable control characters
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, " ");

  // 3. Filter lines strictly
  const lines = cleaned.split(/\r?\n/);
  const validLines = lines
    .map((l) => l.trim())
    .filter((l) => {
      if (l.length < 2) return false;

      // Reject binary zip headers, xml noise, rels, fontTable, base64 strings, garbled symbols
      if (/^PK[\s\x00-\x20]*/i.test(l)) return false;
      if (/word\/(?:header|footer|theme|fontTable|styles|settings|numbering|rels|customXML|itemProps)/i.test(l)) return false;
      if (/xmlns:w=|schemas\.openxmlformats|xmlVersion|standalone=/i.test(l)) return false;
      if (l.includes("\uFFFD") || l.includes("9heKnHkiYMR") || l.includes("totcR2Iq") || l.includes("itemProps1")) return false;
      if (/^[a-zA-Z0-9+\/=]{30,}$/.test(l)) return false;

      // Filter out lines where readable characters (letters, numbers, basic punctuation) are less than 70%
      const cleanChars = l.replace(/[^a-zA-Z0-9\s,\.\-\:\(\)\[\]\/\&]/g, "");
      if (cleanChars.length / l.length < 0.7) return false;

      // Must contain at least one English or language word (2+ letters)
      if (!/[a-zA-Z\u0B80-\u0BFF]{2,}/.test(l)) return false;

      return true;
    });

  return validLines.join("\n");
}

/**
 * Helper to clean individual title strings from garbled noise.
 */
function sanitizeCleanTitle(title: string, defaultFallback: string): string {
  if (!title) return defaultFallback;
  let clean = title.replace(/[^a-zA-Z0-9\s,\.\-\:\(\)\/\&]/g, "").trim();

  // Reject if contains garbled indicators or has fewer than 3 letters
  if (
    clean.includes("PK") ||
    clean.includes("word/") ||
    clean.includes("9heKnHkiYMR") ||
    clean.includes("itemProps") ||
    clean.includes("fontTable") ||
    !/[a-zA-Z]{3,}/.test(clean)
  ) {
    return defaultFallback;
  }

  return clean;
}

/**
 * Strips metadata like Course Code, L-T-P, Credits, Hours, etc. from extracted subject names
 */
export function cleanSubjectName(name: string): string {
  if (!name) return "";
  let clean = name
    .replace(/(?:Course\s*Code|Course\s*ID|Subject\s*Code|Code|L\-?T\-?P|Credits?|Total\s*Hours?|Hours?|Semester|Regulation|Department|Dept)[\s:\-_].*$/i, "")
    .replace(/[\s\-_:=_]+$/, "")
    .trim();
  return clean || name;
}

/**
 * Main parser function to process syllabus text and extract curriculum elements
 */
export function parseSyllabusDocument(
  fileName: string,
  rawText: string
): ParsedSyllabusResult {
  const sanitizedText = cleanRawSyllabusText(rawText);

  const lines = sanitizedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let detectedSubjectName = "";
  let detectedSubjectCode = "";
  let detectedDept = "";
  let detectedSemester = "";

  const courseOutcomes: ParsedCourseOutcome[] = [];
  const units: ParsedSyllabusUnit[] = [];

  // Helper regex patterns
  const coRegex = /^(?:CO\s*(\d+)|Course\s*Outcome\s*(\d+))[\s:\-\.]*(.*)/i;
  const unitRegex = /^(?:UNIT|MODULE|CHAPTER)[\s\-\.:]*([I|V|X|\d]+)[\s\-\.:]*(.*)/i;
  const codeRegex = /\b([0-9]{2}[A-Z]{2,6}[0-9]{3,4}|[A-Z]{2,4}[0-9]{3,4})\b/;

  let currentUnit: ParsedSyllabusUnit | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Detect Subject Code & Name from Header Lines
    if (!detectedSubjectCode) {
      const explicitCodeMatch = line.match(/(?:Course\s*Code|Subject\s*Code|Code)[\s:\-_]*([0-9]{2}[A-Z]{2,6}[0-9]{3,4}|[A-Z]{2,4}[0-9]{3,4})/i);
      if (explicitCodeMatch) {
        detectedSubjectCode = explicitCodeMatch[1].toUpperCase();
      } else {
        const codeMatch = line.match(codeRegex);
        if (codeMatch) {
          detectedSubjectCode = codeMatch[1];
        }
      }
    }

    if (!detectedSubjectName) {
      if (/subject\s*:\s*(.*)/i.test(line)) {
        detectedSubjectName = cleanSubjectName(line.replace(/subject\s*:\s*/i, "").trim());
      } else if (/course\s*title\s*:\s*(.*)/i.test(line)) {
        detectedSubjectName = cleanSubjectName(line.replace(/course\s*title\s*:\s*/i, "").trim());
      } else if (/syllabus\s*for\s*(.*)/i.test(line)) {
        detectedSubjectName = cleanSubjectName(line.replace(/syllabus\s*for\s*/i, "").trim());
      } else if (/^course(?:\s*name)?\s*:\s*(.*)/i.test(line)) {
        detectedSubjectName = cleanSubjectName(line.replace(/^course(?:\s*name)?\s*:\s*/i, "").trim());
      } else if (i === 0 && line.length < 100 && !/^unit/i.test(line) && !/^co\d/i.test(line)) {
        const possibleName = cleanSubjectName(line);
        if (possibleName && possibleName.length > 3 && /[a-zA-Z]{3,}/.test(possibleName)) {
          detectedSubjectName = possibleName;
        }
      }
    }

    if (!detectedDept && /department\s*:\s*(.*)/i.test(line)) {
      detectedDept = line.replace(/department\s*:\s*/i, "").trim();
    }

    if (!detectedSemester && /semester\s*:\s*(.*)/i.test(line)) {
      detectedSemester = line.replace(/semester\s*:\s*/i, "").trim();
    }

    // 2. Detect Course Outcomes (COs)
    const coMatch = line.match(coRegex);
    if (coMatch) {
      const coNum = coMatch[1] || coMatch[2];
      const coCode = `CO${coNum}`;
      const rawDesc = coMatch[3] ? coMatch[3].trim() : `Course Outcome ${coNum}`;
      const coDesc = sanitizeCleanTitle(rawDesc, `Course Outcome ${coNum}`);
      if (!courseOutcomes.some((c) => c.code === coCode)) {
        courseOutcomes.push({ code: coCode, description: coDesc });
      }
      continue;
    }

    // 3. Detect Units
    const unitMatch = line.match(unitRegex);
    if (unitMatch) {
      if (currentUnit) {
        currentUnit.topicsCount = Math.max(currentUnit.subtopics.length, 1);
        units.push(currentUnit);
      }

      const unitNumRaw = unitMatch[1];
      const unitTitleRaw = unitMatch[2] ? unitMatch[2].trim() : `Unit ${unitNumRaw}`;
      const cleanUnitTitle = sanitizeCleanTitle(unitTitleRaw, `Unit ${unitNumRaw} - Core Principles`);

      // Convert Roman numerals or digits to formatted unit num
      const formattedNum = /^0/i.test(unitNumRaw)
        ? unitNumRaw
        : /^[IVX]+$/i.test(unitNumRaw)
        ? `Unit ${unitNumRaw}`
        : `Unit 0${unitNumRaw}`;

      // Extract inline CO mappings like [CO1, CO2] or (CO1)
      const inlineCoMatches = line.match(/CO\d+/g) || [];

      currentUnit = {
        id: `parsed-unit-${Date.now()}-${units.length + 1}`,
        num: formattedNum,
        name: cleanUnitTitle,
        topicsCount: 0,
        subtopics: [],
        coMapping: Array.from(new Set(inlineCoMatches)),
      };
      continue;
    }

    // 4. If inside a Unit, capture subtopics & CO tags
    if (currentUnit) {
      // Check for CO tag on subtopic line
      const inlineCos = line.match(/CO\d+/g);
      if (inlineCos) {
        inlineCos.forEach((c) => {
          if (!currentUnit!.coMapping.includes(c)) {
            currentUnit!.coMapping.push(c);
          }
        });
      }

      // Clean topic line
      const cleanSubtopic = line
        .replace(/^[\s\-\*\•\d\.\)]+/, "")
        .replace(/\s*\[CO\d+.*\]/i, "")
        .replace(/[^a-zA-Z0-9\s,\.\-\:\(\)\/\&]/g, "")
        .trim();

      if (
        cleanSubtopic.length > 2 &&
        /[a-zA-Z]{2,}/.test(cleanSubtopic) &&
        !/^unit/i.test(cleanSubtopic) &&
        !/^course/i.test(cleanSubtopic) &&
        !cleanSubtopic.includes("PK") &&
        !cleanSubtopic.includes("word/")
      ) {
        currentUnit.subtopics.push(cleanSubtopic);
      }
    }
  }

  // Push final active unit
  if (currentUnit) {
    currentUnit.topicsCount = Math.max(currentUnit.subtopics.length, 1);
    units.push(currentUnit);
  }

  // Fallback: If no explicit 'UNIT' headings were found, structure paragraphs into 3-5 units automatically
  if (units.length === 0 && lines.length > 0) {
    const totalLines = lines.length;
    const chunkSize = Math.max(Math.ceil(totalLines / 4), 1);

    for (let uIdx = 0; uIdx < 4 && uIdx * chunkSize < totalLines; uIdx++) {
      const chunkLines = lines.slice(uIdx * chunkSize, (uIdx + 1) * chunkSize);
      const rawTitle = chunkLines[0] || `Unit 0${uIdx + 1} - Key Principles`;
      const finalTitle = sanitizeCleanTitle(rawTitle, `Unit 0${uIdx + 1} - Core Topics`);

      const subtopics = chunkLines
        .slice(1)
        .map((l) => l.replace(/^[\s\-\*\•\d\.\)]+/, "").replace(/[^a-zA-Z0-9\s,\.\-\:\(\)\/\&]/g, "").trim())
        .filter((l) => l.length > 2 && /[a-zA-Z]{2,}/.test(l) && !l.includes("PK") && !l.includes("word/"));

      units.push({
        id: `auto-unit-${Date.now()}-${uIdx + 1}`,
        num: `Unit 0${uIdx + 1}`,
        name: finalTitle,
        topicsCount: Math.max(subtopics.length, 1),
        subtopics,
        coMapping: [`CO${uIdx + 1}`],
      });
    }
  }

  // Default Course Outcomes if none explicitly listed
  if (courseOutcomes.length === 0) {
    courseOutcomes.push(
      { code: "CO1", description: "Understand foundational principles and key concepts of the subject." },
      { code: "CO2", description: "Analyze core topics and evaluate practical application scenarios." },
      { code: "CO3", description: "Apply domain techniques and tools to solve domain problems." },
      { code: "CO4", description: "Synthesize advanced topics and construct comprehensive solutions." }
    );
  }

  // Fallback Subject Name from file name if not detected
  if (!detectedSubjectName) {
    detectedSubjectName = fileName
      .replace(/\.[^/.]+$/, "")
      .replace(/[_\-]/g, " ")
      .replace(/syllabus/i, "")
      .trim() || "Uploaded Subject Syllabus";
  }

  detectedSubjectName = cleanSubjectName(detectedSubjectName);

  return {
    subjectName: detectedSubjectName,
    subjectCode: detectedSubjectCode || `SUB-${Math.floor(100 + Math.random() * 900)}`,
    department: detectedDept || "General",
    semester: detectedSemester || "Semester 1",
    courseOutcomes,
    units,
    rawTextPreview: sanitizedText.slice(0, 400),
  };
}


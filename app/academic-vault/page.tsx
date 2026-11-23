"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  BookOpen,
  FileText,
  CheckSquare,
  Upload,
  Search,
  CheckCircle2,
  BarChart2,
  Bell,
  Edit3,
  Settings,
  Printer,
  Shield,
  ChevronRight,
  ArrowRight,
  School,
  Trash2,
  UploadCloud,
  Users,
  Briefcase,
  Archive,
  FileSpreadsheet,
  Eye,
  Download,
  X,
} from "lucide-react";
import { examStore, QuestionItem, SyllabusUnit, SubjectItem, SyllabusApprovalItem, INSTITUTIONAL_SUBJECTS } from "../lib/examStore";
import NavIcon from "../components/NavIcon";
import { getQuestionBankDocument, saveQuestionBankDocument, syncLocalQuestionBankDocuments, uploadQuestionBankDocumentToCloud } from "../lib/questionBankDocuments";
import { authStore, AuthUser, hasPermission } from "../lib/auth";
import { menuForUser } from "../lib/auth";
import { SCRUTINY_MENU_ITEMS } from "../lib/scrutinyMenu";
import { detectSubjectFromDocument, extractDocxText, extractFileText, extractSubjectHeader, inferDepartmentFromSubject } from "../lib/aiSyllabusParser";
import JSZip from "jszip";
import RoleGuard from "../components/RoleGuard";
import { OriginalQuestionBankPreview, ToastNotification } from "../components/CrudModal";
import MyUploadsList, { type MyUploadItem } from "../components/MyUploadsList";
import { confirmDialog } from "../components/ConfirmDialog";
import { convertToBloomPattern, groupByUnitAndType } from "../lib/bloomTaxonomy";
import PortalFooter from "../components/PortalFooter";
import PortalHeader from "../components/PortalHeader";
import SyllabusDocumentPreview from "../components/SyllabusDocumentPreview";
import BloomPatternView from "../components/BloomPatternView";

type ParsedBulkQuestion = Partial<QuestionItem> & { question: string; bloomCell?: string };
type SyllabusUploadFormat = "excel" | "word" | "pdf" | "diagram";

const cleanCell = (value: unknown) => String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Unable to preserve the uploaded document."));
    reader.readAsDataURL(file);
  });
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cleanCell(cell));
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cleanCell(cell));
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cleanCell(cell));
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function columnIndex(cellRef: string) {
  const letters = cellRef.replace(/\d/g, "").toUpperCase();
  return [...letters].reduce((result, letter) => result * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

async function parseXlsxRows(arrayBuffer: ArrayBuffer): Promise<string[][]> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const sharedFile = zip.file("xl/sharedStrings.xml");
  const sharedStrings = sharedFile
    ? [...(await sharedFile.async("string")).matchAll(/<si\b[\s\S]*?<\/si>/gi)].map((item) =>
        [...item[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/gi)].map((match) => match[1]).join("")
      )
    : [];
  const sheetFile = zip.file("xl/worksheets/sheet1.xml");
  if (!sheetFile) return [];
  const xml = await sheetFile.async("string");
  return [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)].map((rowMatch) => {
    const values: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = attrs.match(/\br="([A-Z]+\d+)"/i)?.[1];
      const index = ref ? columnIndex(ref) : values.length;
      const type = attrs.match(/\bt="([^"]+)"/i)?.[1];
      const rawValue = body.match(/<v[^>]*>([\s\S]*?)<\/v>/i)?.[1] || body.match(/<t[^>]*>([\s\S]*?)<\/t>/i)?.[1] || "";
      const value = type === "s" ? sharedStrings[Number(rawValue)] || "" : rawValue;
      values[index] = cleanCell(value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
    }
    return values;
  });
}

function rowsToBulkQuestions(rows: string[][], sourceFile: string): ParsedBulkQuestion[] {
  if (!rows.length) return [];
  const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const headers = rows[0].map(normalized);
  const questionIndex = headers.findIndex((header) => ["question", "questiontext", "questionstatement", "text"].includes(header));
  const hasHeader = questionIndex >= 0;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const indexOf = (names: string[], fallback: number) => {
    const index = headers.findIndex((header) => names.includes(header));
    return index >= 0 ? index : fallback;
  };
  const get = (row: string[], names: string[], fallback: number) => cleanCell(row[indexOf(names, fallback)]);

  return dataRows
    .map((row) => {
      const question = get(row, ["question", "questiontext", "questionstatement", "text"], 0);
      if (!question || question.length < 5) return null;
      const type = get(row, ["type", "questiontype", "kind"], 5);
      const difficulty = get(row, ["difficulty", "level"], 6);
      const parsedType = ["MCQ", "Descriptive", "Match Type", "Short Answer", "Problem Solving"].find((item) => item.toLowerCase() === type.toLowerCase()) || (type ? "Descriptive" : "Descriptive");
      const parsedDifficulty = ["Easy", "Medium", "Hard"].find((item) => item.toLowerCase() === difficulty.toLowerCase()) || "Medium";
      const options = ["optiona", "optionb", "optionc", "optiond"].map((name, index) => get(row, [name, `choice${String.fromCharCode(97 + index)}`], 7 + index)).filter(Boolean);
      return {
        question,
        subject: get(row, ["subject", "coursename", "course"], 1),
        unit: get(row, ["unit", "unitno", "module"], 2) || "1",
        topic: get(row, ["topic", "chapter"], 3) || "General",
        marks: Number(get(row, ["marks", "mark", "maxmarks", "marksallotted", "markallotted", "totalmarks"], 4)) || 2,
        type: parsedType as QuestionItem["type"],
        difficulty: parsedDifficulty as QuestionItem["difficulty"],
        options: options.length ? options : undefined,
        correctAnswer: get(row, ["correctanswer", "answer", "correctoption"], 11) || undefined,
        bloomCell: get(row, ["bloom", "bloomlevel", "bloomslevel", "bloomstaxonomy", "bloomtaxonomy", "bloomstaxonomylevel", "bl", "btl", "klevel", "knowledgelevel", "cognitivelevel", "taxonomylevel"], -1) || undefined,
        sourceFile,
      } as ParsedBulkQuestion;
    })
    .filter((question): question is ParsedBulkQuestion => Boolean(question));
}

// Document header lines ("Subject Name: …", "Max Marks: 100", "Part A") are not questions.
const METADATA_LINE = /^(?:(?:subject|course|paper|department|dept|programme|program|semester|sem|year|regulation|scheme|code|title|max(?:imum)?\s*marks|marks|time|duration|instructions?|note|section|faculty|staff|prepared\s+by|name|date|total)\b[^:?]{0,30}[:\-–]|(?:part|section)\s*[-–]?\s*[a-e]\b[^?]{0,60}$|question\s*bank\b[^?]*$)/i;

const UNIT_HEADING = /^unit\s+([ivxlcdm]+|\d+)\s*(?:[-–—:]\s*(.*))?$/i;
// "SECTION A – MCQ", "Part B (10 × 8 = 80)", "SECTION A" — but not an instruction
// such as "Section A contains 20 multiple-choice questions".
const SECTION_HEADING = /^(?:section|part)\s*[-–—]?\s*(?:[a-e]|[ivx]+)\s*(?:$|[-–—:(.)])[^?]{0,90}$/i;
const MARKS_SUMMARY = /^\(?\s*(?:\d+\s*[×xX*]\s*\d+\s*=\s*)?\d+\s*marks?\s*\)?$/i;
const END_OF_PAPER = /^\*{3}|^end\s+of\s+(?:the\s+)?question\s+paper/i;
const DEFAULT_QUESTION_MARKS = 2;

/** Marks per question stated by a section heading or instruction line, e.g. "(10 × 8 = 80)", "1 mark each". */
function sectionMarksFrom(line: string): number | undefined {
  const product = line.match(/(\d+)\s*[×xX*]\s*(\d+)\s*=\s*\d+/);
  if (product) return Number(product[2]);
  const each = line.match(/(\d+(?:\.\d+)?)\s*marks?\s*(?:each|per\s+question)/i) || line.match(/each\s+(?:question\s+)?carries\s+(\d+(?:\.\d+)?)\s*marks?/i);
  return each ? Number(each[1]) : undefined;
}

/** Marks written on the question itself ("… (8 Marks)", "[10M]", "… CO1 K2 8"); returns the text without them. */
function questionMarksFrom(text: string): { marks?: number; text: string } {
  const patterns: RegExp[] = [
    /\s*[(\[]\s*(\d{1,3}(?:\.\d+)?)\s*(?:marks?|mks?|m)\s*[)\]]\s*$/i,
    /\s*[-–—,:]?\s*(\d{1,3}(?:\.\d+)?)\s*marks?\s*$/i,
    /^\s*[(\[]\s*(\d{1,3}(?:\.\d+)?)\s*(?:marks?|mks?|m)\s*[)\]]\s*/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return { marks: Number(match[1]), text: text.replace(pattern, "").trim() };
  }
  // A trailing number after CO / Bloom tags ("Explain … CO1 K2 8") is the marks.
  const tagged = text.match(/(\b(?:CO\s*\d+|BTL\s*\d|K\s*\d|L\s*\d)\b)\s+(\d{1,2})\s*$/i);
  if (tagged) return { marks: Number(tagged[2]), text: text.slice(0, tagged.index! + tagged[1].length).trim() };
  return { text };
}

function parseTextQuestionBank(text: string, sourceFile: string): ParsedBulkQuestion[] {
  if (/\uFFFD|[\uE000-\uF8FF]/.test(text)) {
    throw new Error("This file's text encoding cannot be read faithfully. The original upload is preserved; please upload the same content as Unicode .docx or .xlsx to keep its language unchanged.");
  }
  const allLines = text.split(/\r?\n/).map((line) => cleanCell(line)).filter(Boolean);
  // A question paper starts with institution details, exam title, date/time
  // and general instructions. Questions begin at the first Section/Part or
  // Unit heading (or the first "Q1." line), so everything above it is skipped.
  const bodyStart = allLines.findIndex((line) => UNIT_HEADING.test(line) || SECTION_HEADING.test(line) || /^Q\s*\d+\s*[.)]/i.test(line));
  const lines = bodyStart > 0 ? allLines.slice(bodyStart) : allLines;
  let inInstructions = false;
  const numberedQuestion = /^(?:(?:question|q)\s*)?\d+\s*[.)\-:]\s*(.+)$/i;
  const optionLine = /^(?:\(?([A-D])\)?\s*[.)\-:]|\(([A-D])\))\s*(.+)$/i;
  const answerLine = /^(?:correct\s+)?answer\s*[:\-]\s*(.+)$/i;
  const questions: ParsedBulkQuestion[] = [];
  let current: ParsedBulkQuestion | null = null;
  let foundNumberedQuestions = false;
  let activeUnit = "1";
  let activeQuestionType: QuestionItem["type"] = "Descriptive";
  // Marks per question for the current section ("Part B (5 × 16 = 80)", "1 mark each").
  let sectionMarks: number | undefined;
  // Marks stated per section in the instructions, e.g. "Section A contains 20
  // multiple-choice questions carrying 1 mark each" -> { A: 1 }.
  const marksBySection: Record<string, number> = {};
  let paperWideMarks: number | undefined;
  const noteInstructionMarks = (line: string) => {
    const perQuestion = sectionMarksFrom(line);
    if (perQuestion === undefined) return;
    const section = line.match(/\b(?:section|part)\s*[-–—]?\s*([a-e]|[ivx]+)\b/i);
    if (section) marksBySection[section[1].toUpperCase()] = perQuestion;
    else paperWideMarks = perQuestion;
  };
  // The instructions above the first section heading are not questions, but
  // they often state the marks for each section.
  allLines.slice(0, Math.max(0, bodyStart)).forEach(noteInstructionMarks);
  sectionMarks = paperWideMarks;
  /** Marks for a section heading: from the heading itself, else from the instructions. */
  const marksForHeading = (line: string) => {
    const section = line.match(/^(?:section|part)\s*[-–—]?\s*([a-e]|[ivx]+)\b/i);
    return sectionMarksFrom(line) ?? (section ? marksBySection[section[1].toUpperCase()] : undefined) ?? paperWideMarks;
  };

  const finish = () => {
    const q = current as ParsedBulkQuestion | null;
    if (q?.question.trim()) {
      // Marks written on the question win; otherwise the section's marks; otherwise the default.
      const found = questionMarksFrom(q.question);
      q.question = found.text || q.question;
      q.marks = q.marks ?? found.marks ?? sectionMarks ?? DEFAULT_QUESTION_MARKS;
      questions.push(q);
    }
    current = null;
  };

  for (const line of lines) {
    if (END_OF_PAPER.test(line)) {
      finish();
      continue;
    }
    if (MARKS_SUMMARY.test(line)) {
      const perQuestion = sectionMarksFrom(line);
      if (perQuestion !== undefined) sectionMarks = perQuestion; // "(10 × 8 = 80 Marks)"
      else if (current) (current as ParsedBulkQuestion).marks = Number(line.match(/\d+(?:\.\d+)?/)![0]); // "(16 Marks)" under a question
      continue;
    }
    if (/^(?:general\s+)?instructions?\b[^?]{0,60}$/i.test(line)) {
      finish();
      inInstructions = true;
      noteInstructionMarks(line);
      if (paperWideMarks !== undefined) sectionMarks = paperWideMarks;
      continue;
    }
    const unitHeading = line.match(UNIT_HEADING);
    if (unitHeading) {
      inInstructions = false;
      finish();
      const unitNumber = unitHeading[1];
      const unitTitle = unitHeading[2]?.trim();
      activeUnit = `Unit ${unitNumber}${unitTitle ? ` - ${unitTitle}` : ""}`;
      continue;
    }

    if (/\b(?:mcq|multiple[\s-]*choice)\b/i.test(line) && (/\bsection\b/i.test(line) || /\banswer\s+key\b/i.test(line))) {
      finish();
      activeQuestionType = "MCQ";
      sectionMarks = marksForHeading(line);
      continue;
    }
    if (/\bdescriptive\b/i.test(line) && /\bsection\b/i.test(line)) {
      finish();
      activeQuestionType = "Descriptive";
      sectionMarks = marksForHeading(line);
      continue;
    }
    if (SECTION_HEADING.test(line)) {
      inInstructions = false;
      finish();
      if (/\b(?:mcq|multiple[\s-]*choice|objective)\b/i.test(line)) activeQuestionType = "MCQ";
      else if (/\b(?:descriptive|short|long|essay)\b/i.test(line)) activeQuestionType = "Descriptive";
      sectionMarks = marksForHeading(line);
      continue;
    }
    if (inInstructions) {
      // "Each question carries 2 marks" inside the instructions applies to the questions below.
      noteInstructionMarks(line);
      if (paperWideMarks !== undefined) sectionMarks = paperWideMarks;
      continue;
    }

    const questionMatch = line.match(numberedQuestion);
    if (questionMatch) {
      foundNumberedQuestions = true;
      finish();
      current = { question: questionMatch[1].trim(), options: [], sourceFile, unit: activeUnit, topic: "General", type: activeQuestionType, difficulty: "Medium" };
      continue;
    }

    const optionMatch = line.match(optionLine);
    const answerMatch = line.match(answerLine);
    if (optionMatch && current) {
      // "A) x   B) y   C) z   D) w" on one line holds four options.
      const inline = line.split(/\s*\(?\b([A-D])\)\s*/).slice(1);
      const lineOptions = inline.length >= 8 ? inline.filter((_, i) => i % 2 === 1).map((o) => o.trim()).filter(Boolean) : [optionMatch[3].trim()];
      current.options = [...(current.options || []), ...lineOptions];
      current.type = "MCQ";
    } else if (answerMatch && current) {
      current.correctAnswer = answerMatch[1].trim();
    } else if (current) {
      current.question = `${current.question}\n${line}`;
    } else if (!foundNumberedQuestions && !optionMatch && !answerMatch && line.length >= 5 && !METADATA_LINE.test(line)) {
      current = { question: line, sourceFile, unit: activeUnit, topic: "General", type: activeQuestionType, difficulty: "Medium" };
      finish();
    }
  }
  finish();
  return questions;
}

async function parseBulkQuestionFile(file: File): Promise<ParsedBulkQuestion[]> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "csv") return rowsToBulkQuestions(parseCsvRows(await file.text()), file.name);
  if (extension === "xlsx" || extension === "xls") return rowsToBulkQuestions(await parseXlsxRows(await file.arrayBuffer()), file.name);
  if (extension === "docx" || extension === "doc") {
    const text = extension === "docx" ? await extractDocxText(await file.arrayBuffer()) : await file.text();
    return parseTextQuestionBank(text, file.name);
  }
  if (extension === "pdf") {
    const text = await extractFileText(file);
    return parseTextQuestionBank(text, file.name);
  }
  if (["png", "jpg", "jpeg", "svg", "webp"].includes(extension)) {
    return [{ question: `Diagram attachment: ${file.name}`, sourceFile: file.name, unit: "1", topic: "Diagram", type: "Descriptive", difficulty: "Medium", marks: 2 }];
  }
  return [];
}

export default function AcademicVaultPage() {
  const router = useRouter();

  // Sub-mode for Right Partition (Question Bank Upload): "bulk" vs "manual"
  const [qbUploadMode, setQbUploadMode] = useState<"bulk" | "manual">("bulk");

  // Auth User State
  const [currentUser, setCurrentUser] = useState<AuthUser>(() => authStore.getCurrentUser());

  useEffect(() => {
    const handleAuth = () => {
      setCurrentUser(authStore.getCurrentUser());
    };
    window.addEventListener("exam-cell-auth-update", handleAuth);
    return () => window.removeEventListener("exam-cell-auth-update", handleAuth);
  }, []);

  interface MenuItemDef {
    id: string;
    label: string;
    icon: any;
    route: string;
    badge?: string;
    hasArrow?: boolean;
  }

  const rawMenuItems: MenuItemDef[] = [
    { id: "dashboard", label: "Dashboard", icon: Home, route: "/dashboard" },
    ...SCRUTINY_MENU_ITEMS,
    { id: "school", label: "School", icon: School, route: "/subjects" },
    {
      id: "staff-work-status",
      label: "Staff Work Status",
      icon: Briefcase,
      route: "/staff-work-status",
    },
    {
      id: "academic-vault",
      label: "Academic Vault",
      icon: Archive,
      badge: "Vault",
      hasArrow: true,
      route: "/academic-vault",
    },
    {
      id: "verify-approval",
      label: "Verify & Approval",
      icon: CheckSquare,
      route: "/approval",
    },
    { id: "reports", label: "Reports", icon: BarChart2, route: "/reports" },
    {
      id: "manual-questions",
      label: "Manual Questions",
      icon: Edit3,
      badge: "New",
      route: "/manual-questions",
    },
    {
      id: "print-paper",
      label: "Print Question Paper",
      icon: Printer,
      badge: "Print",
      route: "/print-paper",
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: Bell,
      route: "/notifications",
    },
    { id: "settings", label: "Settings", icon: Settings, route: "/settings" },
  ];

  const menuItems = menuForUser(rawMenuItems, currentUser);

  // Store data
  const [questions, setQuestions] = useState<QuestionItem[]>(() => {
    if (typeof window !== "undefined") {
      return examStore.getQuestions() || [];
    }
    return [];
  });

  const [subjects, setSubjects] = useState<SubjectItem[]>(() => {
    if (typeof window !== "undefined") {
      return examStore.getSubjects() || [];
    }
    return [];
  });

  const [units, setUnits] = useState<SyllabusUnit[]>(() => {
    if (typeof window !== "undefined") {
      return examStore.getUnits() || [];
    }
    return [];
  });

  const [syllabusApprovalList, setSyllabusApprovalList] = useState<SyllabusApprovalItem[]>(() =>
    typeof window !== "undefined" ? examStore.getSyllabusApprovals() : [],
  );

  useEffect(() => {
    const loadData = () => {
      setQuestions(examStore.getQuestions() || []);
      setSubjects(examStore.getSubjects() || []);
      setUnits(examStore.getUnits() || []);
      setSyllabusApprovalList(examStore.getSyllabusApprovals());
    };
    loadData();
    window.addEventListener("exam-cell-store-update", loadData);
    return () => window.removeEventListener("exam-cell-store-update", loadData);
  }, []);

  // Staff users may upload work only for subjects assigned to their profile.
  // Leadership roles retain the complete institutional subject catalogue.
  const availableSubjects = React.useMemo(() => {
    if (currentUser.role !== "STAFF") return INSTITUTIONAL_SUBJECTS;

    const assigned = examStore.getStaffAssignedSubjects(currentUser.email, currentUser.name).subjects;
    const normalize = (value: string) => value.toLowerCase().replace(/\s*\([^)]*\)\s*/g, " ").replace(/[^a-z0-9]+/g, "");
    const assignedKeys = assigned.map(normalize).filter(Boolean);

    // Staff see the subjects a HOD/Dean allocated to them (name + code).
    const allocated = INSTITUTIONAL_SUBJECTS.filter((subject) => {
      const subjectName = normalize(subject.name);
      const subjectCode = subject.code.toLowerCase().replace(/[^a-z0-9]+/g, "");
      return assignedKeys.some((key) => key.includes(subjectName) || subjectName.includes(key) || key.includes(subjectCode));
    });
    if (allocated.length > 0) return allocated;

    // Nothing allocated yet: fall back to the subjects of the staff member's
    // own department (e.g. Visual Communication -> the VIS subjects).
    const departmentKey = (value: string) => value.toLowerCase().replace(/^department of\s+/, "").replace(/[^a-z0-9]+/g, "");
    const ownDepartment = departmentKey(currentUser.department || "");
    if (!ownDepartment) return [];
    return INSTITUTIONAL_SUBJECTS.filter((subject) => {
      const subjectDepartment = departmentKey(subject.department);
      return subjectDepartment === ownDepartment || subjectDepartment.includes(ownDepartment) || ownDepartment.includes(subjectDepartment);
    });
  }, [currentUser, subjects]);
  const noAssignedSubjects = currentUser.role === "STAFF" && availableSubjects.length === 0;

  // ---------------- SUBMITTER (HOD can upload for own subject or for a faculty) ----------------
  const [submitForId, setSubmitForId] = useState("self");
  const departmentFaculty = React.useMemo(() => {
    if (currentUser.role !== "HOD") return [];
    const clean = (value: string) => value.toLowerCase().replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s*/i, "").replace(/[^a-z0-9]/g, "");
    const hodEmail = (currentUser.email || "").toLowerCase().trim();
    const hodDept = clean(currentUser.department || "");
    const all = examStore.getAllStaffFaculty().filter((faculty) => faculty.name && clean(faculty.name) !== clean(currentUser.name));
    const own = all.filter((faculty) => {
      const facultyDept = clean(faculty.department || "");
      return (
        (faculty.hodEmail || "").toLowerCase().trim() === hodEmail ||
        (Boolean(hodDept) && Boolean(facultyDept) && (facultyDept.includes(hodDept) || hodDept.includes(facultyDept)))
      );
    });
    return (own.length > 0 ? own : all).sort((a, b) => a.name.localeCompare(b.name));
  }, [currentUser, subjects]);
  const selectedFaculty = departmentFaculty.find((faculty) => faculty.id === submitForId) || null;
  const submitter = selectedFaculty
    ? { name: selectedFaculty.name, email: selectedFaculty.email, onBehalfBy: currentUser.name }
    : { name: currentUser.name, email: currentUser.email, onBehalfBy: undefined as string | undefined };

  // ---------------- PARTITION 1: SYLLABUS HUB STATE ----------------
  const [syllabusSubject, setSyllabusSubject] = useState("");
  const [syllabusCode, setSyllabusCode] = useState("");
  const [syllabusSemester, setSyllabusSemester] = useState("");
  const [syllabusDepartment, setSyllabusDepartment] = useState("");
  // Subject of the uploaded syllabus (catalogue match or the document's own
  // name/code). While a file is uploaded, the Subject Name / Code dropdowns
  // offer only this subject; removing the file restores the normal list.
  const [customSyllabusSubject, setCustomSyllabusSubject] = useState<{ name: string; code: string; department: string; semester?: string } | null>(null);
  const syllabusSubjectOptions = React.useMemo(() => {
    if (!customSyllabusSubject) return availableSubjects;
    return [{ ...customSyllabusSubject, credits: 0, semester: customSyllabusSubject.semester || "" }];
  }, [availableSubjects, customSyllabusSubject]);

  // Nothing is pre-selected: Subject, Code, Semester and Department stay empty
  // until a syllabus is uploaded (filled from the file) or chosen by hand.
  const [syllabusFileName, setSyllabusFileName] = useState<string | null>(null);
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [syllabusFileUrl, setSyllabusFileUrl] = useState<string | null>(null);
  const [syllabusPreviewText, setSyllabusPreviewText] = useState<string | null>(null);
  const [savedSyllabus, setSavedSyllabus] = useState<{ name: string; code: string } | null>(null);
  const [showSyllabusFilePreview, setShowSyllabusFilePreview] = useState(false);
  const [isSyllabusDragOver, setIsSyllabusDragOver] = useState(false);
  const [syllabusFormat, setSyllabusFormat] = useState<SyllabusUploadFormat>("pdf");
  const syllabusFileRef = useRef<HTMLInputElement>(null);

  const processSyllabusFile = async (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const allowedExtensions: Record<SyllabusUploadFormat, string[]> = {
      excel: ["xlsx", "xls"],
      word: ["docx", "doc"],
      pdf: ["pdf"],
      diagram: ["png", "jpg", "jpeg", "svg", "webp"],
    };
    if (!allowedExtensions[syllabusFormat].includes(extension)) {
      const formatName = syllabusFormat === "excel" ? "Excel" : syllabusFormat === "word" ? "Word" : syllabusFormat === "pdf" ? "PDF" : "Diagram image";
      showToast(`Please choose a ${formatName} file.`, "danger");
      return;
    }
    setSyllabusFile(file);
    setSyllabusFileName(file.name);
    setSyllabusFileUrl(URL.createObjectURL(file));
    setSyllabusPreviewText(null);
    let documentText = "";
    if (extension === "docx") {
      try {
        documentText = await extractDocxText(await file.arrayBuffer());
        setSyllabusPreviewText(documentText);
      } catch {
        setSyllabusPreviewText("Unable to read this Word document.");
      }
    } else if (extension === "doc") {
      setSyllabusPreviewText("Legacy .doc preview is not supported in the browser. Please upload the document as .docx.");
    } else if (extension === "pdf" || extension === "xlsx") {
      try {
        documentText = await extractFileText(file);
      } catch {
        documentText = "";
      }
    }

    // Syllabi are accepted in any layout; no Bloom's format is required.

    // Pick the subject (name + code) the uploaded syllabus belongs to: a known
    // catalogue subject first, otherwise the document's own name and code.
    setCustomSyllabusSubject(null);
    const detected = detectSubjectFromDocument(file.name, documentText, INSTITUTIONAL_SUBJECTS);
    const allowed = detected && availableSubjects.find((subject) => subject.code === detected.code);
    if (allowed) {
      setCustomSyllabusSubject({ name: allowed.name, code: allowed.code, department: allowed.department, semester: allowed.semester });
      setSyllabusSubject(allowed.name);
      setSyllabusCode(allowed.code);
      setSyllabusDepartment(allowed.department.replace("Department of ", ""));
      if (allowed.semester) setSyllabusSemester(allowed.semester);
      showToast("Uploaded successfully.");
      return;
    }
    if (detected) {
      setSyllabusSubject("");
      setSyllabusCode("");
      showToast(`This syllabus is for ${detected.name} (${detected.code}), which is not assigned to you.`, "danger");
      return;
    }
    const header = extractSubjectHeader(file.name, documentText);
    if (header) {
      // Department from the syllabus itself, else guessed from the subject
      // name (e.g. Basic Mathematics -> Mathematics), else the uploader's.
      const department = header.department || inferDepartmentFromSubject(header.name) || currentUser.department || "";
      setCustomSyllabusSubject({ name: header.name, code: header.code, department, semester: header.semester });
      setSyllabusSubject(header.name);
      setSyllabusCode(header.code);
      if (department) setSyllabusDepartment(department.replace("Department of ", ""));
      if (header.semester) setSyllabusSemester(header.semester);
      showToast("Uploaded successfully.");
      return;
    }
    showToast("Uploaded successfully.");
  };

  const handleSyllabusFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processSyllabusFile(file);
  };

  const handleDeleteSyllabusUpload = () => {
    if (savedSyllabus) {
      examStore.deleteSubjectSyllabus(savedSyllabus.name);
      examStore.deleteSubject(savedSyllabus.code);
      examStore.getSyllabusApprovals()
        .filter((item) => item.courseCode === savedSyllabus.code || item.courseName.toLowerCase() === savedSyllabus.name.toLowerCase())
        .forEach((item) => examStore.deleteSyllabusApproval(item.id));
      showToast(`Syllabus "${savedSyllabus.name}" deleted.`, "danger");
    } else {
      showToast("Syllabus upload removed.");
    }

    setSavedSyllabus(null);
    setShowSyllabusFilePreview(false);
    setSyllabusFileName(null);
    setSyllabusFile(null);
    setSyllabusFileUrl(null);
    setSyllabusPreviewText(null);
    setSyllabusSubject("");
    setSyllabusCode("");
    setSyllabusDepartment("");
    setSyllabusSemester("");
    setCustomSyllabusSubject(null);
    if (syllabusFileRef.current) syllabusFileRef.current.value = "";
  };

  const handleSaveSyllabusPack = async (e: React.FormEvent) => {
    e.preventDefault();
    const derivedSubject = syllabusFileName
      ? syllabusFileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim()
      : "";
    const resolvedSubject = syllabusSubject.trim() || derivedSubject;
    const resolvedCode = syllabusCode.trim() || `SUB-${Math.floor(100 + Math.random() * 900)}`;
    const resolvedDepartment = syllabusDepartment.trim() || "Department of Visual Communication";

    if (!resolvedSubject) {
      showToast("Please upload a syllabus document or enter a valid Subject Name.", "danger");
      return;
    }

    const existingSub = subjects.find(
      (s) => s.name.toLowerCase() === resolvedSubject.toLowerCase() || s.code === resolvedCode
    );
    const newId = existingSub?.id || `sub-${Date.now()}`;
    const subItem: SubjectItem = {
      id: newId,
      name: resolvedSubject,
      code: resolvedCode,
      semester: syllabusSemester || existingSub?.semester || "Semester 1",
      department: resolvedDepartment,
      totalQuestions: existingSub?.totalQuestions || 20,
      approved: existingSub?.approved || 15,
      pending: existingSub?.pending || 5,
      verified: existingSub?.verified || 15,
      status: "In Progress",
      credits: 3,
      completed: "15 (75%)",
    };
    examStore.saveSubject(subItem);

    // Save standard 5 units for this syllabus
    const defaultFive = [
      { num: "1", name: "Introduction & Foundational Concepts", topics: ["History & Evolution", "Core Principles & Taxonomy", "Theoretical Foundations", "Domain Fundamentals"] },
      { num: "2", name: "Core Architectures & Standard Workflows", topics: ["Process Planning", "Structural Methodologies", "Standard Operating Pipelines", "Technical Specifications"] },
      { num: "3", name: "Advanced Methodologies & Execution", topics: ["Optimization Strategies", "Performance Profiling", "Advanced Toolsets", "Integration Frameworks"] },
      { num: "4", name: "Quality Assurance, Ethics & Compliance", topics: ["Regulatory Frameworks", "Intellectual Property Rights", "Industry Standards", "Professional Ethics"] },
      { num: "5", name: "Industry Applications & Capstone Project", topics: ["Case Studies", "Real-world Project Execution", "Capstone Assessment", "Portfolio Evaluation"] },
    ];

    defaultFive.forEach((ud) => {
      const unitItem: SyllabusUnit = {
        id: `unit-${subItem.id}-${ud.num}`,
        num: ud.num,
        name: ud.name,
        subject: subItem.name,
        topics: ud.topics.length,
        docs: 1,
        subtopics: ud.topics,
        coMapping: [`CO${ud.num}`],
        description: `OBE Curriculum specification for Unit ${ud.num}`,
      };
      examStore.saveUnit(unitItem);
    });

    // Also register syllabus into the 4-tier approval status tracker
    let extractedDocumentText = syllabusPreviewText?.trim() || "";
    if (!extractedDocumentText && syllabusFile) {
      try {
        const extension = syllabusFile.name.split(".").pop()?.toLowerCase() || "";
        extractedDocumentText = extension === "docx"
          ? (await extractDocxText(await syllabusFile.arrayBuffer())).trim()
          : extension === "pdf"
            ? (await extractFileText(syllabusFile)).trim()
            : "";
      } catch {
        extractedDocumentText = "";
      }
    }
    const documentPreview = extractedDocumentText || [
      `Syllabus document: ${syllabusFileName || `${subItem.name}.docx`}`,
      `Subject: ${subItem.name}`,
      `Course code: ${subItem.code}`,
      `Department: ${subItem.department}`,
      `Semester: ${subItem.semester}`,
      "",
      "The syllabus was uploaded and ingested successfully. HOD verification can be completed from this review record.",
    ].join("\n");
    let originalDocumentData = "";
    if (syllabusFile) {
      try {
        originalDocumentData = await readFileAsDataUrl(syllabusFile);
      } catch {
        // The extracted full text preview remains available even if the
        // browser cannot persist the original binary document.
      }
    }
    examStore.saveSyllabusApproval({
      courseCode: subItem.code,
      courseName: subItem.name,
      department: subItem.department,
      semester: subItem.semester,
      submittedBy: submitter.name || "Faculty Member",
      submitterEmail: submitter.email || "faculty@rathinam.in",
      uploadedOnBehalfBy: submitter.onBehalfBy,
      submittedAt:
        new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
        ", " +
        new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      totalUnits: 5,
      totalTopics: 20,
      stage: "hod",
      status: "Pending",
      staffStatus: "Submitted",
      hodStatus: "Pending",
      deanStatus: "Waiting_HOD",
      coeStatus: "Waiting_Dean",
      remarks: submitter.onBehalfBy
        ? `Uploaded by HOD ${submitter.onBehalfBy} on behalf of ${submitter.name}. Awaiting HOD verification before Dean approval.`
        : "Syllabus pack ingested with 5 units. Awaiting HOD scrutiny and curriculum audit.",
      documentName: syllabusFileName || `${subItem.name}.docx`,
      documentFormat: syllabusFormat,
      documentText: documentPreview,
      documentData: originalDocumentData || undefined,
    });

    setSavedSyllabus({ name: subItem.name, code: subItem.code });

    // Reset form inputs after save
    setSyllabusSubject("");
    setSyllabusCode("");
    setSyllabusDepartment("");
    setSyllabusSemester("");
    setCustomSyllabusSubject(null);
    setSyllabusFile(null);
    showToast(`Syllabus "${subItem.name}" saved & ingested into Vault!`);
  };

  // ---------------- PARTITION 2: QUESTION BANK STATE ----------------
  const [bulkFileName, setBulkFileName] = useState<string | null>(null);
  const [bulkFileUrl, setBulkFileUrl] = useState<string | null>(null);
  const [bulkSourceText, setBulkSourceText] = useState<string | null>(null);
  const [bulkFormat, setBulkFormat] = useState<SyllabusUploadFormat>("excel");
  const [bulkSubject, setBulkSubject] = useState("");
  const bulkFileRef = useRef<HTMLInputElement>(null);
  const [parsedBulkCount, setParsedBulkCount] = useState(0);
  const [parsedBulkQuestions, setParsedBulkQuestions] = useState<ParsedBulkQuestion[]>([]);
  const [isParsingBulk, setIsParsingBulk] = useState(false);
  const [isBulkDragOver, setIsBulkDragOver] = useState(false);
  const [showBulkPreview, setShowBulkPreview] = useState(false);
  const [bulkPreviewTab, setBulkPreviewTab] = useState<"bloom" | "original">("bloom");
  const bloomGroups = React.useMemo(() => groupByUnitAndType(parsedBulkQuestions), [parsedBulkQuestions]);

  // Keep the question bank subject valid for this user. Only a single allowed
  // subject is picked automatically; otherwise it comes from the uploaded file
  // (see processBulkFile) or the user's choice in the Subject dropdown.
  // While a question bank file is uploaded, its subject is the only option.
  const [bulkUploadedSubject, setBulkUploadedSubject] = useState<{ name: string; code: string; department: string; semester?: string } | null>(null);
  const bulkSubjectOptions = React.useMemo(
    () => (bulkUploadedSubject ? [{ ...bulkUploadedSubject, credits: 0, semester: bulkUploadedSubject.semester || "" }] : availableSubjects),
    [availableSubjects, bulkUploadedSubject],
  );
  useEffect(() => {
    if (bulkSubject && bulkSubjectOptions.some((subject) => subject.name === bulkSubject)) return;
    // Filled automatically only from an uploaded file; otherwise left empty.
    const next = bulkUploadedSubject ? bulkUploadedSubject.name : "";
    if (next !== bulkSubject) setBulkSubject(next);
  }, [bulkSubjectOptions, bulkSubject, bulkUploadedSubject]);
  const bulkSubjectInfo = bulkSubjectOptions.find((subject) => subject.name === bulkSubject) || null;

  // Manual Question state
  const [manualSubject, setManualSubject] = useState(subjects[0]?.name || "General");
  const [manualUnit, setManualUnit] = useState(1);
  const [manualTopic, setManualTopic] = useState("Foundations");
  const [manualType, setManualType] = useState<"MCQ" | "Descriptive">("MCQ");
  const [manualQuestionText, setManualQuestionText] = useState("");
  const [manualMarks, setManualMarks] = useState(2);
  const [manualDifficulty, setManualDifficulty] = useState<"Easy" | "Medium" | "Hard">("Medium");
  const [manualBloom, setManualBloom] = useState("Understand");
  const [manualOptionA, setManualOptionA] = useState("");
  const [manualOptionB, setManualOptionB] = useState("");
  const [manualOptionC, setManualOptionC] = useState("");
  const [manualOptionD, setManualOptionD] = useState("");
  const [manualCorrectAnswer, setManualCorrectAnswer] = useState("A");

  const processBulkFile = async (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const allowedExtensions: Record<SyllabusUploadFormat, string[]> = {
      excel: ["xlsx", "xls"],
      word: ["docx", "doc"],
      pdf: ["pdf"],
      diagram: ["png", "jpg", "jpeg", "svg", "webp"],
    };
    if (!allowedExtensions[bulkFormat].includes(extension)) {
      const formatName = bulkFormat === "excel" ? "Excel" : bulkFormat === "word" ? "Word" : bulkFormat === "pdf" ? "PDF" : "Diagram image";
      showToast(`Please choose a ${formatName} file.`, "danger");
      return;
    }
    setBulkFileName(file.name);
    setBulkUploadedSubject(null);
    setBulkFileUrl(URL.createObjectURL(file));
    setBulkSourceText(null);
    setParsedBulkQuestions([]);
    setParsedBulkCount(0);
    setIsParsingBulk(true);
    try {
      if (extension === "docx") {
        setBulkSourceText(await extractDocxText(await file.arrayBuffer()));
      } else if (extension === "doc") {
        setBulkSourceText("Previewing legacy .doc files is not supported in the browser. Convert the document to .docx to preview its contents here.");
      }
      if (extension === "doc") {
        throw new Error("Legacy .doc files cannot be decoded safely. Please save the same document as .docx so its original language and text are preserved.");
      }
      // Any layout is accepted. The questions are then converted to the Bloom's
      // Taxonomy pattern: a Bloom's level on every question, arranged unit-wise
      // with MCQs and Descriptive questions in separate groups.
      const rawParsed = await parseBulkQuestionFile(file);
      await saveQuestionBankDocument(file);
      const parsed: ParsedBulkQuestion[] = convertToBloomPattern(rawParsed);
      setParsedBulkQuestions(parsed);
      setParsedBulkCount(parsed.length);
      if (!parsed.length) {
        showToast(`No question rows found in ${file.name}. Check the file format and Question column.`, "danger");
      } else {
        // Pick the subject (name + code) the question bank belongs to, from the
        // file name, a Subject/Course column, or the question text itself.
        const subjectColumn = parsed.map((question) => question.subject || "").filter(Boolean).join("\n");
        const questionText = parsed.map((question) => question.question).join("\n");

        // 1) A syllabus this staff member already uploaded wins, so the question
        //    bank lands under exactly the same subject name and code as the
        //    syllabus (e.g. "Basic_Mathematics_..._Bloom.docx" -> Basic Mathematics).
        const submitterKey = (value: string) => value.toLowerCase().replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s*/i, "").trim();
        const ownSyllabusSubjects = Array.from(
          new Map(
            examStore
              .getSyllabusApprovals()
              .filter((item) =>
                (submitter.email && (item.submitterEmail || "").toLowerCase() === submitter.email.toLowerCase()) ||
                (submitter.name && submitterKey(item.submittedBy || "") === submitterKey(submitter.name)),
              )
              .filter((item) => item.courseName && item.courseCode)
              .map((item) => [item.courseCode, { code: item.courseCode, name: item.courseName, department: item.department || "", semester: item.semester || "" }] as const),
          ).values(),
        );
        const fromSyllabus =
          detectSubjectFromDocument(file.name, subjectColumn, ownSyllabusSubjects) ||
          detectSubjectFromDocument("", questionText.slice(0, 6000), ownSyllabusSubjects);
        if (fromSyllabus) {
          setBulkUploadedSubject({ name: fromSyllabus.name, code: fromSyllabus.code, department: fromSyllabus.department, semester: fromSyllabus.semester });
          setBulkSubject(fromSyllabus.name);
          showToast("Uploaded successfully.");
          return;
        }

        // 2) Otherwise a catalogue subject, 3) otherwise the file's own name/code.
        const detected =
          detectSubjectFromDocument(file.name, subjectColumn, INSTITUTIONAL_SUBJECTS) ||
          detectSubjectFromDocument("", questionText, INSTITUTIONAL_SUBJECTS);
        const allowed = detected && availableSubjects.find((subject) => subject.code === detected.code);
        if (allowed) {
          setBulkUploadedSubject({ name: allowed.name, code: allowed.code, department: allowed.department, semester: allowed.semester });
          setBulkSubject(allowed.name);
          showToast("Uploaded successfully.");
        } else if (detected) {
          setBulkUploadedSubject(null);
          setBulkSubject("");
          showToast(`This question bank is for ${detected.name} (${detected.code}), which is not assigned to you.`, "danger");
        } else {
          // Not a catalogue subject: use the file's own name/code (Subject
          // column or file name), e.g. "Basic Mathematics (311302)".
          const header = extractSubjectHeader(file.name, subjectColumn ? `Subject Name: ${subjectColumn.split("\n")[0]}` : "");
          if (header) {
            setBulkUploadedSubject({ name: header.name, code: header.code, department: inferDepartmentFromSubject(header.name) || currentUser.department || "", semester: header.semester });
            setBulkSubject(header.name);
          } else {
            setBulkUploadedSubject(null);
          }
          showToast("Uploaded successfully.");
        }
      }
    } catch (error) {
      setBulkFileName(null);
      setBulkFileUrl(null);
      setBulkSourceText(null);
      setBulkUploadedSubject(null);
      setParsedBulkQuestions([]);
      setParsedBulkCount(0);
      if (bulkFileRef.current) bulkFileRef.current.value = "";
      console.error("Bulk question parsing failed", error);
      showToast(error instanceof Error ? error.message : `Unable to read ${file.name}.`, "danger");
    } finally {
      setIsParsingBulk(false);
    }
  };

  const handleBulkFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processBulkFile(file);
  };

  const handleCommitBulkImport = () => {
    if (!bulkFileName || parsedBulkQuestions.length === 0) {
      showToast("Please upload a spreadsheet or Word question pack.", "danger");
      return;
    }

    if (!bulkSubjectInfo) {
      showToast("Please select the subject for these questions.", "danger");
      return;
    }
    const targetSub = bulkSubjectInfo.name;
    const batchId = Date.now();
    const importedQuestions: QuestionItem[] = parsedBulkQuestions.map((parsed, index) => ({
      ...parsed,
      id: `q-bulk-${batchId}-${index + 1}`,
      code: `Q-${targetSub.slice(0, 3).toUpperCase()}-${String(index + 1).padStart(3, "0")}`,
      subject: targetSub,
      unit: parsed.unit || "1",
      topic: parsed.topic || "General",
      type: parsed.type || "Descriptive",
      difficulty: parsed.difficulty || "Medium",
      marks: parsed.marks || 2,
      status: "Pending",
      uploadedBy: submitter.name || "Faculty",
      email: submitter.email,
      uploadedOnBehalfBy: submitter.onBehalfBy,
      sourceFile: bulkFileName,
    }));

    importedQuestions.forEach((question) => examStore.saveQuestion(question));
    // Share the original file so reviewers (Academic Repository) can open it on any device.
    const sharedFileName = bulkFileName;
    void getQuestionBankDocument(sharedFileName)
      .then((blob) =>
        blob
          ? uploadQuestionBankDocumentToCloud(blob, sharedFileName, {
              uploadedBy: submitter.name || "Faculty",
              uploaderEmail: submitter.email,
              subject: targetSub,
              department: importedQuestions[0]?.department || bulkSubjectInfo.department,
            })
          : false,
      )
      .catch(() => false);
    showToast(`${importedQuestions.length} questions from "${bulkFileName}" inserted into Question Bank.`);
    setParsedBulkCount(0);
    setParsedBulkQuestions([]);
    setShowBulkPreview(false);
    if (bulkFileRef.current) bulkFileRef.current.value = "";
  };

  // ---------------- "YOUR UPLOADS": saved syllabi & question banks ----------------
  // Lets a staff member delete what they saved earlier (even after a reload);
  // deletion also removes it from the HOD / Dean / COE review screens.
  const ownerKey = (value: string) => value.toLowerCase().replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s*/i, "").trim();
  const isMine = (email?: string, name?: string) =>
    Boolean(
      (currentUser.email && email && email.toLowerCase() === currentUser.email.toLowerCase()) ||
        (currentUser.name && name && ownerKey(name) === ownerKey(currentUser.name)),
    );
  const myQuestionBanks: MyUploadItem[] = React.useMemo(() => {
    const groups = new Map<string, { subject: string; total: number; approved: number; finalized: number }>();
    questions
      .filter((q) => q.sourceFile && isMine(q.email, q.uploadedBy))
      .forEach((q) => {
        const key = q.sourceFile as string;
        const group = groups.get(key) || { subject: q.subject || "—", total: 0, approved: 0, finalized: 0 };
        group.total += 1;
        if (q.status === "Approved") group.approved += 1;
        if (q.status === "Approved" && (q.verifiedRole || "").toUpperCase() === "COE") group.finalized += 1;
        groups.set(key, group);
      });
    return [...groups.entries()].map(([fileName, g]) => ({
      id: fileName,
      fileName,
      subject: g.subject,
      detail: `${g.total} question${g.total === 1 ? "" : "s"}`,
      status: g.finalized > 0 ? "Final approval complete" : g.approved > 0 ? `${g.approved} approved` : "Awaiting review",
      locked: g.finalized > 0,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, currentUser]);
  const mySyllabi: MyUploadItem[] = React.useMemo(
    () =>
      syllabusApprovalList
        .filter((item) => isMine(item.submitterEmail, item.submittedBy))
        .map((item) => ({
          id: item.id,
          fileName: item.documentName || item.courseName,
          subject: `${item.courseName}${item.courseCode ? ` (${item.courseCode})` : ""}`,
          detail: item.semester || "Syllabus",
          status: item.coeStatus === "Approved" ? "Final approval complete" : item.hodStatus === "Approved" ? "Verified by HOD" : "Awaiting review",
          locked: item.coeStatus === "Approved",
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [syllabusApprovalList, currentUser],
  );

  // Question bank files uploaded before the shared repository existed live only
  // in this browser; copy them up so reviewers on other devices can open them.
  useEffect(() => {
    const files = new Map<string, { fileName: string; meta: { uploadedBy?: string; uploaderEmail?: string; subject?: string; department?: string } }>();
    questions
      .filter((q) => q.sourceFile && isMine(q.email, q.uploadedBy))
      .forEach((q) => {
        const fileName = q.sourceFile as string;
        if (!files.has(fileName)) files.set(fileName, { fileName, meta: { uploadedBy: q.uploadedBy, uploaderEmail: q.email, subject: q.subject, department: q.department } });
      });
    if (files.size) void syncLocalQuestionBankDocuments([...files.values()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions.length, currentUser.email]);

  const handleDeleteSavedQuestionBank = async (item: MyUploadItem) => {
    if (!(await confirmDialog(`Delete the question bank "${item.fileName}" (${item.detail})? It will also be removed from the HOD, Dean and COE review pages.`, { danger: true }))) return;
    const removed = examStore.deleteQuestionsBySource(item.fileName, currentUser.email, currentUser.name);
    if (bulkFileName === item.fileName) {
      setBulkFileName(null);
      setBulkFileUrl(null);
      setBulkSourceText(null);
      setParsedBulkCount(0);
      setParsedBulkQuestions([]);
      setBulkUploadedSubject(null);
      setBulkSubject("");
    }
    setQuestions(examStore.getQuestions());
    showToast(`Question bank "${item.fileName}" deleted (${removed} questions).`, "danger");
  };

  const handleDeleteSavedSyllabus = async (item: MyUploadItem) => {
    if (!(await confirmDialog(`Delete the syllabus "${item.fileName}"? It will also be removed from the HOD, Dean and COE review pages.`, { danger: true }))) return;
    const record = syllabusApprovalList.find((entry) => entry.id === item.id);
    examStore.deleteSyllabusApproval(item.id);
    if (record?.courseName) examStore.deleteSubjectSyllabus(record.courseName);
    if (savedSyllabus && record && (savedSyllabus.code === record.courseCode || savedSyllabus.name === record.courseName)) {
      setSavedSyllabus(null);
    }
    setSyllabusApprovalList(examStore.getSyllabusApprovals());
    showToast(`Syllabus "${item.fileName}" deleted.`, "danger");
  };

  const handleDeleteBulkUpload = () => {
    if (!bulkFileName && parsedBulkQuestions.length === 0) {
      showToast("No question bank upload to delete.", "danger");
      return;
    }

    const sourceFile = bulkFileName;
    if (sourceFile) {
      examStore
        .getQuestions()
        .filter((question) => question.sourceFile === sourceFile)
        .forEach((question) => examStore.deleteQuestion(question.id));
    }

    setBulkFileName(null);
    setBulkFileUrl(null);
    setBulkSourceText(null);
    setParsedBulkCount(0);
    setParsedBulkQuestions([]);
    setShowBulkPreview(false);
    setBulkUploadedSubject(null);
    setBulkSubject("");
    if (bulkFileRef.current) bulkFileRef.current.value = "";
    showToast(sourceFile ? `Question bank "${sourceFile}" deleted.` : "Question bank upload removed.", "danger");
  };

  const handleSaveManualQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualQuestionText.trim()) {
      showToast("Please enter the question statement.", "danger");
      return;
    }

    const targetSub = manualSubject || (subjects[0]?.name ?? "General");
    const options =
      manualType === "MCQ"
        ? [
            `A) ${manualOptionA.trim() || "Option A"}`,
            `B) ${manualOptionB.trim() || "Option B"}`,
            `C) ${manualOptionC.trim() || "Option C"}`,
            `D) ${manualOptionD.trim() || "Option D"}`,
          ]
        : undefined;

    const newQ: QuestionItem = {
      id: `q-man-${Date.now()}`,
      code: `Q-${targetSub.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      question: manualQuestionText.trim(),
      subject: targetSub,
      unit: String(manualUnit),
      topic: manualTopic,
      type: manualType,
      difficulty: manualDifficulty,
      marks: manualMarks,
      bloomLevel: manualBloom as any,
      status: "Pending",
      options: options,
      correctAnswer: manualType === "MCQ" ? `Option ${manualCorrectAnswer}` : undefined,
      uploadedBy: submitter.name || "Faculty",
      email: submitter.email,
      uploadedOnBehalfBy: submitter.onBehalfBy,
    };

    examStore.saveQuestion(newQ);
    showToast(`Question "${newQ.code}" saved to Question Bank!`);
    setManualQuestionText("");
    setManualOptionA("");
    setManualOptionB("");
    setManualOptionC("");
    setManualOptionD("");
  };

  // Toast State
  const [toast, setToast] = useState<{ message: string; isOpen: boolean; type?: "success" | "danger" }>({
    message: "",
    isOpen: false,
  });

  const showToast = (message: string, type: "success" | "danger" = "success") => {
    setToast({ message, isOpen: true, type });
    setTimeout(() => setToast((prev) => ({ ...prev, isOpen: false })), 3000);
  };

  return (
    <RoleGuard route="/academic-vault">
      <div
        style={{
          display: "flex",
          height: "100vh",
          maxHeight: "100vh",
          background: "var(--workspace-canvas)",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          color: "var(--workspace-ink)",
          width: "100%",
          maxWidth: "100vw",
          overflow: "hidden",
        }}
      >
        {/* ================================= SIDEBAR ================================= */}
        <aside className="digital-vfx-sidebar"
          style={{
            width: "260px",
            background: "linear-gradient(180deg, #1c120c 0%, #120c08 100%)",
            color: "#94a3b8",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            borderRight: "1px solid rgba(255, 255, 255, 0.06)",
            padding: "20px 14px",
            justifyContent: "space-between",
            height: "100vh",
            overflowY: "auto",
            zIndex: 10,
          }}
        >
          <div>
            {/* RGU Logo with 3D ambient glow */}
            <div style={{ padding: "6px 10px 24px 10px", position: "relative" }}>
              <div className="brand-orbit-logo" aria-label="Rathinam Global (Deemed to be University)"><span className="brand-orbit-mark">RG</span><span className="brand-orbit-name">Rathinam Global</span></div>
            </div>

            {/* Navigation Items with 3D Glow Icons and Animations */}
            <nav style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {menuItems.map((item) => {
                const IconComp = item.icon;
                const isActive = item.id === "academic-vault";

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.route) router.push(item.route);
                    }}
                    data-route={item.route} className={`sidebar-btn-3d ${isActive ? "sidebar-btn-active" : "sidebar-btn-inactive"}`}
                  >
                    <span className="nav-icon-3d" style={{ display: "flex", alignItems: "center" }}>
                      <NavIcon route={item.route} fallback={IconComp} />
                    </span>
                    <span style={{ flex: 1 }}>{item.label}</span>

                    {item.badge && (
                      <span className="badge-neon-3d">
                        {item.badge}
                      </span>
                    )}

                    {item.hasArrow && (
                      <ChevronRight
                        size={16}
                        color="#ffffff"
                        style={{
                          transition: "transform 0.2s ease",
                          filter: "drop-shadow(0 0 4px rgba(255,255,255,0.6))",
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* 3D Need Help Box with Floating Glowing Shield */}
          <div className="support-card-3d">
            <div className="shield-icon-3d">
              <Shield size={20} />
            </div>
            <strong style={{ display: "block", color: "#ffffff", fontSize: "13.5px", marginBottom: "4px" }}>
              Need Help?
            </strong>
            <p style={{ fontSize: "11.5px", color: "#94a3b8", lineHeight: 1.4, margin: "0 0 14px 0" }}>
              Our support team is ready to assist you.
            </p>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("open-exam-support-modal"));
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                width: "100%",
                padding: "9px 12px",
                borderRadius: "10px",
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <span>Contact Support</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </aside>

        {/* ================================= MAIN CONTENT ================================= */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            height: "100vh",
            maxHeight: "100vh",
            overflow: "hidden",
            background: "#f4f6fa",
            color: "#0f172a",
          }}
        >
          <PortalHeader
            activeRoute="/academic-vault"
          />

          {/* Main Content Area */}
          <main
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            {/* Top Page Title Ribbon */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div>
                <h1
                  style={{
                    fontSize: "22px",
                    fontWeight: 800,
                    color: "#0f172a",
                    margin: 0,
                    letterSpacing: "-0.02em",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  Academic Vault 🏛️
                </h1>
              </div>

              {currentUser.role === "HOD" && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", borderRadius: "12px", background: "#ffffff", border: "1px solid #c7d2fe", boxShadow: "0 1px 4px rgba(40, 26, 17,0.04)" }}>
                  <label htmlFor="vault-submit-for" style={{ fontSize: "11px", fontWeight: 800, color: "#c07d42", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                    Submitting for
                  </label>
                  <select
                    id="vault-submit-for"
                    value={submitForId}
                    onChange={(event) => setSubmitForId(event.target.value)}
                    style={{ minWidth: "240px", padding: "7px 10px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#0f172a", fontSize: "12.5px", fontWeight: 700, cursor: "pointer" }}
                  >
                    <option value="self">Myself · {currentUser.name} (HOD subject)</option>
                    {departmentFaculty.map((faculty) => (
                      <option key={faculty.id} value={faculty.id}>
                        {faculty.name}{faculty.department ? ` · ${faculty.department}` : ""}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: "11px", color: "#64748b", maxWidth: "260px" }}>
                    {selectedFaculty
                      ? `Saved under ${selectedFaculty.name}. You verify it, then it goes to the Dean.`
                      : "Your own subject. You verify it, then it goes to the Dean."}
                  </span>
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* 2-PARTITION SPLIT LAYOUT (LEFT: SYLLABUS UPLOAD | RIGHT: QB UPLOAD)       */}
            {/* ========================================================================= */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "20px",
                alignItems: "stretch",
              }}
            >
              {/* ========================================================= */}
              {/* LEFT PARTITION: SYLLABUS UPLOAD                           */}
              {/* ========================================================= */}
              <div className="vault-panel vault-panel-syllabus" style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
                {/* 1. Left Header Banner */}
                <div
                  style={{
                    background: "linear-gradient(135deg, var(--vp-grad-a) 0%, var(--vp-grad-b) 100%)",
                    borderRadius: "14px",
                    padding: "14px 18px",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    boxShadow: "0 4px 14px var(--vp-glow)",
                  }}
                >
                  <div
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "8px",
                      background: "rgba(255, 255, 255, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <FileText size={18} />
                  </div>
                  <div style={{ fontSize: "15px", fontWeight: 800 }}>1. Syllabus Upload</div>
                </div>

                {/* 2. Left Upload Card */}
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "14px",
                    padding: "18px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                  }}
                >
                  <div style={{ fontSize: "13.5px", fontWeight: 800, color: "#1e293b", marginBottom: "12px" }}>
                    📤 Upload Syllabus Document
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", marginBottom: "10px" }}>
                    {([
                      ["excel", "Excel", ".xlsx"],
                      ["word", "Word", ".docx"],
                      ["pdf", "PDF", ".pdf"],
                      ["diagram", "Diagram", ".png/.jpg"],
                    ] as const).map(([value, label, extension]) => (
                      <button key={value} type="button" onClick={() => { setSyllabusFormat(value); setSyllabusFile(null); setSyllabusFileName(null); setSyllabusFileUrl(null); setSyllabusPreviewText(null); if (syllabusFileRef.current) syllabusFileRef.current.value = ""; }} style={{ padding: "7px 4px", borderRadius: "7px", border: syllabusFormat === value ? "1px solid var(--vp-accent)" : "1px solid #e2e8f0", background: syllabusFormat === value ? "var(--vp-soft)" : "#ffffff", color: syllabusFormat === value ? "var(--vp-text)" : "#64748b", fontSize: "10.5px", fontWeight: 800, cursor: "pointer" }}>
                        {label}<span style={{ display: "block", fontSize: "9px", fontWeight: 600, marginTop: "2px" }}>{extension}</span>
                      </button>
                    ))}
                  </div>

                  {/* Compact File Dropzone */}
                  <div
                    className={`question-bank-dropzone${isSyllabusDragOver ? " is-drag-over" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => syllabusFileRef.current?.click()}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); syllabusFileRef.current?.click(); } }}
                    onDragEnter={(event) => { event.preventDefault(); setIsSyllabusDragOver(true); }}
                    onDragOver={(event) => { event.preventDefault(); setIsSyllabusDragOver(true); }}
                    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsSyllabusDragOver(false); }}
                    onDrop={(event) => { event.preventDefault(); setIsSyllabusDragOver(false); const file = event.dataTransfer.files?.[0]; if (file) void processSyllabusFile(file); }}
                    style={{
                      border: "2px dashed var(--vp-border)",
                      borderRadius: "12px",
                      padding: "36px 20px",
                      textAlign: "center",
                      background: syllabusFileName ? "#f0f9ff" : "#f0f9ff",
                      cursor: "pointer",
                      marginBottom: "14px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      flex: 1,
                      minHeight: "190px",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <input
                      type="file"
                      ref={syllabusFileRef}
                      onChange={handleSyllabusFileUpload}
                      accept={syllabusFormat === "excel" ? ".xlsx,.xls" : syllabusFormat === "word" ? ".docx,.doc" : syllabusFormat === "pdf" ? ".pdf" : ".png,.jpg,.jpeg,.svg,.webp"}
                      style={{ display: "none" }}
                    />
                    <div className="question-bank-file-orb syllabus-file-orb"><UploadCloud size={24} className="question-bank-file-glyph" /></div>
                    <div style={{ fontSize: "13px", fontWeight: 800, color: syllabusFileName ? "var(--vp-uploaded)" : "#334155" }}>
                      {syllabusFileName ? "Uploaded" : `Click or Drag & Drop ${syllabusFormat === "excel" ? "Excel" : syllabusFormat === "word" ? "Word" : syllabusFormat === "pdf" ? "PDF" : "Diagram"} file`}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>
                      Selected: {syllabusFormat === "excel" ? "Excel (.xlsx, .xls)" : syllabusFormat === "word" ? "Word (.docx, .doc)" : syllabusFormat === "pdf" ? "PDF (.pdf)" : "Diagram (.png, .jpg, .svg)"}
                    </div>
                  </div>

                  {syllabusFileName && syllabusFileUrl && (
                    <div onClick={() => setShowSyllabusFilePreview(true)} title="View uploaded document" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "9px 11px", marginBottom: "14px", borderRadius: "10px", background: "var(--vp-soft)", border: "1px solid var(--vp-border)", boxShadow: "0 4px 12px var(--vp-glow)", cursor: "pointer" }}>
                      <div style={{ minWidth: 0, fontSize: "11.5px", color: "var(--vp-text)", fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📄 {syllabusFileName}</div>
                      <button type="button" onClick={(event) => { event.stopPropagation(); handleDeleteSyllabusUpload(); }} title="Remove uploaded syllabus" aria-label="Remove uploaded syllabus" style={{ display: "grid", placeItems: "center", flex: "0 0 30px", width: "30px", height: "30px", borderRadius: "9px", border: "1px solid #fecaca", background: "linear-gradient(145deg, #fff1f2, #ffe4e6)", color: "#be123c", cursor: "pointer", boxShadow: "0 2px 7px rgba(190,18,60,.12)", transition: "all .18s ease" }}><Trash2 size={14} /></button>
                    </div>
                  )}

                  {/* Form */}
                  <form onSubmit={handleSaveSyllabusPack} style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1, justifyContent: "space-between" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "10px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "3px" }}>
                            Subject Name *
                          </label>
                          <select
                            value={syllabusSubject}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSyllabusSubject(val);
                              const match = syllabusSubjectOptions.find((s) => s.name === val);
                              if (match) {
                                setSyllabusCode(match.code);
                                setSyllabusDepartment(match.department.replace("Department of ", ""));
                                if (match.semester) setSyllabusSemester(match.semester);
                              }
                            }}
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              borderRadius: "7px",
                              border: "1px solid #cbd5e1",
                              fontSize: "12.5px",
                              boxSizing: "border-box",
                              fontWeight: 600,
                              background: "#ffffff",
                              cursor: "pointer",
                            }}
                          >
                            <option value="">
                              {noAssignedSubjects ? "-- No subjects assigned to you yet --" : "-- Select Subject from Dropdown --"}
                            </option>
                            {syllabusSubjectOptions.map((s) => (
                              <option key={s.code} value={s.name}>
                                {s.name} ({s.code})
                              </option>
                            ))}
                          </select>
                          {noAssignedSubjects && (
                            <div style={{ marginTop: "4px", fontSize: "10.5px", color: "#8a7260", lineHeight: 1.35 }}>
                              Ask your HOD to allocate your subject (Staff Faculty → Allocate Subjects).
                            </div>
                          )}
                        </div>

                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "3px" }}>
                            Subject Code *
                          </label>
                          <select
                            value={syllabusCode}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSyllabusCode(val);
                              const match = syllabusSubjectOptions.find((s) => s.code === val);
                              if (match) {
                                setSyllabusSubject(match.name);
                                setSyllabusDepartment(match.department.replace("Department of ", ""));
                                if (match.semester) setSyllabusSemester(match.semester);
                              }
                            }}
                            required
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              borderRadius: "7px",
                              border: "1px solid #cbd5e1",
                              fontSize: "12.5px",
                              boxSizing: "border-box",
                              fontWeight: 600,
                              background: "#ffffff",
                              cursor: "pointer",
                            }}
                          >
                            <option value="">{noAssignedSubjects ? "-- No code assigned --" : "-- Select Code --"}</option>
                            {syllabusSubjectOptions.map((s) => (
                              <option key={s.code} value={s.code}>
                                {s.code} — {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "10px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "3px" }}>
                            Semester
                          </label>
                          <select
                            value={syllabusSemester}
                            onChange={(e) => setSyllabusSemester(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              borderRadius: "7px",
                              border: "1px solid #cbd5e1",
                              fontSize: "12.5px",
                              background: "#ffffff",
                              boxSizing: "border-box",
                              fontWeight: 600,
                            }}
                          >
                            <option value="">-- Select Semester --</option>
                            <option value="Semester 1">Semester 1</option>
                            <option value="Semester 2">Semester 2</option>
                            <option value="Semester 3">Semester 3</option>
                            <option value="Semester 4">Semester 4</option>
                            <option value="Semester 5">Semester 5</option>
                            <option value="Semester 6">Semester 6</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "3px" }}>
                            Department
                          </label>
                          <input
                            type="text"
                            value={syllabusDepartment}
                            onChange={(e) => setSyllabusDepartment(e.target.value)}
                            placeholder="e.g. Visual Communication"
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              borderRadius: "7px",
                              border: "1px solid #cbd5e1",
                              fontSize: "12.5px",
                              boxSizing: "border-box",
                              fontWeight: 600,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                      <button
                        type="button"
                        onClick={handleDeleteSyllabusUpload}
                        disabled={!syllabusFileName && !savedSyllabus}
                        title="Delete syllabus upload"
                        aria-label="Delete syllabus upload"
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "9px 14px", borderRadius: "8px", border: "1px solid #fecaca", background: (!syllabusFileName && !savedSyllabus) ? "#f8fafc" : "#fff1f2", color: (!syllabusFileName && !savedSyllabus) ? "#cbd5e1" : "#dc2626", fontSize: "12px", fontWeight: 700, cursor: (!syllabusFileName && !savedSyllabus) ? "not-allowed" : "pointer" }}
                      >
                        <Trash2 size={14} />
                        <span>Delete</span>
                      </button>
                      <button
                        type="submit"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "9px 20px",
                          borderRadius: "8px",
                          background: "linear-gradient(135deg, var(--vp-grad-a) 0%, var(--vp-grad-b) 100%)",
                          color: "#ffffff",
                          border: "none",
                          fontSize: "12.5px",
                          fontWeight: 700,
                          cursor: "pointer",
                          boxShadow: "0 2px 8px var(--vp-glow)",
                        }}
                      >
                        <CheckCircle2 size={15} />
                        <span>Save & Ingest Syllabus</span>
                      </button>
                    </div>
                  </form>
                  <MyUploadsList title="Your uploaded syllabi" items={mySyllabi.filter((item) => !item.locked)} onDelete={handleDeleteSavedSyllabus} />
                </div>
              </div>

              {/* ========================================================= */}
              {/* RIGHT PARTITION: QUESTION BANK UPLOAD                     */}
              {/* ========================================================= */}
              <div className="vault-panel vault-panel-qb" style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
                {/* 1. Right Header Banner */}
                <div
                  style={{
                    background: "linear-gradient(135deg, var(--vp-grad-a) 0%, var(--vp-grad-b) 100%)",
                    borderRadius: "14px",
                    padding: "14px 18px",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    boxShadow: "0 4px 14px var(--vp-glow)",
                  }}
                >
                  <div
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "8px",
                      background: "rgba(255, 255, 255, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <UploadCloud size={18} />
                  </div>
                  <div style={{ fontSize: "15px", fontWeight: 800 }}>2. Question Bank Upload</div>
                </div>

                {/* 2. Right Upload Card (Bulk & Manual Authoring) */}
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "14px",
                    padding: "18px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                  }}
                >
                  {/* Mode Switcher Buttons */}
                  <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                    <button
                      type="button"
                      onClick={() => setQbUploadMode("bulk")}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "none",
                        background: qbUploadMode === "bulk" ? "linear-gradient(135deg, var(--vp-grad-a) 0%, var(--vp-grad-b) 100%)" : "#f1f5f9",
                        color: qbUploadMode === "bulk" ? "#ffffff" : "#475569",
                        fontSize: "12.5px",
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <Upload size={14} />
                      <span>Upload Question Bank</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setQbUploadMode("manual")}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "none",
                        background: qbUploadMode === "manual" ? "linear-gradient(135deg, var(--vp-grad-a) 0%, var(--vp-grad-b) 100%)" : "#f1f5f9",
                        color: qbUploadMode === "manual" ? "#ffffff" : "#475569",
                        fontSize: "12.5px",
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <Edit3 size={14} />
                      <span>Manual Question</span>
                    </button>
                  </div>

                  {/* Mode A: Bulk Upload */}
                  {qbUploadMode === "bulk" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px", flex: 1, justifyContent: "space-between" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "6px" }}>
                        {([
                          ["excel", "Excel", ".xlsx/.xls"],
                          ["word", "Word", ".docx/.doc"],
                          ["pdf", "PDF", ".pdf"],
                          ["diagram", "Diagram", ".png/.jpg"],
                        ] as const).map(([value, label, extension]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setBulkFormat(value);
                              setBulkFileName(null);
                              setBulkFileUrl(null);
                              setBulkSourceText(null);
                              setParsedBulkQuestions([]);
                              setParsedBulkCount(0);
                              if (bulkFileRef.current) bulkFileRef.current.value = "";
                            }}
                            style={{
                              padding: "8px 4px",
                              borderRadius: "8px",
                              border: bulkFormat === value ? "1px solid var(--vp-accent)" : "1px solid #cbd5e1",
                              background: bulkFormat === value ? "var(--vp-soft)" : "#ffffff",
                              color: bulkFormat === value ? "var(--vp-text)" : "#64748b",
                              fontSize: "11px",
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            {label}<br /><span style={{ fontSize: "9px", fontWeight: 600 }}>{extension}</span>
                          </button>
                        ))}
                      </div>
                      <div
                        className={`question-bank-dropzone${isBulkDragOver ? " is-drag-over" : ""}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => bulkFileRef.current?.click()}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); bulkFileRef.current?.click(); } }}
                        onDragEnter={(event) => { event.preventDefault(); setIsBulkDragOver(true); }}
                        onDragOver={(event) => { event.preventDefault(); setIsBulkDragOver(true); }}
                        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsBulkDragOver(false); }}
                        onDrop={(event) => { event.preventDefault(); setIsBulkDragOver(false); const file = event.dataTransfer.files?.[0]; if (file) void processBulkFile(file); }}
                        style={{
                          border: "2px dashed #cc9564",
                          borderRadius: "12px",
                          padding: "36px 20px",
                          textAlign: "center",
                          background: "#f0f9ff",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          flex: 1,
                          minHeight: "190px",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <input
                          type="file"
                          ref={bulkFileRef}
                          onChange={handleBulkFileUpload}
                          accept={
                            bulkFormat === "excel"
                              ? ".xlsx,.xls"
                              : bulkFormat === "word"
                                ? ".docx,.doc"
                                : bulkFormat === "pdf"
                                  ? ".pdf"
                                  : ".png,.jpg,.jpeg,.svg,.webp"
                          }
                          style={{ display: "none" }}
                        />
                        <div className="question-bank-file-orb"
                          style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "12px",
                            background: "var(--vp-soft)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: "2px",
                          }}
                        >
                          <FileSpreadsheet size={26} className="question-bank-file-glyph" />
                        </div>
                        <div style={{ fontSize: "14px", fontWeight: 800, color: bulkFileName ? "var(--vp-uploaded)" : "var(--vp-text)" }}>
                          {bulkFileName
                            ? "Uploaded"
                            : `Click to Browse Question Bank (${bulkFormat === "excel" ? "Excel" : bulkFormat === "word" ? "Word" : bulkFormat === "pdf" ? "PDF" : "Diagram"})`}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#64748b", maxWidth: "340px", lineHeight: 1.4 }}>
                          Upload one {bulkFormat === "excel" ? "Excel (.xlsx/.xls)" : bulkFormat === "word" ? "Word (.docx/.doc)" : bulkFormat === "pdf" ? "PDF (.pdf)" : "Diagram (.png/.jpg/.jpeg/.svg/.webp)"} question bank file. All questions will be previewed together before saving.
                        </div>
                        {isParsingBulk && <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--vp-text)" }}>Reading every question from the file...</div>}
                        {!isParsingBulk && (parsedBulkCount > 0 || bulkSourceText !== null) && (
                          <div style={{ fontSize: "12px", fontWeight: 800, color: "#15803d" }}>
                            ✓ {parsedBulkCount} questions found and converted to Bloom&apos;s Taxonomy pattern
                            {parsedBulkCount > 0 && (
                              <div style={{ fontSize: "11px", fontWeight: 700, color: "#475569", marginTop: "2px" }}>
                                {bloomGroups.length} unit{bloomGroups.length === 1 ? "" : "s"} · {parsedBulkQuestions.filter((q) => q.type === "MCQ").length} MCQ · {parsedBulkQuestions.filter((q) => q.type !== "MCQ").length} Descriptive
                              </div>
                            )}
                          </div>
                        )}
                        {!isParsingBulk && parsedBulkCount > 0 && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setBulkPreviewTab("bloom");
                              setShowBulkPreview(true);
                            }}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "7px 12px",
                              borderRadius: "7px",
                              border: "1px solid #deba9b",
                              background: "#ffffff",
                              color: "var(--vp-text)",
                              fontSize: "12px",
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            <Eye size={14} />
                            View Bloom&apos;s Pattern
                          </button>
                        )}
                      </div>

                      {bulkFileName && bulkFileUrl && !isParsingBulk && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "9px 11px", borderRadius: "8px", background: "#f0f9ff", border: "1px solid #bae6fd" }}>
                          <div style={{ minWidth: 0, fontSize: "11.5px", color: "var(--vp-text)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📊 {bulkFileName}</div>
                          <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                            <button type="button" onClick={() => { setBulkPreviewTab("original"); setShowBulkPreview(true); }} style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 10px", borderRadius: "7px", border: "1px solid #deba9b", background: "#ffffff", color: "var(--vp-text)", fontSize: "11px", fontWeight: 800, cursor: "pointer" }}>
                              <Eye size={13} /> View Original File
                            </button>
                          </div>
                        </div>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "10px", marginTop: "4px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "3px" }}>
                            Subject Name *
                          </label>
                          <select
                            value={bulkSubject}
                            onChange={(e) => setBulkSubject(e.target.value)}
                            style={{ width: "100%", padding: "8px 12px", borderRadius: "7px", border: "1px solid #cbd5e1", fontSize: "12.5px", boxSizing: "border-box", fontWeight: 600, background: "#ffffff", cursor: "pointer" }}
                          >
                            <option value="">
                              {noAssignedSubjects ? "-- No subjects assigned to you yet --" : "-- Select Subject from Dropdown --"}
                            </option>
                            {bulkSubjectOptions.map((s) => (
                              <option key={s.code} value={s.name}>
                                {s.name} ({s.code})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "3px" }}>
                            Subject Code *
                          </label>
                          <select
                            value={bulkSubjectInfo?.code || ""}
                            onChange={(e) => {
                              const match = bulkSubjectOptions.find((s) => s.code === e.target.value);
                              setBulkSubject(match ? match.name : "");
                            }}
                            style={{ width: "100%", padding: "8px 12px", borderRadius: "7px", border: "1px solid #cbd5e1", fontSize: "12.5px", boxSizing: "border-box", fontWeight: 600, background: "#ffffff", cursor: "pointer" }}
                          >
                            <option value="">{noAssignedSubjects ? "-- No code assigned --" : "-- Select Code --"}</option>
                            {bulkSubjectOptions.map((s) => (
                              <option key={s.code} value={s.code}>
                                {s.code} — {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {noAssignedSubjects && (
                        <div style={{ fontSize: "10.5px", color: "#8a7260", lineHeight: 1.35 }}>
                          Ask your HOD to allocate your subject (Staff Faculty → Allocate Subjects).
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                        <button
                          type="button"
                          onClick={handleDeleteBulkUpload}
                          disabled={!bulkFileName && parsedBulkQuestions.length === 0}
                          title="Delete question bank upload"
                          aria-label="Delete question bank upload"
                          style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "9px 14px", borderRadius: "8px", border: "1px solid #fecaca", background: (!bulkFileName && parsedBulkQuestions.length === 0) ? "#f8fafc" : "#fff1f2", color: (!bulkFileName && parsedBulkQuestions.length === 0) ? "#cbd5e1" : "#dc2626", fontSize: "12px", fontWeight: 700, cursor: (!bulkFileName && parsedBulkQuestions.length === 0) ? "not-allowed" : "pointer" }}
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCommitBulkImport}
                          disabled={isParsingBulk}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "9px 20px",
                            borderRadius: "8px",
                            background: "linear-gradient(135deg, var(--vp-grad-a) 0%, var(--vp-grad-b) 100%)",
                            color: "#ffffff",
                            border: "none",
                            fontSize: "12.5px",
                            fontWeight: 700,
                            cursor: isParsingBulk ? "not-allowed" : "pointer",
                            opacity: isParsingBulk ? 0.55 : 1,
                            boxShadow: "0 2px 8px var(--vp-glow)",
                          }}
                        >
                          <CheckCircle2 size={15} />
                          <span>{parsedBulkCount ? `Save & Ingest ${parsedBulkCount} Questions` : "Save & Ingest Questions"}</span>
                        </button>
                      </div>
                      <MyUploadsList title="Your uploaded question banks" items={myQuestionBanks.filter((item) => !item.locked)} onDelete={handleDeleteSavedQuestionBank} />
                    </div>
                  )}

                  {/* Mode B: Manual Question */}
                  {qbUploadMode === "manual" && (
                    <form onSubmit={handleSaveManualQuestion} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "8px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "2px" }}>Course</label>
                          <select
                            value={manualSubject}
                            onChange={(e) => setManualSubject(e.target.value)}
                            style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", background: "#ffffff", fontWeight: 600 }}
                          >
                            {subjects.length === 0 ? (
                              <option value="General">General</option>
                            ) : (
                              subjects.map((s) => (
                                <option key={s.id} value={s.name}>{s.name}</option>
                              ))
                            )}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "2px" }}>Unit</label>
                          <select
                            value={manualUnit}
                            onChange={(e) => setManualUnit(Number(e.target.value))}
                            style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", background: "#ffffff", fontWeight: 600 }}
                          >
                            <option value={1}>Unit 1</option>
                            <option value={2}>Unit 2</option>
                            <option value={3}>Unit 3</option>
                            <option value={4}>Unit 4</option>
                            <option value={5}>Unit 5</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "2px" }}>Question Text</label>
                        <textarea
                          rows={3}
                          value={manualQuestionText}
                          onChange={(e) => setManualQuestionText(e.target.value)}
                          placeholder="Enter question statement..."
                          required
                          style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", boxSizing: "border-box" }}
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "2px" }}>Type</label>
                          <select
                            value={manualType}
                            onChange={(e) => setManualType(e.target.value as any)}
                            style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "11.5px", background: "#ffffff", fontWeight: 600 }}
                          >
                            <option value="MCQ">MCQ</option>
                            <option value="Descriptive">Descriptive</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "2px" }}>Marks</label>
                          <input
                            type="number"
                            value={manualMarks}
                            onChange={(e) => setManualMarks(Number(e.target.value))}
                            min={1}
                            max={20}
                            style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "11.5px", boxSizing: "border-box", fontWeight: 600 }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "2px" }}>Bloom Level</label>
                          <select
                            value={manualBloom}
                            onChange={(e) => setManualBloom(e.target.value)}
                            style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "11.5px", background: "#ffffff", fontWeight: 600 }}
                          >
                            <option value="Remember">Remember</option>
                            <option value="Understand">Understand</option>
                            <option value="Apply">Apply</option>
                            <option value="Analyze">Analyze</option>
                          </select>
                        </div>
                      </div>

                      {manualType === "MCQ" && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", background: "#f8fafc", padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                          <input type="text" placeholder="Option A" value={manualOptionA} onChange={(e) => setManualOptionA(e.target.value)} style={{ padding: "5px 8px", fontSize: "11.5px", borderRadius: "4px", border: "1px solid #cbd5e1" }} />
                          <input type="text" placeholder="Option B" value={manualOptionB} onChange={(e) => setManualOptionB(e.target.value)} style={{ padding: "5px 8px", fontSize: "11.5px", borderRadius: "4px", border: "1px solid #cbd5e1" }} />
                          <input type="text" placeholder="Option C" value={manualOptionC} onChange={(e) => setManualOptionC(e.target.value)} style={{ padding: "5px 8px", fontSize: "11.5px", borderRadius: "4px", border: "1px solid #cbd5e1" }} />
                          <input type="text" placeholder="Option D" value={manualOptionD} onChange={(e) => setManualOptionD(e.target.value)} style={{ padding: "5px 8px", fontSize: "11.5px", borderRadius: "4px", border: "1px solid #cbd5e1" }} />
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
                        <button
                          type="submit"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "9px 20px",
                            borderRadius: "8px",
                            background: "linear-gradient(135deg, var(--vp-grad-a) 0%, var(--vp-grad-b) 100%)",
                            color: "#ffffff",
                            border: "none",
                            fontSize: "12.5px",
                            fontWeight: 700,
                            cursor: "pointer",
                            boxShadow: "0 2px 8px var(--vp-glow)",
                          }}
                        >
                          <CheckCircle2 size={15} />
                          <span>Save & Ingest Question</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </main>

          <PortalFooter />
        </div>
      </div>

      {showBulkPreview && bulkFileName && (
        <div
          onClick={() => setShowBulkPreview(false)}
          className="qbp-overlay"
        >
          <div onClick={(event) => event.stopPropagation()} className="qbp-card" role="dialog" aria-modal="true" aria-label="Question bank preview">
            <header className="qbp-head">
              <span className="qbp-head-icon"><FileText size={20} /></span>
              <div className="qbp-head-text">
                <div className="qbp-kicker">Question bank preview</div>
                <div className="qbp-title">{bulkSubjectInfo?.name || bulkSubject || "Uploaded question bank"}</div>
                <div className="qbp-meta">
                  <span title={bulkFileName}>{bulkFileName}</span>
                  <span>{parsedBulkCount} questions</span>
                </div>
              </div>
              <button type="button" onClick={() => setShowBulkPreview(false)} aria-label="Close preview" className="qbp-x">
                <X size={18} />
              </button>
            </header>
            <div className="qbp-toolbar">
              <div className="qbp-tabs" role="tablist" aria-label="Preview">
                {([["bloom", "Bloom's Taxonomy Pattern"], ["original", "Original File"]] as const).map(([key, label]) => (
                  <button key={key} type="button" role="tab" aria-selected={bulkPreviewTab === key} className={bulkPreviewTab === key ? "is-on" : ""} onClick={() => setBulkPreviewTab(key)}>
                    {label}
                  </button>
                ))}
              </div>
              <p className="qbp-note">
                {bulkPreviewTab === "bloom"
                  ? "Section A (MCQ) and Section B (Descriptive), unit-wise from L1 to L6."
                  : "The file exactly as it was uploaded."}
              </p>
            </div>
            <div className="qbp-body">
              {bulkPreviewTab === "bloom" ? (
                <BloomPatternView questions={parsedBulkQuestions} />
              ) : /* Word question banks: show the original document exactly as uploaded */
              bulkFileUrl && /\.docx$/i.test(bulkFileName) ? (
                <OriginalQuestionBankPreview name={bulkFileName} url={bulkFileUrl} fileAvailable />
              ) : bulkSourceText !== null && (
                <section style={{ border: "1px solid #d8e1ec", borderRadius: "13px", background: "#e9eef5", overflow: "hidden", padding: "18px" }}>
                  <div style={{ maxWidth: "900px", margin: "0 auto", border: "1px solid #e2e8f0", borderRadius: "8px", background: "#ffffff", boxShadow: "0 8px 24px rgba(40, 26, 17,.08)", overflow: "hidden" }}>
                    <div style={{ padding: "14px 24px", borderBottom: "1px solid #edf1f5", display: "flex", justifyContent: "space-between", gap: "12px", color: "#64748b", fontSize: "11px", fontWeight: 700 }}><span>DOCUMENT TEXT PREVIEW</span><span>{bulkFileName}</span></div>
                    <div style={{ padding: "24px clamp(18px, 5vw, 52px) 36px", maxHeight: "58vh", overflow: "auto", color: "#1e293b" }}>
                      {(bulkSourceText || "No readable text was found in this Word document.").split(/\r?\n/).filter((line) => line.trim()).map((line, lineIndex) => {
                        const value = line.trim();
                        const isUnit = /^unit\s+[ivx\d]+/i.test(value);
                        const isSection = /^section\b/i.test(value);
                        const isQuestion = /^\d+[.)]\s/.test(value);
                        const isOption = /^[A-D][.)]\s/i.test(value);
                        const isTitle = lineIndex === 0;
                        const isSummary = /^(total:|distribution:|each of the)/i.test(value);
                        return <div key={`${lineIndex}-${value}`} style={{
                          marginTop: isTitle ? 0 : isUnit ? 26 : isSection ? 16 : isQuestion ? 18 : isOption ? 6 : isSummary ? 10 : 9,
                          padding: isTitle ? "0 0 8px" : isUnit ? "12px 14px" : isSection ? "2px 0 6px" : isQuestion ? "12px 14px" : isSummary ? "9px 12px" : isOption ? "0 0 0 22px" : "0",
                          borderLeft: isUnit ? "3px solid #754b27" : isQuestion ? "3px solid #cbd5e1" : "none",
                          borderRadius: isUnit ? "0 9px 9px 0" : isQuestion ? "0 9px 9px 0" : 0,
                          background: isUnit ? "linear-gradient(90deg, #ecfeff, #f8fafc)" : isQuestion ? "#f8fafc" : isSummary ? "#f8fafc" : "transparent",
                          color: isUnit ? "#4c311f" : isSection ? "#774c28" : isOption ? "#746252" : isSummary ? "#746252" : "#1e293b",
                          fontSize: isTitle ? "21px" : isUnit ? "15px" : isSection ? "13px" : isQuestion ? "14px" : "13px",
                          fontWeight: isTitle || isUnit || isSection || isQuestion ? 750 : isSummary ? 600 : 450,
                          lineHeight: 1.65,
                          letterSpacing: isTitle ? "-0.02em" : isSection ? "0.02em" : undefined,
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                        }}>{value}</div>;
                      })}
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {showSyllabusFilePreview && syllabusFileUrl && syllabusFileName && (
        <div onClick={() => setShowSyllabusFilePreview(false)} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(40, 26, 17, 0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div onClick={(event) => event.stopPropagation()} style={{ width: "min(1080px, 100%)", height: "min(92vh, 900px)", background: "#ffffff", borderRadius: "16px", overflow: "hidden", boxShadow: "0 24px 80px rgba(40, 26, 17, 0.4)", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "12px 18px", borderBottom: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📄 {syllabusFileName}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <a href={syllabusFileUrl} download={syllabusFileName} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 10px", borderRadius: "8px", border: "1px solid #c7d2fe", background: "#eef2ff", color: "#c07d42", fontSize: "11px", fontWeight: 800, textDecoration: "none" }}><Download size={14} /> Download original</a>
                <button type="button" onClick={() => setShowSyllabusFilePreview(false)} aria-label="Close file preview" style={{ width: "32px", height: "32px", border: "none", borderRadius: "7px", background: "#f1f5f9", color: "#475569", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={17} /></button>
              </div>
            </div>
            <SyllabusDocumentPreview
              text={syllabusPreviewText || "The uploaded syllabus document is being prepared for preview."}
              fileName={syllabusFileName}
              subject={syllabusSubject}
              code={syllabusCode}
              semester={syllabusSemester}
              department={syllabusDepartment}
              fileUrl={syllabusFileUrl}
            />
            {false && (syllabusPreviewText !== null ? (
              <div style={{ flex: 1, overflow: "auto", padding: "32px 24px 48px", background: "linear-gradient(135deg, #e8edf5 0%, #f8fafc 55%, #e9eef8 100%)" }}>
                <div style={{ maxWidth: "850px", minHeight: "100%", margin: "0 auto", background: "#ffffff", border: "1px solid #dbe3ee", borderRadius: "4px", boxShadow: "0 12px 30px rgba(40, 26, 17, 0.12)", overflow: "hidden" }}>
                  <div style={{ padding: "34px 46px 28px", borderBottom: "1px solid #dbe3ee", background: "linear-gradient(135deg, #f8fafc, #eef2ff)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", marginBottom: "24px" }}><div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#d4a780" }}>Official Academic Document</div><div style={{ padding: "5px 9px", borderRadius: "999px", background: "#e0e7ff", color: "#c07d42", fontSize: "10px", fontWeight: 800 }}>FULL PREVIEW</div></div>
                    <div style={{ fontSize: "24px", fontWeight: 850, lineHeight: 1.25, color: "#4c311f" }}>Syllabus Document</div>
                    <div style={{ marginTop: "8px", fontSize: "12px", color: "#64748b" }}>{syllabusFileName}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginTop: "22px" }}>
                      {[["SUBJECT", syllabusSubject || "Academic syllabus"], ["SEMESTER", syllabusSemester || "—"], ["FORMAT", syllabusFormat.toUpperCase()]].map(([label, value]) => <div key={label} style={{ padding: "9px 10px", borderRadius: "9px", background: "rgba(255,255,255,0.72)", border: "1px solid #dbe3ee" }}><div style={{ fontSize: "9px", color: "#94a3b8", fontWeight: 800, letterSpacing: "0.08em" }}>{label}</div><div style={{ marginTop: "3px", color: "#334155", fontSize: "11px", fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div></div>)}
                    </div>
                  </div>
                  <div style={{ padding: "34px 46px 52px", fontFamily: "Arial, sans-serif" }}>
                    {(syllabusPreviewText || "").trim() ? (() => {
                      let currentUnitNumber = 0;
                      let currentTopicNumber = 0;
                      let currentOutcomeNumber = 0;
                      return (syllabusPreviewText || "").split(/\r?\n/).map((line, index) => {
                      const value = line.trim();
                      if (!value) return <div key={`space-${index}`} style={{ height: "10px" }} />;
                      const isTitle = index === 0;
                      const isUnit = /^(unit|module|chapter)\s*(\d+|[ivx]+)?\s*[:.)-]?/i.test(value);
                      const isLabel = /^(subject code|programme|level|course type|suggested credits|suggested contact hours|semester|department|unit|course objectives?|course outcomes?|topics?|references?)\s*:?$/i.test(value);
                      const isCourseOutcome = /^CO\s*\d+\s*[:.)-]?/i.test(value);
                      const isDocumentNote = /^(prepared from|note\s*[:.)-]?|source\s*[:.)-]?|document\s*[:.)-]?|academic year|version\s*[:.)-]?|remarks?\s*[:.)-]?)/i.test(value);
                      if (isLabel && /^course outcomes?\s*:?$/i.test(value)) currentOutcomeNumber = 0;
                      if (isUnit) {
                        currentUnitNumber += 1;
                        currentTopicNumber = 0;
                      }
                      const isTopic = currentUnitNumber > 0 && !isTitle && !isUnit && !isLabel && !isCourseOutcome && !isDocumentNote;
                      if (isCourseOutcome) currentOutcomeNumber += 1;
                      const topicNumber = isTopic ? `${++currentTopicNumber}` : "";
                      const outcomeNumber = isCourseOutcome ? `${currentOutcomeNumber}` : "";
                      const displayValue = isCourseOutcome ? value.replace(/^CO\s*\d+\s*[:.)-]?\s*/i, "") : value;
                      return (
                        <div key={`${value}-${index}`} style={{ display: "flex", alignItems: "flex-start", gap: (isTopic || isCourseOutcome) ? "12px" : 0, marginTop: isUnit ? "26px" : 0, marginBottom: isTitle ? "22px" : isUnit ? "12px" : isLabel ? "6px" : "14px", padding: isUnit ? "13px 16px" : isLabel ? "8px 10px" : (isTopic || isCourseOutcome) ? "7px 10px" : 0, borderLeft: isUnit ? "5px solid #ca9261" : isLabel ? "3px solid #deba9b" : (isTopic || isCourseOutcome) ? "3px solid #c7d2fe" : "none", borderBottom: isUnit || isLabel ? "1px solid #dbe3ee" : "none", borderRadius: isUnit ? "8px" : (isTopic || isCourseOutcome) ? "6px" : 0, background: isUnit ? "linear-gradient(135deg, #eef2ff, #f8fafc)" : isLabel ? "#f8faff" : (isTopic || isCourseOutcome) ? "#fbfdff" : "transparent", color: isTitle ? "#7e512a" : isUnit ? "#81552e" : isLabel ? "#c07d42" : "#334155", fontSize: isTitle ? "20px" : isUnit ? "15px" : isLabel ? "11px" : "13px", fontWeight: isTitle || isUnit || isLabel ? 800 : 500, letterSpacing: isUnit || isLabel ? "0.06em" : "normal", textTransform: isUnit || isLabel ? "uppercase" : "none", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", boxShadow: isUnit ? "0 3px 10px rgba(202, 146, 97, 0.08)" : "none" }}>
                          {(isTopic || isCourseOutcome) && <span style={{ flex: "0 0 32px", display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: "24px", borderRadius: "6px", background: isCourseOutcome ? "#dcfce7" : "#e0e7ff", color: isCourseOutcome ? "#166534" : "#c07d42", fontSize: "11px", fontWeight: 800, letterSpacing: 0 }}>{isCourseOutcome ? outcomeNumber : topicNumber}</span>}
                          <span style={{ flex: 1 }}>{displayValue}</span>
                        </div>
                      );
                      });
                    })() : <div style={{ color: "#64748b", textAlign: "center", padding: "48px 10px" }}>This Word document has no readable text.</div>}
                  </div>
                </div>
              </div>
            ) : (
              <iframe src={syllabusFileUrl || undefined} title={`Preview ${syllabusFileName}`} style={{ width: "100%", flex: 1, border: "none", background: "#f8fafc" }} />
            ))}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <ToastNotification
        message={toast.message}
        isOpen={toast.isOpen}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, isOpen: false }))}
      />
    </RoleGuard>
  );
}

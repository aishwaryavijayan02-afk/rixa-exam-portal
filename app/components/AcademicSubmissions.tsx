"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Download, Eye, FileText, Layers, Loader2, Search, X } from "lucide-react";
import { examStore, QuestionItem, SyllabusApprovalItem } from "../lib/examStore";
import { fetchQuestionBankDocument } from "../lib/questionBankDocuments";
import { unitNumber } from "../lib/bloomTaxonomy";

/** The parts of a School-page school card this view needs. */
export interface SubmissionSchool {
  id: string;
  name: string;
  departmentMatch?: string[];
  programmeGroups?: { items: string[] }[];
}

type SubmissionTab = "syllabus" | "questionBank";

interface SubmissionRow {
  kind: SubmissionTab;
  id: string;
  school: string;
  department: string;
  subject: string;
  staff: string;
  documentName: string;
  uploadedAt: string;
  syllabus?: SyllabusApprovalItem;
  questions?: QuestionItem[];
}

type ViewerState =
  | { status: "loading" }
  | { status: "file"; blob: Blob; url: string; kind: "pdf" | "docx" | "image" | "other" }
  | { status: "fallback"; reason: string };

const UNASSIGNED_SCHOOL = "Other / Unmapped";

// Extra words that identify a school's departments (on top of each card's departmentMatch).
const EXTRA_SCHOOL_WORDS: Record<string, string[]> = {
  "quantum-ai": ["artificial", "intelligence", "machine", "cyber", "data", "information", "technology", "forensics", "computing", "bca", "mca"],
  "business-commerce": ["bba", "mba", "bcom", "finance", "accounting", "logistics", "aviation"],
  "sports-health": ["psychology", "nutrition", "physiotherapy", "clinical"],
  "media-performing": ["visual", "communication", "vfx", "animation", "film", "journalism", "costume"],
  "liberal-arts": ["english", "languages", "literature", "humanities", "history", "mathematics", "physics", "chemistry", "tamil"],
  "applied-bio": ["biotechnology", "microbiology", "biochemistry", "agriculture"],
  "sustainability": ["environmental", "sustainable"],
};

const normalize = (value?: string) => (value || "").toLowerCase().replace(/^department of\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();
const cleanDepartment = (value?: string) => (value || "").replace(/^Department of\s+/i, "").trim();
const extensionOf = (name: string) => (name.split(".").pop() || "").toLowerCase();

/** School a department / subject belongs to, from the School page's own programme lists and keywords. */
function schoolFor(schools: SubmissionSchool[], department?: string, subject?: string): string {
  const dept = normalize(department);
  const subj = normalize(subject);
  if (!dept && !subj) return UNASSIGNED_SCHOOL;
  // 1) Department named like one of the school's programmes ("Visual Communication" -> "B.Sc Visual Communication").
  for (const school of schools) {
    const programmes = (school.programmeGroups || []).flatMap((group) => group.items.map(normalize));
    if (dept.length > 3 && programmes.some((programme) => programme.includes(dept))) return school.name;
  }
  // 2) Department keywords (whole words), then the subject name as a last resort.
  for (const text of [dept, subj]) {
    if (!text) continue;
    const words = ` ${text} `;
    for (const school of schools) {
      const keywords = [...(school.departmentMatch || []), ...(EXTRA_SCHOOL_WORDS[school.id] || [])];
      if (keywords.some((keyword) => words.includes(` ${keyword.toLowerCase()} `))) return school.name;
    }
  }
  return UNASSIGNED_SCHOOL;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime()) && /\d{4}-\d{2}-\d{2}|T\d{2}:/.test(value)) {
    return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }
  return value;
}

const sortKey = (value?: string) => {
  const parsed = new Date(value || "");
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

function documentKind(fileName: string, blob: Blob): "pdf" | "docx" | "image" | "other" {
  const ext = extensionOf(fileName);
  const type = blob.type || "";
  if (ext === "pdf" || type === "application/pdf") return "pdf";
  if (ext === "docx" || type.includes("wordprocessingml")) return "docx";
  if (["png", "jpg", "jpeg", "webp", "svg", "gif"].includes(ext) || type.startsWith("image/")) return "image";
  return "other";
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Word-compatible copy of saved questions, used when the original file is not stored. */
function savedQuestionsDocument(row: SubmissionRow): Blob {
  const byUnit = new Map<string, QuestionItem[]>();
  [...(row.questions || [])]
    .sort((a, b) => unitNumber(a.unit) - unitNumber(b.unit))
    .forEach((q) => byUnit.set(q.unit || "General", [...(byUnit.get(q.unit || "General") || []), q]));
  const list = (qs: QuestionItem[]) =>
    qs
      .map(
        (q, i) =>
          `<p><b>${i + 1}.</b> ${escapeHtml(q.question)}${q.bloomLevel ? ` <i>(${escapeHtml(q.bloomLevel)}, ${q.marks || 0} marks)</i>` : ""}</p>` +
          (q.options && q.options.length ? `<p style="margin-left:24px">${q.options.map((o, oi) => `(${String.fromCharCode(97 + oi)}) ${escapeHtml(o)}`).join("&nbsp;&nbsp;&nbsp;")}</p>` : ""),
      )
      .join("");
  const body = [...byUnit.entries()]
    .map(([unit, qs]) => {
      const mcq = qs.filter((q) => q.type === "MCQ");
      const descriptive = qs.filter((q) => q.type !== "MCQ");
      return `<h2>${escapeHtml(unit)}</h2>${mcq.length ? `<h3>Part A — MCQ</h3>${list(mcq)}` : ""}${descriptive.length ? `<h3>Part B — Descriptive</h3>${list(descriptive)}` : ""}`;
    })
    .join("");
  const html = `<html><head><meta charset="utf-8"></head><body style="font-family:Calibri,Arial,sans-serif"><h1>${escapeHtml(row.subject)} — Question Bank</h1><p>Uploaded by ${escapeHtml(row.staff)} · ${escapeHtml(row.department)} · ${escapeHtml(row.school)}</p>${body}</body></html>`;
  return new Blob(["﻿", html], { type: "application/msword" });
}

/** Original file for a row: the stored syllabus file, or the question bank file. */
async function loadOriginal(row: SubmissionRow): Promise<Blob | null> {
  try {
    if (row.kind === "syllabus" && row.syllabus) {
      const data = row.syllabus.documentData || (await examStore.fetchSyllabusDocument(row.id));
      return data ? await (await fetch(data)).blob() : null;
    }
    return await fetchQuestionBankDocument(row.documentName);
  } catch (error) {
    console.warn("Unable to load the uploaded document", error);
    return null;
  }
}

function DocxView({ blob }: { blob: Blob }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const container = ref.current;
    if (!container) return;
    container.replaceChildren();
    setFailed(false);
    void import("docx-preview")
      .then((docx) => docx.renderAsync(blob, container, container, { className: "approval-word-document", inWrapper: true, breakPages: true, renderHeaders: true, renderFooters: true }))
      .catch((error) => {
        console.error("Unable to render Word document", error);
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [blob]);
  if (failed) return <div style={{ padding: "40px", textAlign: "center", color: "#746252", fontSize: "13px" }}>This Word document could not be rendered in the browser. Use <strong>Download</strong> to open it in Microsoft Word.</div>;
  return <div ref={ref} style={{ padding: "16px", overflow: "auto" }} />;
}

/**
 * Scrutinizer-only view on the School page: every syllabus and question bank
 * uploaded by faculty, across all schools and departments.
 */
export default function AcademicSubmissions({ schools, initialSchool, onClose }: { schools: SubmissionSchool[]; initialSchool?: string; onClose: () => void }) {
  const [syllabi, setSyllabi] = useState<SyllabusApprovalItem[]>([]);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [tab, setTab] = useState<SubmissionTab>("syllabus");
  const [school, setSchool] = useState(initialSchool || "All");
  const [department, setDepartment] = useState("All");
  const [staff, setStaff] = useState("All");
  const [subject, setSubject] = useState("");
  const [selected, setSelected] = useState<SubmissionRow | null>(null);
  const [viewer, setViewer] = useState<ViewerState>({ status: "loading" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const objectUrl = useRef<string | null>(null);

  useEffect(() => {
    const load = () => {
      setSyllabi(examStore.getSyllabusApprovals());
      setQuestions(examStore.getQuestions());
    };
    load();
    window.addEventListener("exam-cell-store-update", load);
    return () => window.removeEventListener("exam-cell-store-update", load);
  }, []);

  useEffect(() => setSchool(initialSchool || "All"), [initialSchool]);

  const releaseUrl = () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
  };
  useEffect(() => releaseUrl, []);

  const syllabusRows = useMemo<SubmissionRow[]>(
    () =>
      syllabi
        .filter((item) => item.staffStatus !== "Draft")
        .map((item) => ({
          kind: "syllabus" as const,
          id: item.id,
          school: schoolFor(schools, item.department, item.courseName),
          department: cleanDepartment(item.department) || "—",
          subject: item.courseCode ? `${item.courseName} (${item.courseCode})` : item.courseName || "—",
          staff: item.submittedBy || "—",
          documentName: item.documentName || "Syllabus document",
          uploadedAt: item.submittedAt,
          syllabus: item,
        }))
        .sort((a, b) => sortKey(b.uploadedAt) - sortKey(a.uploadedAt)),
    [syllabi, schools],
  );

  const questionBankRows = useMemo<SubmissionRow[]>(() => {
    const groups = new Map<string, QuestionItem[]>();
    questions
      .filter((q) => q.sourceFile)
      .forEach((q) => groups.set(q.sourceFile as string, [...(groups.get(q.sourceFile as string) || []), q]));
    return [...groups.entries()]
      .map(([fileName, qs]) => {
        const first = qs[0];
        return {
          kind: "questionBank" as const,
          id: fileName,
          school: schoolFor(schools, first.department, first.subject),
          department: cleanDepartment(first.department) || "—",
          subject: first.subject || "—",
          staff: first.uploadedBy || "—",
          documentName: fileName,
          uploadedAt: first.uploadedOnDate || first.submittedDate || first.date || first.addedOn || "",
          questions: qs,
        };
      })
      .sort((a, b) => sortKey(b.uploadedAt) - sortKey(a.uploadedAt));
  }, [questions, schools]);

  const rows = tab === "syllabus" ? syllabusRows : questionBankRows;
  const schoolOptions = useMemo(() => [...schools.map((s) => s.name), ...(rows.some((r) => r.school === UNASSIGNED_SCHOOL) ? [UNASSIGNED_SCHOOL] : [])], [schools, rows]);
  const departmentOptions = useMemo(
    () => Array.from(new Set(rows.filter((r) => school === "All" || r.school === school).map((r) => r.department).filter((d) => d !== "—"))).sort(),
    [rows, school],
  );
  const staffOptions = useMemo(
    () =>
      Array.from(
        new Set(rows.filter((r) => (school === "All" || r.school === school) && (department === "All" || r.department === department)).map((r) => r.staff).filter((s) => s !== "—")),
      ).sort(),
    [rows, school, department],
  );

  const visible = useMemo(() => {
    const term = subject.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (school === "All" || r.school === school) &&
        (department === "All" || r.department === department) &&
        (staff === "All" || r.staff === staff) &&
        (!term || r.subject.toLowerCase().includes(term)),
    );
  }, [rows, school, department, staff, subject]);

  const view = async (row: SubmissionRow) => {
    releaseUrl();
    setSelected(row);
    setViewer({ status: "loading" });
    const blob = await loadOriginal(row);
    if (!blob) {
      setViewer({
        status: "fallback",
        reason:
          row.kind === "syllabus"
            ? "The original syllabus file was not stored with this upload. Showing the syllabus text captured at upload time."
            : "The original question bank file is stored only on the uploading staff member's device. Showing the questions saved in the database.",
      });
      return;
    }
    const url = URL.createObjectURL(blob);
    objectUrl.current = url;
    setViewer({ status: "file", blob, url, kind: documentKind(row.documentName, blob) });
  };

  const download = async (row: SubmissionRow, loaded?: Blob) => {
    setBusyId(row.id);
    const blob = loaded || (await loadOriginal(row));
    setBusyId(null);
    if (blob) return saveBlob(blob, row.documentName);
    if (row.kind === "questionBank") return saveBlob(savedQuestionsDocument(row), `${row.documentName.replace(/\.[^.]+$/, "")} - saved questions.doc`);
    const text = row.syllabus?.documentText || "";
    if (text) saveBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), `${row.documentName.replace(/\.[^.]+$/, "")}.txt`);
  };

  // ---- styles (RIXA cream / brown) ----
  const card: React.CSSProperties = { background: "#ffffff", border: "1px solid #ede4da", borderRadius: "16px", boxShadow: "0 4px 16px rgba(40, 26, 17, 0.04)" };
  const th: React.CSSProperties = { padding: "11px 14px", textAlign: "left", fontSize: "11px", fontWeight: 800, color: "#746252", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", background: "#fbf7f2", borderBottom: "1px solid #ede4da" };
  const td: React.CSSProperties = { padding: "12px 14px", fontSize: "13px", color: "#3f2a1c", verticalAlign: "top", borderBottom: "1px solid #f3ece4" };
  const select: React.CSSProperties = { padding: "9px 12px", borderRadius: "10px", border: "1px solid #deba9b", fontSize: "12.5px", fontWeight: 600, background: "#ffffff", color: "#4c311f", minWidth: "160px", maxWidth: "100%", flex: "1 1 160px" };
  const btn = (primary: boolean): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: "9px", border: primary ? "1px solid #774c28" : "1px solid #deba9b", background: primary ? "#774c28" : "#ffffff", color: primary ? "#ffffff" : "#774c28", fontSize: "12px", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" });

  const fallbackContent = () => {
    if (!selected) return null;
    if (selected.kind === "syllabus") {
      const text = selected.syllabus?.documentText || "";
      return text ? (
        <div style={{ maxWidth: "900px", margin: "0 auto", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "28px clamp(16px, 4vw, 44px)", whiteSpace: "pre-wrap", fontSize: "13.5px", lineHeight: 1.7 }}>{text}</div>
      ) : (
        <div style={{ padding: "40px", textAlign: "center", color: "#746252", fontSize: "13px" }}>No file or text is stored for this syllabus upload.</div>
      );
    }
    const byUnit = new Map<string, QuestionItem[]>();
    [...(selected.questions || [])]
      .sort((a, b) => unitNumber(a.unit) - unitNumber(b.unit))
      .forEach((q) => {
        const key = unitNumber(q.unit) === 99 ? q.unit || "General" : `Unit ${unitNumber(q.unit)}`;
        byUnit.set(key, [...(byUnit.get(key) || []), q]);
      });
    return (
      <div style={{ maxWidth: "940px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "14px" }}>
        {[...byUnit.entries()].map(([unit, qs]) => (
          <section key={unit} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", background: "#fbf7f2", borderLeft: "4px solid #754b27", color: "#4c311f", fontWeight: 800, fontSize: "14px" }}>{unit}</div>
            {([["Part A — MCQ", qs.filter((q) => q.type === "MCQ")], ["Part B — Descriptive", qs.filter((q) => q.type !== "MCQ")]] as const).map(([title, items]) =>
              items.length ? (
                <div key={title} style={{ padding: "8px 14px 12px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#774c28", margin: "4px 0 6px" }}>{title}</div>
                  {items.map((q, i) => (
                    <div key={String(q.id)} style={{ padding: "6px 0", borderTop: i ? "1px solid #f1f5f9" : "none", fontSize: "13px", whiteSpace: "pre-wrap" }}>
                      <strong>{i + 1}.</strong> {q.question}
                      {q.options && q.options.length > 0 && <div style={{ marginTop: "3px", color: "#746252", fontSize: "12.5px" }}>{q.options.map((o, oi) => `(${String.fromCharCode(97 + oi)}) ${o}`).join("   ")}</div>}
                    </div>
                  ))}
                </div>
              ) : null,
            )}
          </section>
        ))}
      </div>
    );
  };

  return (
    <div id="academic-submissions-section" style={{ width: "100%", marginBottom: "32px", scrollMarginTop: "24px" }}>
      <div style={{ ...card, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "16px 20px", borderBottom: "1px solid #ede4da", background: "linear-gradient(180deg, #fdf8f2, #ffffff)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ width: "38px", height: "38px", borderRadius: "11px", display: "grid", placeItems: "center", background: "#f6ebdd", border: "1px solid #ead6bf", color: "#774c28" }}>
              <FileText size={19} />
            </span>
            <div>
              <div style={{ fontSize: "17px", fontWeight: 800, color: "#2f1f14" }}>Academic Submissions</div>
              <div style={{ fontSize: "12px", color: "#746252" }}>Syllabus and question bank documents uploaded by faculty across all schools and departments</div>
            </div>
          </div>
          <button type="button" onClick={onClose} style={btn(false)} aria-label="Close Academic Submissions">
            <X size={14} /> Close
          </button>
        </div>

        {selected ? (
          /* ---------- Document preview ---------- */
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "14px 20px", borderBottom: "1px solid #ede4da" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                <button type="button" onClick={() => { releaseUrl(); setSelected(null); }} style={btn(false)}>
                  <ArrowLeft size={14} /> Back
                </button>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "14.5px", fontWeight: 800, color: "#2f1f14", overflowWrap: "anywhere" }}>{selected.documentName}</div>
                  <div style={{ fontSize: "12px", color: "#746252", marginTop: "2px" }}>
                    {selected.subject} · {selected.staff} · {selected.department} · {selected.school} · {formatDate(selected.uploadedAt)}
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => void download(selected, viewer.status === "file" ? viewer.blob : undefined)} style={btn(true)}>
                <Download size={14} /> Download
              </button>
            </div>
            <div style={{ background: "#efe8df", padding: "16px", minHeight: "55vh" }}>
              {viewer.status === "loading" && (
                <div style={{ display: "grid", placeItems: "center", minHeight: "45vh", color: "#746252", fontSize: "13px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Loader2 size={20} className="animate-spin" /> Loading document…
                  </div>
                </div>
              )}
              {viewer.status === "file" && viewer.kind === "pdf" && <iframe title={selected.documentName} src={viewer.url} style={{ width: "100%", height: "75vh", border: "1px solid #e2d6c8", borderRadius: "8px", background: "#ffffff" }} />}
              {viewer.status === "file" && viewer.kind === "docx" && (
                <div style={{ background: "#ffffff", border: "1px solid #e2d6c8", borderRadius: "8px", maxHeight: "75vh", overflow: "auto" }}>
                  <DocxView blob={viewer.blob} />
                </div>
              )}
              {viewer.status === "file" && viewer.kind === "image" && (
                <div style={{ textAlign: "center" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={viewer.url} alt={selected.documentName} style={{ maxWidth: "100%", maxHeight: "75vh", borderRadius: "8px", background: "#ffffff" }} />
                </div>
              )}
              {viewer.status === "file" && viewer.kind === "other" && (
                <div style={{ display: "grid", placeItems: "center", minHeight: "40vh", textAlign: "center", color: "#746252", fontSize: "13px", padding: "24px" }}>
                  <div>
                    <FileText size={32} style={{ marginBottom: "8px" }} />
                    <div>{extensionOf(selected.documentName).toUpperCase() || "This"} files cannot be previewed in the browser. Use <strong>Download</strong> to open the original file.</div>
                  </div>
                </div>
              )}
              {viewer.status === "fallback" && (
                <>
                  <div style={{ maxWidth: "940px", margin: "0 auto 14px", padding: "10px 14px", borderRadius: "9px", background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: "12.5px" }}>{viewer.reason}</div>
                  {fallbackContent()}
                </>
              )}
            </div>
          </div>
        ) : (
          <div style={{ padding: "16px 20px 20px" }}>
            {/* Tabs */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
              {([
                ["syllabus", "Syllabus Submissions", BookOpen, syllabusRows.length],
                ["questionBank", "Question Bank Submissions", Layers, questionBankRows.length],
              ] as const).map(([key, label, Icon, count]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setTab(key);
                    setDepartment("All");
                    setStaff("All");
                  }}
                  style={{ ...btn(tab === key), padding: "9px 15px", fontSize: "12.5px" }}
                >
                  <Icon size={15} /> {label}
                  <span style={{ padding: "1px 8px", borderRadius: "999px", fontSize: "11px", background: tab === key ? "rgba(255,255,255,0.22)" : "#f6ebdd" }}>{count}</span>
                </button>
              ))}
            </div>

            {/* Filters */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", marginBottom: "14px" }}>
              <select value={school} onChange={(e) => { setSchool(e.target.value); setDepartment("All"); setStaff("All"); }} style={select} aria-label="Filter by school">
                <option value="All">All schools</option>
                {schoolOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select value={department} onChange={(e) => { setDepartment(e.target.value); setStaff("All"); }} style={select} aria-label="Filter by department">
                <option value="All">All departments</option>
                {departmentOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select value={staff} onChange={(e) => setStaff(e.target.value)} style={select} aria-label="Filter by staff name">
                <option value="All">All staff</option>
                {staffOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <div style={{ position: "relative", flex: "2 1 220px", minWidth: 0 }}>
                <Search size={14} style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)", color: "#a08a76" }} />
                <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject name" style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 31px", borderRadius: "10px", border: "1px solid #deba9b", fontSize: "12.5px" }} />
              </div>
              {(school !== "All" || department !== "All" || staff !== "All" || subject) && (
                <button type="button" onClick={() => { setSchool("All"); setDepartment("All"); setStaff("All"); setSubject(""); }} style={btn(false)}>
                  <X size={13} /> Clear filters
                </button>
              )}
            </div>

            {/* Table */}
            <div style={{ border: "1px solid #ede4da", borderRadius: "12px", overflow: "hidden" }}>
              {visible.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "#746252", fontSize: "13.5px" }}>
                  {rows.length === 0
                    ? tab === "syllabus"
                      ? "No syllabus has been uploaded by faculty yet."
                      : "No question bank has been uploaded by faculty yet."
                    : "No submissions match the selected filters."}
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "980px" }}>
                    <thead>
                      <tr>
                        <th style={th}>School</th>
                        <th style={th}>Department</th>
                        <th style={th}>Subject</th>
                        <th style={th}>Staff (Uploaded By)</th>
                        <th style={th}>Document</th>
                        <th style={th}>Upload Date</th>
                        <th style={{ ...th, textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((row) => (
                        <tr key={`${row.kind}-${row.id}`}>
                          <td style={{ ...td, maxWidth: "200px" }}>{row.school}</td>
                          <td style={td}>{row.department}</td>
                          <td style={{ ...td, fontWeight: 700 }}>{row.subject}</td>
                          <td style={td}>
                            {row.staff}
                            {row.kind === "syllabus" && row.syllabus?.uploadedOnBehalfBy && <div style={{ fontSize: "11px", color: "#a08a76" }}>uploaded via {row.syllabus.uploadedOnBehalfBy}</div>}
                            {row.kind === "questionBank" && row.questions?.[0]?.uploadedOnBehalfBy && <div style={{ fontSize: "11px", color: "#a08a76" }}>uploaded via {row.questions[0].uploadedOnBehalfBy}</div>}
                          </td>
                          <td style={{ ...td, maxWidth: "240px" }}>
                            <div style={{ display: "flex", gap: "6px", alignItems: "flex-start", overflowWrap: "anywhere", fontWeight: 600 }}>
                              <FileText size={14} style={{ flexShrink: 0, marginTop: "2px", color: "#b4743c" }} /> {row.documentName}
                            </div>
                            {row.kind === "questionBank" && <div style={{ fontSize: "11px", color: "#a08a76", marginTop: "2px" }}>{row.questions?.length || 0} questions</div>}
                          </td>
                          <td style={{ ...td, whiteSpace: "nowrap" }}>{formatDate(row.uploadedAt)}</td>
                          <td style={{ ...td, textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: "6px" }}>
                              <button type="button" onClick={() => void view(row)} style={btn(true)}>
                                <Eye size={13} /> View
                              </button>
                              <button type="button" onClick={() => void download(row)} disabled={busyId === row.id} style={{ ...btn(false), opacity: busyId === row.id ? 0.6 : 1 }}>
                                {busyId === row.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Download
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

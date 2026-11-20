"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Download, Eye, FileText, FolderOpen, Layers, Loader2, Search, X } from "lucide-react";
import { examStore, QuestionItem, SyllabusApprovalItem } from "../lib/examStore";
import { authStore, AuthUser } from "../lib/auth";
import { fetchQuestionBankDocument } from "../lib/questionBankDocuments";
import { unitNumber } from "../lib/bloomTaxonomy";
import RoleGuard from "../components/RoleGuard";
import PortalHeader from "../components/PortalHeader";
import PortalFooter from "../components/PortalFooter";
import ScrutinizerSidebar from "../components/ScrutinizerSidebar";

type RepositoryTab = "syllabus" | "questionBank";

interface SyllabusRow {
  kind: "syllabus";
  id: string;
  department: string;
  subject: string;
  code: string;
  faculty: string;
  uploadedAt: string;
  fileName: string;
  record: SyllabusApprovalItem;
}

interface QuestionBankRow {
  kind: "questionBank";
  id: string;
  department: string;
  subject: string;
  faculty: string;
  units: { label: string; count: number }[];
  questionCount: number;
  uploadedAt: string;
  fileName: string;
  questions: QuestionItem[];
}

type RepositoryRow = SyllabusRow | QuestionBankRow;

/** What the preview panel shows once a document is opened. */
type ViewerState =
  | { status: "loading" }
  | { status: "file"; blob: Blob; url: string; kind: "pdf" | "docx" | "image" | "other" }
  | { status: "fallback"; reason: string };

const clean = (value?: string) => (value || "").replace(/^Department of\s+/i, "").trim();
const extensionOf = (name: string) => (name.split(".").pop() || "").toLowerCase();

function formatDate(value?: string): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime()) && /\d{4}-\d{2}-\d{2}|T\d{2}:/.test(value)) {
    return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }
  return value;
}

function sortKey(value?: string): number {
  const parsed = new Date(value || "");
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function documentKind(fileName: string, blob: Blob): "pdf" | "docx" | "image" | "other" {
  const ext = extensionOf(fileName);
  const type = blob.type || "";
  if (ext === "pdf" || type === "application/pdf") return "pdf";
  if (ext === "docx" || type.includes("wordprocessingml")) return "docx";
  if (["png", "jpg", "jpeg", "webp", "svg", "gif"].includes(ext) || type.startsWith("image/")) return "image";
  return "other";
}

function triggerDownload(blob: Blob, fileName: string) {
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

/** Word-compatible copy of the saved questions, used when the original file is not available. */
function questionsAsWordDocument(row: QuestionBankRow): Blob {
  const byUnit = new Map<string, QuestionItem[]>();
  [...row.questions]
    .sort((a, b) => unitNumber(a.unit) - unitNumber(b.unit))
    .forEach((q) => {
      const key = q.unit || "General";
      byUnit.set(key, [...(byUnit.get(key) || []), q]);
    });
  const body = [...byUnit.entries()]
    .map(([unit, items]) => {
      const mcq = items.filter((q) => q.type === "MCQ");
      const descriptive = items.filter((q) => q.type !== "MCQ");
      const list = (qs: QuestionItem[]) =>
        qs
          .map(
            (q, i) =>
              `<p><b>${i + 1}.</b> ${escapeHtml(q.question)}${q.bloomLevel ? ` <i>(${escapeHtml(q.bloomLevel)}, ${q.marks || 0} marks)</i>` : ""}</p>` +
              (q.options && q.options.length ? `<p style="margin-left:24px">${q.options.map((o, oi) => `(${String.fromCharCode(97 + oi)}) ${escapeHtml(o)}`).join("&nbsp;&nbsp;&nbsp;")}</p>` : "") +
              (q.correctAnswer && q.type === "MCQ" ? `<p style="margin-left:24px">Answer: ${escapeHtml(q.correctAnswer)}</p>` : ""),
          )
          .join("");
      return `<h2>${escapeHtml(unit)}</h2>${mcq.length ? `<h3>Part A — MCQ</h3>${list(mcq)}` : ""}${descriptive.length ? `<h3>Part B — Descriptive</h3>${list(descriptive)}` : ""}`;
    })
    .join("");
  const html = `<html><head><meta charset="utf-8"><title>${escapeHtml(row.subject)}</title></head><body style="font-family:Calibri,Arial,sans-serif"><h1>${escapeHtml(row.subject)} — Question Bank</h1><p>Faculty: ${escapeHtml(row.faculty)} · Department: ${escapeHtml(row.department)} · Source file: ${escapeHtml(row.fileName)}</p>${body}</body></html>`;
  return new Blob(["﻿", html], { type: "application/msword" });
}

/** Renders a .docx blob with docx-preview (same renderer as the review pages). */
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
      .then((docx) =>
        docx.renderAsync(blob, container, container, { className: "approval-word-document", inWrapper: true, breakPages: true, renderHeaders: true, renderFooters: true }),
      )
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

export default function AcademicRepositoryPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser>(() => authStore.getCurrentUser());
  const [syllabi, setSyllabi] = useState<SyllabusApprovalItem[]>([]);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [tab, setTab] = useState<RepositoryTab>("syllabus");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [faculty, setFaculty] = useState("All");
  const [selected, setSelected] = useState<RepositoryRow | null>(null);
  const [viewer, setViewer] = useState<ViewerState>({ status: "loading" });

  useEffect(() => {
    const handleAuth = () => setCurrentUser(authStore.getCurrentUser());
    const load = () => {
      setSyllabi(examStore.getSyllabusApprovals());
      setQuestions(examStore.getQuestions());
    };
    handleAuth();
    load();
    window.addEventListener("exam-cell-auth-update", handleAuth);
    window.addEventListener("exam-cell-store-update", load);
    return () => {
      window.removeEventListener("exam-cell-auth-update", handleAuth);
      window.removeEventListener("exam-cell-store-update", load);
    };
  }, []);

  // ---- Rows built from the real uploads ----
  const syllabusRows = useMemo<SyllabusRow[]>(
    () =>
      syllabi
        .filter((item) => item.staffStatus !== "Draft")
        .map((item) => ({
          kind: "syllabus" as const,
          id: item.id,
          department: clean(item.department) || "—",
          subject: item.courseName || "—",
          code: item.courseCode || "",
          faculty: item.submittedBy || "—",
          uploadedAt: item.submittedAt,
          fileName: item.documentName || `${item.courseName || "Syllabus"} (no file name)`,
          record: item,
        }))
        .sort((a, b) => sortKey(b.uploadedAt) - sortKey(a.uploadedAt)),
    [syllabi],
  );

  const questionBankRows = useMemo<QuestionBankRow[]>(() => {
    const groups = new Map<string, QuestionItem[]>();
    questions
      .filter((q) => q.sourceFile)
      .forEach((q) => {
        const key = q.sourceFile as string;
        groups.set(key, [...(groups.get(key) || []), q]);
      });
    return [...groups.entries()]
      .map(([fileName, qs]) => {
        const first = qs[0];
        const unitMap = new Map<string, { label: string; order: number; count: number }>();
        qs.forEach((q) => {
          const n = unitNumber(q.unit);
          const label = n === 99 ? q.unit || "General" : `Unit ${n}`;
          const entry = unitMap.get(label) || { label, order: n, count: 0 };
          entry.count += 1;
          unitMap.set(label, entry);
        });
        return {
          kind: "questionBank" as const,
          id: fileName,
          department: clean(first.department) || "—",
          subject: first.subject || "—",
          faculty: first.uploadedBy || "—",
          units: [...unitMap.values()].sort((a, b) => a.order - b.order).map(({ label, count }) => ({ label, count })),
          questionCount: qs.length,
          uploadedAt: first.uploadedOnDate || first.submittedDate || first.date || first.addedOn || "",
          fileName,
          questions: qs,
        };
      })
      .sort((a, b) => sortKey(b.uploadedAt) - sortKey(a.uploadedAt));
  }, [questions]);

  const rows: RepositoryRow[] = tab === "syllabus" ? syllabusRows : questionBankRows;
  const departments = useMemo(() => Array.from(new Set(rows.map((r) => r.department).filter((d) => d && d !== "—"))).sort(), [rows]);
  const faculties = useMemo(() => Array.from(new Set(rows.map((r) => r.faculty).filter((f) => f && f !== "—"))).sort(), [rows]);

  useEffect(() => {
    setDepartment("All");
    setFaculty("All");
  }, [tab]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!term || r.subject.toLowerCase().includes(term) || (r.kind === "syllabus" && r.code.toLowerCase().includes(term))) &&
        (department === "All" || r.department === department) &&
        (faculty === "All" || r.faculty === faculty),
    );
  }, [rows, search, department, faculty]);

  // ---- Viewer ----
  const objectUrlRef = useRef<string | null>(null);
  const releaseUrl = () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  };
  useEffect(() => releaseUrl, []);

  const openRow = async (row: RepositoryRow) => {
    releaseUrl();
    setSelected(row);
    setViewer({ status: "loading" });
    let blob: Blob | null = null;
    try {
      if (row.kind === "syllabus") {
        const data = row.record.documentData || (await examStore.fetchSyllabusDocument(row.id));
        if (data) blob = await (await fetch(data)).blob();
      } else {
        blob = await fetchQuestionBankDocument(row.fileName);
      }
    } catch (error) {
      console.warn("Unable to load the uploaded document", error);
    }
    if (!blob) {
      setViewer({
        status: "fallback",
        reason:
          row.kind === "syllabus"
            ? "The original syllabus file was not stored with this upload. Showing the syllabus text captured at upload time."
            : "The original file for this question bank is stored only on the faculty member's device. It will appear here once they open Academic Vault again (or re-upload it). Showing the questions saved in the database.",
      });
      return;
    }
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    setViewer({ status: "file", blob, url, kind: documentKind(row.fileName, blob) });
  };

  const closeViewer = () => {
    releaseUrl();
    setSelected(null);
  };

  const download = () => {
    if (!selected) return;
    if (viewer.status === "file") {
      triggerDownload(viewer.blob, selected.fileName);
    } else if (selected.kind === "questionBank") {
      triggerDownload(questionsAsWordDocument(selected), `${selected.fileName.replace(/\.[^.]+$/, "")} - saved questions.doc`);
    } else {
      const text = selected.record.documentText || "";
      triggerDownload(new Blob([text], { type: "text/plain;charset=utf-8" }), `${selected.fileName.replace(/\.[^.]+$/, "")}.txt`);
    }
  };

  const canDownload = viewer.status === "file" || (selected?.kind === "questionBank") || Boolean(selected?.kind === "syllabus" && selected.record.documentText);

  // ---- Styles ----
  const card = { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", boxShadow: "0 4px 16px rgba(0,0,0,0.02)" } as const;
  const th: React.CSSProperties = { padding: "11px 14px", textAlign: "left", fontSize: "11.5px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap", background: "#fbf8f4", borderBottom: "1px solid #ede4da" };
  const td: React.CSSProperties = { padding: "12px 14px", fontSize: "13px", color: "#334155", verticalAlign: "top", borderBottom: "1px solid #f1ece6" };
  const select: React.CSSProperties = { padding: "9px 12px", borderRadius: "9px", border: "1px solid #deba9b", fontSize: "12.5px", fontWeight: 600, background: "#ffffff", color: "#4c311f", minWidth: "170px", maxWidth: "100%" };
  const button = (primary: boolean): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "9px", border: primary ? "none" : "1px solid #deba9b", background: primary ? "#774c28" : "#ffffff", color: primary ? "#ffffff" : "#774c28", fontSize: "12.5px", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" });

  const renderFallback = () => {
    if (!selected) return null;
    if (selected.kind === "syllabus") {
      const text = selected.record.documentText || "";
      return text ? (
        <div style={{ maxWidth: "900px", margin: "0 auto", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "28px clamp(16px, 4vw, 44px)", whiteSpace: "pre-wrap", fontSize: "13.5px", lineHeight: 1.7, color: "#1e293b" }}>{text}</div>
      ) : (
        <div style={{ padding: "40px", textAlign: "center", color: "#746252", fontSize: "13px" }}>No file or text is stored for this syllabus upload.</div>
      );
    }
    const byUnit = new Map<string, QuestionItem[]>();
    [...selected.questions]
      .sort((a, b) => unitNumber(a.unit) - unitNumber(b.unit))
      .forEach((q) => {
        const key = unitNumber(q.unit) === 99 ? q.unit || "General" : `Unit ${unitNumber(q.unit)}`;
        byUnit.set(key, [...(byUnit.get(key) || []), q]);
      });
    return (
      <div style={{ maxWidth: "940px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "14px" }}>
        {[...byUnit.entries()].map(([unit, items]) => (
          <section key={unit} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", background: "linear-gradient(90deg, #ecfeff, #f8fafc)", borderLeft: "4px solid #754b27", color: "#4c311f", fontWeight: 800, fontSize: "14px" }}>{unit}</div>
            {([["Part A — MCQ", items.filter((q) => q.type === "MCQ")], ["Part B — Descriptive", items.filter((q) => q.type !== "MCQ")]] as const).map(([title, qs]) =>
              qs.length ? (
                <div key={title} style={{ padding: "8px 14px 12px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#774c28", margin: "4px 0 6px" }}>{title}</div>
                  {qs.map((q, i) => (
                    <div key={String(q.id)} style={{ padding: "6px 0", borderTop: i ? "1px solid #f1f5f9" : "none", fontSize: "13px", color: "#1e293b", whiteSpace: "pre-wrap" }}>
                      <strong>{i + 1}.</strong> {q.question}
                      {q.options && q.options.length > 0 && <div style={{ marginTop: "3px", color: "#746252", fontSize: "12.5px" }}>{q.options.map((o, oi) => `(${String.fromCharCode(97 + oi)}) ${o}`).join("   ")}</div>}
                      <div style={{ marginTop: "3px", fontSize: "11px", color: "#94a3b8" }}>{[q.bloomLevel, `${q.marks || 0} marks`].filter(Boolean).join(" · ")}</div>
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
    <RoleGuard route="/academic-repository">
      <div style={{ display: "flex", height: "100vh", maxHeight: "100vh", background: "#f4f6fb", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#0f172a", width: "100%", overflow: "hidden" }}>
        <ScrutinizerSidebar currentUser={currentUser} active="academic-repository" />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
          <PortalHeader activeRoute="/academic-repository" />
          <main className="digital-vfx-main" style={{ flex: 1, padding: "clamp(16px, 3vw, 28px) clamp(16px, 3vw, 32px)", overflowY: "auto", overflowX: "hidden", minWidth: 0, boxSizing: "border-box" }}>
            <div style={{ marginBottom: "20px" }}>
              <h1 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 6px 0", letterSpacing: "-0.4px", display: "flex", alignItems: "center", gap: "10px" }}>
                <FolderOpen size={24} color="#774c28" /> School &amp; Academic Repository
              </h1>
              <p style={{ fontSize: "13.5px", color: "#64748b", margin: 0 }}>Syllabus and question bank documents uploaded by faculty members.</p>
            </div>

            {selected ? (
              /* ---------------- Preview panel ---------------- */
              <div style={{ ...card, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "14px 18px", borderBottom: "1px solid #ede4da" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                    <button type="button" onClick={closeViewer} style={button(false)}>
                      <ArrowLeft size={15} /> Back
                    </button>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.fileName}</div>
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                        {selected.subject} · {selected.faculty} · {selected.department} · {formatDate(selected.uploadedAt)}
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={download} disabled={!canDownload} style={{ ...button(true), opacity: canDownload ? 1 : 0.5, cursor: canDownload ? "pointer" : "not-allowed" }}>
                    <Download size={15} /> Download
                  </button>
                </div>
                <div style={{ background: "#e9eef5", padding: "16px", minHeight: "60vh" }}>
                  {viewer.status === "loading" && (
                    <div style={{ display: "grid", placeItems: "center", minHeight: "50vh", color: "#64748b", fontSize: "13px", gap: "10px" }}>
                      <Loader2 size={26} className="animate-spin" /> Loading document…
                    </div>
                  )}
                  {viewer.status === "file" && viewer.kind === "pdf" && (
                    <iframe title={selected.fileName} src={viewer.url} style={{ width: "100%", height: "75vh", border: "1px solid #d8e1ec", borderRadius: "8px", background: "#ffffff" }} />
                  )}
                  {viewer.status === "file" && viewer.kind === "docx" && (
                    <div style={{ background: "#ffffff", border: "1px solid #d8e1ec", borderRadius: "8px", maxHeight: "75vh", overflow: "auto" }}>
                      <DocxView blob={viewer.blob} />
                    </div>
                  )}
                  {viewer.status === "file" && viewer.kind === "image" && (
                    <div style={{ textAlign: "center" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={viewer.url} alt={selected.fileName} style={{ maxWidth: "100%", maxHeight: "75vh", borderRadius: "8px", background: "#ffffff" }} />
                    </div>
                  )}
                  {viewer.status === "file" && viewer.kind === "other" && (
                    <div style={{ display: "grid", placeItems: "center", minHeight: "40vh", textAlign: "center", color: "#746252", fontSize: "13px", padding: "24px" }}>
                      <div>
                        <FileText size={34} style={{ marginBottom: "10px" }} />
                        <div>This file type ({extensionOf(selected.fileName).toUpperCase() || "unknown"}) cannot be previewed in the browser.</div>
                        <div style={{ marginTop: "4px" }}>Use <strong>Download</strong> to open the original file.</div>
                      </div>
                    </div>
                  )}
                  {viewer.status === "fallback" && (
                    <>
                      <div style={{ maxWidth: "940px", margin: "0 auto 14px", padding: "10px 14px", borderRadius: "9px", background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: "12.5px" }}>{viewer.reason}</div>
                      {renderFallback()}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* ---------------- Tabs ---------------- */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
                  {([
                    ["syllabus", "Syllabus Repository", BookOpen, syllabusRows.length],
                    ["questionBank", "Question Bank Repository", Layers, questionBankRows.length],
                  ] as const).map(([key, label, Icon, count]) => (
                    <button key={key} type="button" onClick={() => setTab(key)} style={{ ...button(tab === key), padding: "10px 16px", fontSize: "13px" }}>
                      <Icon size={16} /> {label}
                      <span style={{ padding: "1px 8px", borderRadius: "999px", fontSize: "11px", background: tab === key ? "rgba(255,255,255,0.22)" : "#fdf4ec" }}>{count}</span>
                    </button>
                  ))}
                </div>

                {/* ---------------- Search & filters ---------------- */}
                <div style={{ ...card, padding: "14px 16px", marginBottom: "16px", display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
                  <div style={{ position: "relative", flex: "1 1 240px", minWidth: 0 }}>
                    <Search size={15} style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by subject name" style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 32px", borderRadius: "9px", border: "1px solid #deba9b", fontSize: "12.5px" }} />
                  </div>
                  <select value={department} onChange={(e) => setDepartment(e.target.value)} style={select} aria-label="Filter by department">
                    <option value="All">All departments</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <select value={faculty} onChange={(e) => setFaculty(e.target.value)} style={select} aria-label="Filter by faculty">
                    <option value="All">All faculty</option>
                    {faculties.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  {(search || department !== "All" || faculty !== "All") && (
                    <button type="button" onClick={() => { setSearch(""); setDepartment("All"); setFaculty("All"); }} style={button(false)}>
                      <X size={14} /> Clear
                    </button>
                  )}
                </div>

                {/* ---------------- Table ---------------- */}
                <div style={{ ...card, overflow: "hidden" }}>
                  {visibleRows.length === 0 ? (
                    <div style={{ padding: "44px 20px", textAlign: "center", color: "#64748b", fontSize: "13.5px" }}>
                      {rows.length === 0
                        ? tab === "syllabus"
                          ? "No syllabus has been uploaded by faculty yet."
                          : "No question bank has been uploaded by faculty yet."
                        : "No documents match the search or filters."}
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: tab === "syllabus" ? "820px" : "960px" }}>
                        <thead>
                          <tr>
                            <th style={th}>Department</th>
                            <th style={th}>Subject</th>
                            <th style={th}>Faculty</th>
                            {tab === "questionBank" && <th style={th}>Unit Details</th>}
                            <th style={th}>Uploaded</th>
                            <th style={th}>{tab === "syllabus" ? "Syllabus File" : "Question Bank File"}</th>
                            <th style={{ ...th, textAlign: "right" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRows.map((row) => (
                            <tr key={row.id}>
                              <td style={td}>{row.department}</td>
                              <td style={{ ...td, fontWeight: 700, color: "#1e293b" }}>
                                {row.subject}
                                {row.kind === "syllabus" && row.code && <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#94a3b8" }}>{row.code}</div>}
                              </td>
                              <td style={td}>{row.faculty}</td>
                              {row.kind === "questionBank" && (
                                <td style={td}>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "260px" }}>
                                    {row.units.map((u) => (
                                      <span key={u.label} style={{ padding: "2px 8px", borderRadius: "999px", background: "#fdf4ec", border: "1px solid #f1dfc9", color: "#774c28", fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap" }}>
                                        {u.label} · {u.count}
                                      </span>
                                    ))}
                                  </div>
                                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>{row.questionCount} questions</div>
                                </td>
                              )}
                              <td style={{ ...td, whiteSpace: "nowrap" }}>{formatDate(row.uploadedAt)}</td>
                              <td style={{ ...td, maxWidth: "260px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#4c311f", fontWeight: 600, overflowWrap: "anywhere" }}>
                                  <FileText size={14} style={{ flexShrink: 0, color: "#b4743c" }} /> {row.fileName}
                                </div>
                              </td>
                              <td style={{ ...td, textAlign: "right" }}>
                                <button type="button" onClick={() => void openRow(row)} style={button(true)}>
                                  <Eye size={14} /> View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
            <PortalFooter />
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Flag,
  Layers,
  RotateCcw,
  Search,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Send,
} from "lucide-react";
import { examStore, QuestionItem, SyllabusApprovalItem } from "../lib/examStore";
import { authStore, AuthUser } from "../lib/auth";
import { BLOOM_LEVELS, detectExplicitBloomLevel, inferBloomLevel, unitNumber } from "../lib/bloomTaxonomy";
import RoleGuard from "../components/RoleGuard";
import ScrutinizerSidebar from "../components/ScrutinizerSidebar";
import PortalHeader from "../components/PortalHeader";
import PortalFooter from "../components/PortalFooter";
import { ToastNotification } from "../components/CrudModal";
import { confirmDialog } from "../components/ConfirmDialog";

type ScrutinyFilter = "Pending" | "Cleared" | "Flagged" | "All";

const LEVEL_COLORS = ["#64748b", "#0e7490", "#15803d", "#b45309", "#9333ea", "#be123c"];

/** Bloom's level (1–6) of a stored question: saved level, explicit tag, or action verb. */
function levelOf(q: QuestionItem): number {
  const saved = BLOOM_LEVELS.findIndex((name) => name.toLowerCase() === (q.bloomLevel || "").toLowerCase());
  if (saved >= 0) return saved + 1;
  return detectExplicitBloomLevel(q.bloomLevel || "") ?? detectExplicitBloomLevel(q.question) ?? inferBloomLevel(q.question) ?? (q.type === "MCQ" ? 1 : 2);
}

const isMcq = (q: QuestionItem) => q.type === "MCQ" || (q.options || []).filter(Boolean).length >= 2;
const unitLabel = (q: QuestionItem) => {
  const n = unitNumber(q.unit);
  return n === 99 ? q.unit || "General" : `Unit ${n}`;
};
const normalizeText = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Automatic scrutiny checks for one question (empty list = no issue found). */
function questionIssues(q: QuestionItem, duplicates: Set<string>): string[] {
  const issues: string[] = [];
  const text = (q.question || "").trim();
  if (text.length < 15) issues.push("Question text is very short");
  if (isMcq(q)) {
    const options = (q.options || []).filter((o) => o && o.trim());
    if (options.length < 4) issues.push(`MCQ has ${options.length} option${options.length === 1 ? "" : "s"} (4 expected)`);
    if (!(q.correctAnswer || "").trim()) issues.push("MCQ has no answer key");
  }
  if (!q.marks || q.marks <= 0) issues.push("Marks not set");
  if (duplicates.has(normalizeText(text))) issues.push("Duplicate question in this subject");
  return issues;
}

export default function ScrutinizerPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser>(() => authStore.getCurrentUser());
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [syllabi, setSyllabi] = useState<SyllabusApprovalItem[]>([]);
  const [syllabusFlag, setSyllabusFlag] = useState<{ id: string; remark: string } | null>(null);
  const [subject, setSubject] = useState<string>("");
  const [filter, setFilter] = useState<ScrutinyFilter>("Pending");
  const [search, setSearch] = useState("");
  const [flagDraft, setFlagDraft] = useState<{ id: string; remark: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; isOpen: boolean; type?: "success" | "danger" }>({ message: "", isOpen: false });

  const showToast = (message: string, type: "success" | "danger" = "success") => {
    setToast({ message, isOpen: true, type });
    setTimeout(() => setToast((prev) => ({ ...prev, isOpen: false })), 3000);
  };

  useEffect(() => {
    const handleAuth = () => setCurrentUser(authStore.getCurrentUser());
    const load = () => {
      setQuestions(examStore.getQuestions());
      setSyllabi(examStore.getSyllabusApprovals());
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

  // Workflow: Staff -> HOD -> Dean -> Scrutinizer -> COE. The Scrutinizer reviews
  // questions once the Dean has approved them (and keeps seeing ones the COE finalised).
  const reachedScrutiny = (q: QuestionItem) => q.status === "Approved" && ["DEAN", "COE"].includes((q.verifiedRole || "").toUpperCase());
  const inScope = useMemo(() => questions.filter(reachedScrutiny), [questions]);
  // Still with HOD / Dean: shown only as a count.
  const upcomingCount = useMemo(
    () => questions.filter((q) => !reachedScrutiny(q) && !["Rejected", "Draft", "Archived"].includes(q.status)).length,
    [questions],
  );
  // Syllabi the Dean has forwarded to the Scrutinizer (or already scrutinised).
  const scrutinySyllabi = useMemo(() => syllabi.filter((s) => s.scrutinyStatus || s.coeStatus === "Waiting_Scrutiny"), [syllabi]);
  const subjectKey = (value?: string) => (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const sameSubject = (a?: string, b?: string) => {
    const x = subjectKey(a);
    const y = subjectKey(b);
    return Boolean(x && y) && (x === y || x.includes(y) || y.includes(x));
  };

  const subjects = useMemo(() => {
    const map = new Map<string, { name: string; total: number; pending: number; flagged: number }>();
    inScope.forEach((q) => {
      const name = q.subject || "Unassigned";
      const entry = map.get(name) || { name, total: 0, pending: 0, flagged: 0 };
      entry.total += 1;
      if (!q.scrutinyStatus) entry.pending += 1;
      if (q.scrutinyStatus === "Flagged") entry.flagged += 1;
      map.set(name, entry);
    });
    scrutinySyllabi.forEach((s) => {
      const existing = [...map.values()].find((e) => sameSubject(e.name, s.courseName));
      const entry = existing || { name: s.courseName, total: 0, pending: 0, flagged: 0 };
      if (s.scrutinyStatus !== "Cleared" && s.scrutinyStatus !== "Flagged") entry.pending += 1;
      if (s.scrutinyStatus === "Flagged") entry.flagged += 1;
      if (!existing) map.set(s.courseName, entry);
    });
    return [...map.values()].sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inScope, scrutinySyllabi]);

  useEffect(() => {
    if (subjects.length && !subjects.some((s) => s.name === subject)) setSubject(subjects[0].name);
  }, [subjects, subject]);

  const totals = useMemo(
    () => ({
      total: inScope.length,
      pending: inScope.filter((q) => !q.scrutinyStatus).length,
      cleared: inScope.filter((q) => q.scrutinyStatus === "Cleared").length,
      flagged: inScope.filter((q) => q.scrutinyStatus === "Flagged").length,
    }),
    [inScope],
  );

  const subjectQuestions = useMemo(() => inScope.filter((q) => (q.subject || "Unassigned") === subject), [inScope, subject]);

  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    subjectQuestions.forEach((q) => {
      const key = normalizeText(q.question || "");
      if (key) seen.set(key, (seen.get(key) || 0) + 1);
    });
    return new Set([...seen.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  }, [subjectQuestions]);

  // Bloom's distribution and unit-wise MCQ / Descriptive counts for the selected subject.
  const analysis = useMemo(() => {
    const levels = [0, 0, 0, 0, 0, 0];
    const units = new Map<string, { unit: string; order: number; mcq: number; descriptive: number; marks: number }>();
    let issueCount = 0;
    subjectQuestions.forEach((q) => {
      levels[levelOf(q) - 1] += 1;
      const label = unitLabel(q);
      const entry = units.get(label) || { unit: label, order: unitNumber(q.unit), mcq: 0, descriptive: 0, marks: 0 };
      if (isMcq(q)) entry.mcq += 1;
      else entry.descriptive += 1;
      entry.marks += Number(q.marks) || 0;
      units.set(label, entry);
      if (questionIssues(q, duplicates).length) issueCount += 1;
    });
    const total = subjectQuestions.length || 1;
    const higherOrder = levels[3] + levels[4] + levels[5];
    const warnings: string[] = [];
    if (subjectQuestions.length >= 5 && higherOrder / total < 0.2)
      warnings.push(`Only ${Math.round((higherOrder / total) * 100)}% of questions are higher-order (L4–L6). At least 20% is recommended.`);
    if (subjectQuestions.length >= 5 && levels[0] / total > 0.6)
      warnings.push(`${Math.round((levels[0] / total) * 100)}% of questions are L1 Remember — the paper leans heavily on recall.`);
    const unitList = [...units.values()].sort((a, b) => a.order - b.order);
    unitList.forEach((u) => {
      if (u.mcq === 0) warnings.push(`${u.unit} has no MCQ questions.`);
      if (u.descriptive === 0) warnings.push(`${u.unit} has no Descriptive questions.`);
    });
    if (duplicates.size) warnings.push(`${duplicates.size} question${duplicates.size === 1 ? " is" : "s are"} repeated in this subject.`);
    return { levels, units: unitList, warnings, issueCount };
  }, [subjectQuestions, duplicates]);

  // Visible questions grouped Unit → MCQ / Descriptive, ordered L1 → L6.
  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const visible = subjectQuestions
      .filter((q) =>
        filter === "All" ? true : filter === "Pending" ? !q.scrutinyStatus : q.scrutinyStatus === filter,
      )
      .filter((q) => !term || (q.question || "").toLowerCase().includes(term) || (q.code || "").toLowerCase().includes(term));
    const units = new Map<string, { unit: string; order: number; mcq: QuestionItem[]; descriptive: QuestionItem[] }>();
    visible.forEach((q) => {
      const label = unitLabel(q);
      const entry = units.get(label) || { unit: label, order: unitNumber(q.unit), mcq: [], descriptive: [] };
      (isMcq(q) ? entry.mcq : entry.descriptive).push(q);
      units.set(label, entry);
    });
    const byLevel = (a: QuestionItem, b: QuestionItem) => levelOf(a) - levelOf(b);
    return [...units.values()]
      .sort((a, b) => a.order - b.order)
      .map((u) => ({ ...u, mcq: u.mcq.sort(byLevel), descriptive: u.descriptive.sort(byLevel) }));
  }, [subjectQuestions, filter, search]);

  const saveScrutiny = (q: QuestionItem, status: "Cleared" | "Flagged" | null, remarks = "") => {
    examStore.updateQuestion(q.id, {
      ...q,
      scrutinyStatus: status || undefined,
      scrutinyRemarks: status === "Flagged" ? remarks : undefined,
      scrutinizedBy: status ? currentUser.name : undefined,
      scrutinizedAt: status ? new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : undefined,
    });
    setQuestions(examStore.getQuestions());
  };

  // The syllabus of the selected subject that the Dean forwarded for scrutiny.
  const subjectSyllabus = scrutinySyllabi.find((s) => sameSubject(s.courseName, subject));
  const scrutinyStamp = () => new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const clearSyllabus = (item: SyllabusApprovalItem) => {
    // Cleared here; it reaches the COE when "Verify & Forward to COE" is pressed.
    examStore.updateSyllabusApproval(item.id, { scrutinyStatus: "Cleared", scrutinyName: currentUser.name, scrutinyDate: scrutinyStamp(), scrutinyRemarks: undefined });
    setSyllabi(examStore.getSyllabusApprovals());
    showToast(`Syllabus "${item.courseName}" cleared. Press "Verify & Forward to COE" to send it.`);
  };
  const flagSyllabus = (item: SyllabusApprovalItem, remark: string) => {
    examStore.updateSyllabusApproval(item.id, { scrutinyStatus: "Flagged", scrutinyName: currentUser.name, scrutinyDate: scrutinyStamp(), scrutinyRemarks: remark, coeStatus: "Waiting_Scrutiny" });
    setSyllabi(examStore.getSyllabusApprovals());
    setSyllabusFlag(null);
    showToast(`Syllabus "${item.courseName}" flagged.`);
  };

  const clearAllPending = async () => {
    const pending = subjectQuestions.filter((q) => !q.scrutinyStatus);
    if (!pending.length) return;
    const ok = await confirmDialog(`Mark all ${pending.length} pending questions in ${subject} as cleared?`, {
      title: "Clear all pending questions",
      confirmLabel: "Clear all",
    });
    if (!ok) return;
    pending.forEach((q) => saveScrutiny(q, "Cleared"));
    showToast(`${pending.length} questions cleared for ${subject}.`);
  };

  const card = { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px 22px", boxShadow: "0 4px 16px rgba(0,0,0,0.02)" } as const;
  const selectedSubject = subjects.find((s) => s.name === subject);

  const renderQuestion = (q: QuestionItem, index: number) => {
    const level = levelOf(q);
    const issues = questionIssues(q, duplicates);
    const id = String(q.id);
    const status = q.scrutinyStatus;
    return (
      <div key={id} style={{ padding: "12px 14px", borderTop: "1px solid #edf1f5", display: "flex", gap: "12px", alignItems: "flex-start", background: status === "Flagged" ? "#fff7ed" : status === "Cleared" ? "#f0fdf4" : "#ffffff" }}>
        <div style={{ width: "26px", flexShrink: 0, color: "#64748b", fontWeight: 800, fontSize: "12.5px", paddingTop: "1px" }}>{index + 1}.</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13.5px", color: "#1e293b", whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.55 }}>{q.question}</div>
          {isMcq(q) && (q.options || []).length > 0 && (
            <div style={{ marginTop: "5px", display: "flex", flexWrap: "wrap", gap: "4px 18px", fontSize: "12.5px", color: "#746252" }}>
              {(q.options || []).map((option, i) => (
                <span key={i}>({String.fromCharCode(97 + i)}) {option}</span>
              ))}
            </div>
          )}
          <div style={{ marginTop: "7px", display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", fontSize: "11px", fontWeight: 700 }}>
            <span style={{ padding: "2px 8px", borderRadius: "999px", color: "#ffffff", background: LEVEL_COLORS[level - 1] }}>L{level} · {BLOOM_LEVELS[level - 1]}</span>
            <span style={{ padding: "2px 8px", borderRadius: "999px", background: "#f1f5f9", color: "#475569" }}>{q.marks || 0} marks</span>
            {q.correctAnswer && isMcq(q) && <span style={{ padding: "2px 8px", borderRadius: "999px", background: "#f1f5f9", color: "#475569" }}>Answer: {q.correctAnswer}</span>}
            <span style={{ padding: "2px 8px", borderRadius: "999px", background: "#fdf4ec", color: "#774c28" }}>Approval: {q.status}</span>
            {q.uploadedBy && <span style={{ color: "#94a3b8", fontWeight: 600 }}>by {q.uploadedBy}</span>}
          </div>
          {issues.length > 0 && (
            <div style={{ marginTop: "7px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {issues.map((issue) => (
                <span key={issue} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "6px", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: "11px", fontWeight: 700 }}>
                  <AlertTriangle size={11} /> {issue}
                </span>
              ))}
            </div>
          )}
          {status === "Flagged" && q.scrutinyRemarks && (
            <div style={{ marginTop: "7px", fontSize: "12px", color: "#9a3412" }}>
              <strong>Scrutiny remark:</strong> {q.scrutinyRemarks}
            </div>
          )}
          {status && q.scrutinizedBy && (
            <div style={{ marginTop: "4px", fontSize: "11px", color: "#94a3b8" }}>
              {status} by {q.scrutinizedBy}{q.scrutinizedAt ? ` · ${q.scrutinizedAt}` : ""}
            </div>
          )}
          {flagDraft?.id === id && (
            <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                autoFocus
                value={flagDraft.remark}
                onChange={(e) => setFlagDraft({ id, remark: e.target.value })}
                placeholder="What needs to be corrected?"
                style={{ flex: 1, minWidth: "200px", padding: "7px 10px", borderRadius: "7px", border: "1px solid #fdba74", fontSize: "12.5px" }}
              />
              <button
                type="button"
                onClick={() => {
                  if (!flagDraft.remark.trim()) {
                    showToast("Please enter a remark for the flagged question.", "danger");
                    return;
                  }
                  saveScrutiny(q, "Flagged", flagDraft.remark.trim());
                  setFlagDraft(null);
                  showToast("Question flagged.");
                }}
                style={{ padding: "7px 12px", borderRadius: "7px", border: "none", background: "#ea580c", color: "#ffffff", fontSize: "12px", fontWeight: 800, cursor: "pointer" }}
              >
                Save flag
              </button>
              <button type="button" onClick={() => setFlagDraft(null)} style={{ padding: "7px 12px", borderRadius: "7px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#475569", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          )}
        </div>
        {q.scrutinyForwarded ? (
          <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "999px", border: "1px solid #a5f3fc", background: "#ecfeff", color: "#0e7490", fontSize: "11.5px", fontWeight: 800, whiteSpace: "nowrap" }}>
            <Send size={12} /> Forwarded to COE
          </span>
        ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
          {status !== "Cleared" && (
            <button type="button" onClick={() => saveScrutiny(q, "Cleared")} style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 10px", borderRadius: "7px", border: "1px solid #86efac", background: "#f0fdf4", color: "#15803d", fontSize: "11.5px", fontWeight: 800, cursor: "pointer" }}>
              <CheckCircle2 size={13} /> Clear
            </button>
          )}
          {status !== "Flagged" && (
            <button type="button" onClick={() => setFlagDraft({ id, remark: issues.join("; ") })} style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 10px", borderRadius: "7px", border: "1px solid #fdba74", background: "#fff7ed", color: "#c2410c", fontSize: "11.5px", fontWeight: 800, cursor: "pointer" }}>
              <Flag size={13} /> Flag
            </button>
          )}
          {status && (
            <button type="button" onClick={() => saveScrutiny(q, null)} style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 10px", borderRadius: "7px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#475569", fontSize: "11.5px", fontWeight: 700, cursor: "pointer" }}>
              <RotateCcw size={13} /> Reset
            </button>
          )}
        </div>
        )}
      </div>
    );
  };

  return (
    <RoleGuard route="/scrutinizer">
      <div style={{ display: "flex", height: "100vh", maxHeight: "100vh", background: "#f4f6fb", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#0f172a", width: "100%", overflow: "hidden" }}>
        <ScrutinizerSidebar currentUser={currentUser} active="scrutinizer" />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
          <PortalHeader activeRoute="/scrutinizer" />
          <main className="digital-vfx-main" style={{ flex: 1, padding: "28px 32px", overflowY: "auto", overflowX: "hidden", minWidth: 0, boxSizing: "border-box" }}>
            <div style={{ marginBottom: "22px" }}>
              <h1 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 6px 0", letterSpacing: "-0.4px", display: "flex", alignItems: "center", gap: "10px" }}>
                <ShieldCheck size={24} color="#774c28" /> Scrutinizer Dashboard
              </h1>
              <p style={{ fontSize: "13.5px", color: "#64748b", margin: 0 }}>
                Logged in as <strong>{currentUser.roleTitle}</strong>. Check every question for Bloom&apos;s level balance, unit coverage, MCQ options &amp; answer keys, then clear or flag it.
              </p>
            </div>

            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "22px" }}>
              {[
                { label: "Questions to scrutinize", value: totals.total, color: "#774c28", bg: "#fdf4ec", icon: FileText },
                { label: "Pending scrutiny", value: totals.pending, color: "#b45309", bg: "#fffbeb", icon: Layers },
                { label: "Cleared", value: totals.cleared, color: "#15803d", bg: "#f0fdf4", icon: CheckCircle2 },
                { label: "Flagged", value: totals.flagged, color: "#c2410c", bg: "#fff7ed", icon: Flag },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} style={{ ...card, display: "flex", alignItems: "center", gap: "14px", padding: "16px 18px" }}>
                    <span style={{ width: "42px", height: "42px", borderRadius: "12px", display: "grid", placeItems: "center", background: stat.bg, color: stat.color, flexShrink: 0 }}>
                      <Icon size={20} />
                    </span>
                    <div>
                      <div style={{ fontSize: "24px", fontWeight: 850, color: "#0f172a", lineHeight: 1.1 }}>{stat.value}</div>
                      <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>{stat.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {subjects.length === 0 ? (
              <div style={{ ...card, textAlign: "center", color: "#64748b", fontSize: "13.5px", padding: "40px" }}>
                Nothing has been forwarded by the Dean yet.{upcomingCount > 0 ? ` ${upcomingCount} question${upcomingCount === 1 ? " is" : "s are"} still with the HOD / Dean.` : ""} Submissions appear here after Dean approval; once you clear them they go to the COE.
              </div>
            ) : (
              <>
                {/* Subject picker */}
                <div style={{ ...card, marginBottom: "18px", display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <label style={{ fontSize: "12px", fontWeight: 800, color: "#475569" }}>Subject</label>
                    <select value={subject} onChange={(e) => setSubject(e.target.value)} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: 600, background: "#ffffff", minWidth: "260px", maxWidth: "100%" }}>
                      {subjects.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name} — {s.pending} pending / {s.total}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedSubject && (
                    <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
                      {selectedSubject.total} questions · {selectedSubject.pending} pending · {selectedSubject.flagged} flagged · {analysis.issueCount} with automatic issues
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "18px", marginBottom: "18px" }}>
                  {/* Bloom's distribution */}
                  <div style={card}>
                    <h3 style={{ fontSize: "15px", fontWeight: 800, margin: "0 0 14px 0" }}>Bloom&apos;s Taxonomy distribution</h3>
                    {BLOOM_LEVELS.map((name, i) => {
                      const count = analysis.levels[i];
                      const pct = subjectQuestions.length ? Math.round((count / subjectQuestions.length) * 100) : 0;
                      return (
                        <div key={name} style={{ display: "grid", gridTemplateColumns: "110px 1fr 64px", gap: "10px", alignItems: "center", marginBottom: "8px", fontSize: "12.5px" }}>
                          <span style={{ fontWeight: 700, color: "#334155" }}>L{i + 1} {name}</span>
                          <div style={{ height: "10px", borderRadius: "999px", background: "#f1f5f9", overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: LEVEL_COLORS[i], borderRadius: "999px" }} />
                          </div>
                          <span style={{ textAlign: "right", color: "#475569", fontWeight: 700 }}>{count} · {pct}%</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Unit-wise coverage */}
                  <div style={card}>
                    <h3 style={{ fontSize: "15px", fontWeight: 800, margin: "0 0 14px 0" }}>Unit-wise coverage</h3>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                      <thead>
                        <tr style={{ textAlign: "left", color: "#64748b", background: "#f8fafc" }}>
                          <th style={{ padding: "7px 8px" }}>Unit</th>
                          <th style={{ padding: "7px 8px" }}>MCQ</th>
                          <th style={{ padding: "7px 8px" }}>Descriptive</th>
                          <th style={{ padding: "7px 8px" }}>Marks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.units.map((u) => (
                          <tr key={u.unit} style={{ borderTop: "1px solid #edf1f5" }}>
                            <td style={{ padding: "7px 8px", fontWeight: 700, color: "#334155" }}>{u.unit}</td>
                            <td style={{ padding: "7px 8px", color: u.mcq ? "#334155" : "#dc2626", fontWeight: u.mcq ? 500 : 800 }}>{u.mcq}</td>
                            <td style={{ padding: "7px 8px", color: u.descriptive ? "#334155" : "#dc2626", fontWeight: u.descriptive ? 500 : 800 }}>{u.descriptive}</td>
                            <td style={{ padding: "7px 8px", color: "#475569" }}>{u.marks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Automatic checks */}
                <div style={{ ...card, marginBottom: "18px", borderColor: analysis.warnings.length ? "#fed7aa" : "#bbf7d0", background: analysis.warnings.length ? "#fffbf5" : "#f7fef9" }}>
                  <h3 style={{ fontSize: "15px", fontWeight: 800, margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                    {analysis.warnings.length ? <AlertTriangle size={17} color="#c2410c" /> : <CheckCircle2 size={17} color="#15803d" />}
                    Automatic scrutiny checks
                  </h3>
                  {analysis.warnings.length ? (
                    <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "12.5px", color: "#9a3412", lineHeight: 1.7 }}>
                      {analysis.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ fontSize: "12.5px", color: "#15803d", fontWeight: 600 }}>No subject-level issues found: Bloom&apos;s levels are balanced and every unit has MCQ and Descriptive questions.</div>
                  )}
                </div>

                {/* Syllabus scrutiny (forwarded by the Dean) */}
                {subjectSyllabus && (
                  <div style={{ ...card, marginBottom: "18px", display: "flex", flexDirection: "column", gap: "10px", borderColor: subjectSyllabus.scrutinyStatus === "Cleared" ? "#bbf7d0" : subjectSyllabus.scrutinyStatus === "Flagged" ? "#fed7aa" : "#e2e8f0" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: "#a46937" }}>Syllabus · forwarded by Dean</div>
                        <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a", marginTop: "2px" }}>
                          {subjectSyllabus.courseName}
                          {subjectSyllabus.courseCode ? <span style={{ marginLeft: "8px", fontSize: "12px", color: "#94a3b8", fontWeight: 700 }}>{subjectSyllabus.courseCode}</span> : null}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                          Uploaded by {subjectSyllabus.submittedBy} · Dean approved {subjectSyllabus.deanDate || ""}
                        </div>
                      </div>
                      <span style={{ padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 800, border: "1px solid", ...(subjectSyllabus.scrutinyStatus === "Cleared" ? { background: "#ecfdf5", color: "#047857", borderColor: "#a7f3d0" } : subjectSyllabus.scrutinyStatus === "Flagged" ? { background: "#fff7ed", color: "#c2410c", borderColor: "#fed7aa" } : { background: "#fffbeb", color: "#b45309", borderColor: "#fde68a" }) }}>
                        {subjectSyllabus.scrutinyStatus === "Cleared" ? (subjectSyllabus.coeStatus === "Waiting_Scrutiny" ? "Cleared · ready to forward" : "Forwarded to COE") : subjectSyllabus.scrutinyStatus === "Flagged" ? "Flagged" : "Awaiting scrutiny"}
                      </span>
                    </div>
                    {subjectSyllabus.scrutinyStatus === "Flagged" && subjectSyllabus.scrutinyRemarks && (
                      <div style={{ fontSize: "12.5px", color: "#9a3412" }}><strong>Remark:</strong> {subjectSyllabus.scrutinyRemarks}</div>
                    )}
                    {syllabusFlag?.id === subjectSyllabus.id ? (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <input autoFocus value={syllabusFlag.remark} onChange={(e) => setSyllabusFlag({ id: subjectSyllabus.id, remark: e.target.value })} placeholder="What needs to be corrected in the syllabus?" style={{ flex: 1, minWidth: "220px", padding: "7px 10px", borderRadius: "7px", border: "1px solid #fdba74", fontSize: "12.5px" }} />
                        <button type="button" onClick={() => (syllabusFlag.remark.trim() ? flagSyllabus(subjectSyllabus, syllabusFlag.remark.trim()) : showToast("Please enter a remark.", "danger"))} style={{ padding: "7px 12px", borderRadius: "7px", border: "none", background: "#ea580c", color: "#ffffff", fontSize: "12px", fontWeight: 800, cursor: "pointer" }}>Save flag</button>
                        <button type="button" onClick={() => setSyllabusFlag(null)} style={{ padding: "7px 12px", borderRadius: "7px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#475569", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {subjectSyllabus.scrutinyStatus !== "Cleared" && (
                          <button type="button" onClick={() => clearSyllabus(subjectSyllabus)} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: "8px", border: "1px solid #86efac", background: "#15803d", color: "#ffffff", fontSize: "12px", fontWeight: 800, cursor: "pointer" }}>
                            <CheckCircle2 size={14} /> Clear syllabus
                          </button>
                        )}
                        {subjectSyllabus.scrutinyStatus !== "Flagged" && subjectSyllabus.coeStatus !== "Approved" && (
                          <button type="button" onClick={() => setSyllabusFlag({ id: subjectSyllabus.id, remark: "" })} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: "8px", border: "1px solid #fdba74", background: "#fff7ed", color: "#c2410c", fontSize: "12px", fontWeight: 800, cursor: "pointer" }}>
                            <Flag size={14} /> Flag syllabus
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <PortalFooter />
          </main>
        </div>

        <ToastNotification isOpen={toast.isOpen} message={toast.message} type={toast.type} onClose={() => setToast((prev) => ({ ...prev, isOpen: false }))} />
      </div>
    </RoleGuard>
  );
}

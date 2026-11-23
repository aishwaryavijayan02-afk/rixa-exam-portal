"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Flag, RotateCcw, Search, Send } from "lucide-react";
import { examStore, QuestionItem } from "../lib/examStore";
import { authStore } from "../lib/auth";
import { BLOOM_LEVELS, detectExplicitBloomLevel, inferBloomLevel, unitNumber } from "../lib/bloomTaxonomy";
import { confirmDialog } from "./ConfirmDialog";

type ScrutinyFilter = "Pending" | "Cleared" | "Flagged" | "All";
const LEVEL_COLORS = ["#64748b", "#0e7490", "#15803d", "#b45309", "#9333ea", "#be123c"];

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
const subjectKey = (value?: string) => (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sameSubject = (a?: string, b?: string) => {
  const x = subjectKey(a);
  const y = subjectKey(b);
  return Boolean(x && y) && (x === y || x.includes(y) || y.includes(x));
};

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

/**
 * Scrutinizer's unit-wise question review (Clear / Flag / Reset, filters,
 * Clear all pending) for Dean-approved questions. Limited to `subject` when
 * given; otherwise grouped by subject, then unit.
 */
export default function ScrutinyQuestionReview({ subject, onToast }: { subject?: string; onToast?: (message: string, type?: "success" | "danger") => void }) {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [filter, setFilter] = useState<ScrutinyFilter>("Pending");
  const [search, setSearch] = useState("");
  const [flagDraft, setFlagDraft] = useState<{ id: string; remark: string } | null>(null);
  const toast = (message: string, type: "success" | "danger" = "success") => onToast?.(message, type);

  useEffect(() => {
    const load = () => setQuestions(examStore.getQuestions());
    load();
    window.addEventListener("exam-cell-store-update", load);
    return () => window.removeEventListener("exam-cell-store-update", load);
  }, []);

  // Dean-approved (or COE-finalised) questions are in the Scrutinizer's scope.
  const inScope = useMemo(
    () =>
      questions.filter(
        (q) => q.status === "Approved" && ["DEAN", "COE"].includes((q.verifiedRole || "").toUpperCase()) && (!subject || sameSubject(q.subject, subject)),
      ),
    [questions, subject],
  );
  const upcoming = useMemo(
    () => questions.filter((q) => !inScope.includes(q) && !["Rejected", "Draft", "Archived"].includes(q.status) && (!subject || sameSubject(q.subject, subject))).length,
    [questions, inScope, subject],
  );
  const pendingCount = inScope.filter((q) => !q.scrutinyStatus && !q.scrutinyForwarded).length;

  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    inScope.forEach((q) => {
      const key = `${subjectKey(q.subject)}|${normalizeText(q.question || "")}`;
      seen.set(key, (seen.get(key) || 0) + 1);
    });
    return new Set([...seen.entries()].filter(([, c]) => c > 1).map(([k]) => k.split("|")[1]));
  }, [inScope]);

  // Subject -> unit -> MCQ / Descriptive, ordered L1 -> L6.
  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const visible = inScope
      .filter((q) => (filter === "All" ? true : filter === "Pending" ? !q.scrutinyStatus : q.scrutinyStatus === filter))
      .filter((q) => !term || (q.question || "").toLowerCase().includes(term) || (q.code || "").toLowerCase().includes(term));
    const bySubject = new Map<string, Map<string, { unit: string; order: number; mcq: QuestionItem[]; descriptive: QuestionItem[] }>>();
    visible.forEach((q) => {
      const s = q.subject || "Unassigned";
      const units = bySubject.get(s) || new Map();
      const label = unitLabel(q);
      const entry = units.get(label) || { unit: label, order: unitNumber(q.unit), mcq: [], descriptive: [] };
      (isMcq(q) ? entry.mcq : entry.descriptive).push(q);
      units.set(label, entry);
      bySubject.set(s, units);
    });
    const byLevel = (a: QuestionItem, b: QuestionItem) => levelOf(a) - levelOf(b);
    return [...bySubject.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, units]) => ({
        subject: name,
        units: [...units.values()].sort((a, b) => a.order - b.order).map((u) => ({ ...u, mcq: u.mcq.sort(byLevel), descriptive: u.descriptive.sort(byLevel) })),
      }));
  }, [inScope, filter, search]);

  const saveScrutiny = (q: QuestionItem, status: "Cleared" | "Flagged" | null, remarks = "") => {
    examStore.updateQuestion(q.id, {
      ...q,
      scrutinyStatus: status || undefined,
      scrutinyRemarks: status === "Flagged" ? remarks : undefined,
      scrutinizedBy: status ? authStore.getCurrentUser().name : undefined,
      scrutinizedAt: status ? new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : undefined,
    });
    setQuestions(examStore.getQuestions());
  };

  const clearAllPending = async () => {
    const pending = inScope.filter((q) => !q.scrutinyStatus && !q.scrutinyForwarded);
    if (!pending.length) return;
    const ok = await confirmDialog(`Mark all ${pending.length} pending questions${subject ? ` in ${subject}` : ""} as cleared?`, { title: "Clear all pending questions", confirmLabel: "Clear all" });
    if (!ok) return;
    pending.forEach((q) => saveScrutiny(q, "Cleared"));
    toast(`${pending.length} questions cleared.`);
  };

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
            <select
              value={BLOOM_LEVELS[level - 1]}
              onChange={(e) => {
                examStore.updateQuestion(q.id, { ...q, bloomLevel: e.target.value });
                setQuestions(examStore.getQuestions());
                toast(`Bloom's level set to ${e.target.value}.`);
              }}
              aria-label="Bloom's level"
              title="Choose the Bloom's level"
              style={{ padding: "2px 22px 2px 8px", borderRadius: "999px", border: "none", color: "#ffffff", background: LEVEL_COLORS[level - 1], fontSize: "11px", fontWeight: 700, cursor: "pointer", appearance: "auto" }}
            >
              {BLOOM_LEVELS.map((name, i) => (
                <option key={name} value={name} style={{ color: "#1f140c", background: "#ffffff" }}>
                  L{i + 1} · {name}
                </option>
              ))}
            </select>
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
              {status} by {q.scrutinizedBy}
              {q.scrutinizedAt ? ` · ${q.scrutinizedAt}` : ""}
            </div>
          )}
          {flagDraft?.id === id && (
            <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input autoFocus value={flagDraft.remark} onChange={(e) => setFlagDraft({ id, remark: e.target.value })} placeholder="What needs to be corrected?" style={{ flex: 1, minWidth: "200px", padding: "7px 10px", borderRadius: "7px", border: "1px solid #fdba74", fontSize: "12.5px" }} />
              <button
                type="button"
                onClick={() => {
                  if (!flagDraft.remark.trim()) {
                    toast("Please enter a remark for the flagged question.", "danger");
                    return;
                  }
                  saveScrutiny(q, "Flagged", flagDraft.remark.trim());
                  setFlagDraft(null);
                  toast("Question flagged.");
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

  const showSubjectHeadings = !subject && grouped.length > 1;

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px 22px", boxShadow: "0 4px 16px rgba(0,0,0,0.02)", marginBottom: "4px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <h3 style={{ fontSize: "15px", fontWeight: 800, margin: 0, color: "#0f172a" }}>Question review — unit-wise</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "9px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions" style={{ padding: "7px 10px 7px 28px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12.5px", width: "190px" }} />
          </div>
          {(["Pending", "Cleared", "Flagged", "All"] as ScrutinyFilter[]).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} style={{ padding: "7px 12px", borderRadius: "8px", border: "1px solid #deba9b", background: filter === f ? "#774c28" : "#ffffff", color: filter === f ? "#ffffff" : "#774c28", fontSize: "12px", fontWeight: 800, cursor: "pointer" }}>
              {f}
            </button>
          ))}
          <button type="button" onClick={clearAllPending} disabled={!pendingCount} style={{ padding: "7px 12px", borderRadius: "8px", border: "1px solid #86efac", background: pendingCount ? "#15803d" : "#f1f5f9", color: pendingCount ? "#ffffff" : "#94a3b8", fontSize: "12px", fontWeight: 800, cursor: pendingCount ? "pointer" : "not-allowed" }}>
            Clear all pending
          </button>
        </div>
      </div>

      {inScope.length === 0 ? (
        <div style={{ padding: "28px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
          No questions have reached the Scrutinizer yet{subject ? ` for ${subject}` : ""}.
          {upcoming > 0 ? ` ${upcoming} question${upcoming === 1 ? " is" : "s are"} still with the HOD / Dean.` : ""} Questions appear here after Dean approval.
        </div>
      ) : grouped.length === 0 ? (
        <div style={{ padding: "24px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>No {filter === "All" ? "" : filter.toLowerCase()} questions.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {grouped.map((group) => (
            <div key={group.subject} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {showSubjectHeadings && <div style={{ fontSize: "14px", fontWeight: 800, color: "#774c28" }}>{group.subject}</div>}
              {group.units.map((unit) => (
                <section key={`${group.subject}-${unit.unit}`} style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", background: "linear-gradient(90deg, #ecfeff, #f8fafc)", borderLeft: "4px solid #754b27", color: "#4c311f", fontSize: "14.5px", fontWeight: 800 }}>
                    {unit.unit}
                    <span style={{ marginLeft: "10px", fontSize: "11.5px", fontWeight: 700, color: "#64748b" }}>
                      {unit.mcq.length} MCQ · {unit.descriptive.length} Descriptive
                    </span>
                  </div>
                  {([["Part A — Multiple Choice Questions (MCQ)", unit.mcq], ["Part B — Descriptive Questions", unit.descriptive]] as const).map(([title, items]) =>
                    items.length === 0 ? null : (
                      <div key={title}>
                        <div style={{ padding: "8px 14px", fontSize: "12px", fontWeight: 800, color: "#774c28", background: "#fffdfa", letterSpacing: "0.02em" }}>{title}</div>
                        {items.map((q, i) => renderQuestion(q, i))}
                      </div>
                    ),
                  )}
                </section>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Edit3, MessageSquareWarning, Plus, RotateCcw, Send, Trash2, X } from "lucide-react";
import { examStore, QuestionItem } from "../lib/examStore";
import { AuthUser } from "../lib/auth";
import { confirmDialog } from "./ConfirmDialog";
import ManualQuestionForm from "./ManualQuestionForm";

const isMcq = (q: QuestionItem) => q.type === "MCQ" || (q.options || []).filter(Boolean).length >= 2;
const roleName = (role: string) => ({ HOD: "HOD", DEAN: "Dean", COE: "COE", SCRUTINIZER: "Scrutinizer", STAFF: "Faculty" } as Record<string, string>)[role.toUpperCase()] || role;

/** Where a question currently sits in Staff -> HOD -> Dean -> Scrutinizer -> COE. */
function stageOf(q: QuestionItem): { label: string; bg: string; color: string } {
  const role = (q.verifiedRole || "").toUpperCase();
  if (q.correctionRequested) return { label: `Returned by ${roleName(q.correctionRole || "")}`, bg: "#fef2f2", color: "#b91c1c" };
  if (q.status === "Pending") return { label: "Awaiting HOD", bg: "#fffbeb", color: "#b45309" };
  if (q.status === "Verified") return { label: "Awaiting Dean", bg: "#eff6ff", color: "#1d4ed8" };
  if (q.status === "Approved" && role === "COE") return { label: "COE final approved", bg: "#ecfdf5", color: "#047857" };
  if (q.status === "Approved" && role === "DEAN") return { label: q.scrutinyForwarded ? "Awaiting COE" : "With Scrutinizer", bg: "#ecfeff", color: "#0e7490" };
  return { label: q.status, bg: "#f1f5f9", color: "#475569" };
}

/** Status a reviewer's own new question starts with, so it lands in their own queue. */
function newQuestionStage(role: string): Partial<QuestionItem> {
  if (role === "DEAN") return { status: "Verified", verifiedRole: "HOD" };
  if (role === "COE") return { status: "Approved", verifiedRole: "DEAN", scrutinyForwarded: true };
  return { status: "Pending" };
}

const btn = (border: string, bg: string, color: string): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 10px", borderRadius: "7px",
  border: `1px solid ${border}`, background: bg, color, fontSize: "11.5px", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap",
});

/**
 * Question CRUD with a correction loop.
 *  - reviewer (HOD / Dean / COE): add, edit, delete, or "Mark wrong" with a
 *    note, which sends the question back to the faculty who uploaded it.
 *  - faculty: questions returned to the signed-in user, with the reviewer's
 *    note; edit & resubmit (restarts at HOD) or delete.
 */
export default function QuestionCorrectionPanel({
  mode,
  currentUser,
  questions: givenQuestions,
  subject,
  onToast,
}: {
  mode: "reviewer" | "faculty";
  currentUser: AuthUser;
  /** Reviewer mode: the questions to manage (e.g. one faculty's submission). */
  questions?: QuestionItem[];
  subject?: string;
  onToast?: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const [all, setAll] = useState<QuestionItem[]>([]);
  const [editing, setEditing] = useState<QuestionItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [returnDraft, setReturnDraft] = useState<{ id: string; note: string } | null>(null);
  const [filter, setFilter] = useState<"all" | "returned" | "active">("all");
  const toast = (m: string, t: "success" | "error" | "info" = "success") => onToast?.(m, t);

  useEffect(() => {
    const load = () => setAll(examStore.getQuestions());
    load();
    window.addEventListener("exam-cell-store-update", load);
    return () => window.removeEventListener("exam-cell-store-update", load);
  }, []);

  // Reviewer: always show the latest saved version of the given questions.
  const list = useMemo(() => {
    if (mode === "faculty") {
      return all.filter((q) => q.correctionRequested && examStore.isQuestionUploadedBy(q, currentUser));
    }
    const ids = new Set((givenQuestions || []).map((q) => String(q.id)));
    const fromGiven = all.filter((q) => ids.has(String(q.id)));
    // Questions added from this panel for the same subject show up too.
    const added = subject ? all.filter((q) => !ids.has(String(q.id)) && q.subject === subject && examStore.isQuestionUploadedBy(q, currentUser)) : [];
    return [...fromGiven, ...added];
  }, [all, mode, givenQuestions, subject, currentUser]);

  const visible = list.filter((q) => (filter === "returned" ? q.correctionRequested : filter === "active" ? !q.correctionRequested : true));
  const returnedCount = list.filter((q) => q.correctionRequested).length;
  const subjectOptions = useMemo(() => Array.from(new Set([subject, ...all.map((q) => q.subject)].filter(Boolean) as string[])).sort(), [all, subject]);

  const handleDelete = async (q: QuestionItem) => {
    const ok = await confirmDialog(`Delete this question permanently?\n\n"${(q.question || "").slice(0, 140)}"`, { title: "Delete question", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    examStore.deleteQuestion(q.id);
    toast("Question deleted.", "info");
  };

  const handleReturn = (q: QuestionItem) => {
    if (!returnDraft || !returnDraft.note.trim()) {
      toast("Please write what is wrong so the faculty can correct it.", "error");
      return;
    }
    examStore.returnQuestionForCorrection(q.id, returnDraft.note, { name: currentUser.name, role: currentUser.role });
    setReturnDraft(null);
    toast(`Returned to ${q.uploadedBy || "the faculty"} for correction.`);
  };

  const renderQuestion = (q: QuestionItem, index: number) => {
    const id = String(q.id);
    const stage = stageOf(q);
    const finalLocked = (q.verifiedRole || "").toUpperCase() === "COE" && q.status === "Approved" && currentUser.role !== "COE";
    return (
      <div key={id} style={{ padding: "12px 14px", borderTop: "1px solid #edf1f5", display: "flex", gap: "12px", alignItems: "flex-start", background: q.correctionRequested ? "#fffafa" : "#ffffff" }}>
        <div style={{ width: "26px", flexShrink: 0, color: "#64748b", fontWeight: 800, fontSize: "12.5px", paddingTop: "1px" }}>{index + 1}.</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13.5px", color: "#1e293b", whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.55 }}>{q.question}</div>
          {isMcq(q) && (q.options || []).length > 0 && (
            <div style={{ marginTop: "5px", display: "flex", flexWrap: "wrap", gap: "4px 18px", fontSize: "12.5px", color: "#746252" }}>
              {(q.options || []).map((option, i) => <span key={i}>({String.fromCharCode(97 + i)}) {option}</span>)}
            </div>
          )}
          <div style={{ marginTop: "7px", display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", fontSize: "11px", fontWeight: 700 }}>
            <span style={{ padding: "2px 8px", borderRadius: "999px", background: stage.bg, color: stage.color }}>{stage.label}</span>
            <span style={{ padding: "2px 8px", borderRadius: "999px", background: "#f1f5f9", color: "#475569" }}>{q.subject}</span>
            <span style={{ padding: "2px 8px", borderRadius: "999px", background: "#f1f5f9", color: "#475569" }}>{q.unit || "Unit"} · {q.marks || 0} marks</span>
            {q.correctAnswer && isMcq(q) && <span style={{ padding: "2px 8px", borderRadius: "999px", background: "#f1f5f9", color: "#475569" }}>Answer: {q.correctAnswer}</span>}
            {mode === "reviewer" && q.uploadedBy && <span style={{ color: "#94a3b8", fontWeight: 600 }}>by {q.uploadedBy}</span>}
          </div>

          {q.correctionRequested && q.correctionNote && (
            <div style={{ marginTop: "8px", padding: "8px 10px", borderRadius: "8px", background: "#fef2f2", border: "1px solid #fecaca", fontSize: "12.5px", color: "#7f1d1d", display: "flex", gap: "8px" }}>
              <MessageSquareWarning size={15} style={{ flexShrink: 0, marginTop: "2px", color: "#dc2626" }} />
              <div>
                <strong>
                  {q.correctionBy}
                  {roleName(q.correctionRole || "").toLowerCase() !== (q.correctionBy || "").toLowerCase() ? ` (${roleName(q.correctionRole || "")})` : ""}:
                </strong>{" "}
                {q.correctionNote}
                {q.correctionAt && <div style={{ marginTop: "2px", fontSize: "11px", color: "#b91c1c", opacity: 0.8 }}>{q.correctionAt}</div>}
              </div>
            </div>
          )}

          {returnDraft?.id === id && (
            <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "7px" }}>
              <textarea
                autoFocus
                rows={2}
                value={returnDraft.note}
                onChange={(e) => setReturnDraft({ id, note: e.target.value })}
                placeholder="What is wrong? e.g. Option C and D are the same; answer key should be B."
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #fca5a5", fontSize: "12.5px", resize: "vertical", fontFamily: "inherit" }}
              />
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" onClick={() => handleReturn(q)} style={btn("#dc2626", "#dc2626", "#ffffff")}>
                  <Send size={13} /> Send back to {q.uploadedBy || "faculty"}
                </button>
                <button type="button" onClick={() => setReturnDraft(null)} style={btn("#cbd5e1", "#ffffff", "#475569")}>
                  <X size={13} /> Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0, alignItems: "stretch" }}>
          {mode === "faculty" ? (
            <>
              <button type="button" onClick={() => setEditing(q)} style={btn("#deba9b", "#fdf4ec", "#774c28")}>
                <Edit3 size={13} /> Edit &amp; resubmit
              </button>
              <button type="button" onClick={() => handleDelete(q)} style={btn("#fecaca", "#fff1f2", "#be123c")}>
                <Trash2 size={13} /> Delete
              </button>
            </>
          ) : (
            <>
              {!q.correctionRequested && !finalLocked && returnDraft?.id !== id && (
                <button type="button" onClick={() => setReturnDraft({ id, note: "" })} style={btn("#fca5a5", "#fef2f2", "#b91c1c")} title="Mark as wrong and send back to the faculty">
                  <AlertTriangle size={13} /> Mark wrong
                </button>
              )}
              {!finalLocked && (
                <button type="button" onClick={() => setEditing(q)} style={btn("#deba9b", "#ffffff", "#774c28")}>
                  <Edit3 size={13} /> Edit
                </button>
              )}
              {!finalLocked && (
                <button type="button" onClick={() => handleDelete(q)} style={btn("#fecaca", "#fff1f2", "#be123c")}>
                  <Trash2 size={13} /> Delete
                </button>
              )}
              {finalLocked && (
                <span style={{ ...btn("#a7f3d0", "#ecfdf5", "#047857"), cursor: "default" }}>
                  <CheckCircle2 size={13} /> Locked
                </span>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  if (mode === "faculty" && list.length === 0) return null;

  return (
    <div style={{ background: "#ffffff", border: mode === "faculty" ? "1px solid #fecaca" : "1px solid #e2e8f0", borderRadius: "16px", padding: "18px 20px", boxShadow: "0 4px 16px rgba(0,0,0,0.03)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div>
          <h3 style={{ fontSize: "15px", fontWeight: 800, margin: 0, color: mode === "faculty" ? "#991b1b" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
            {mode === "faculty" ? <><MessageSquareWarning size={17} /> Returned for correction ({list.length})</> : <>Manage questions{subject ? ` — ${subject}` : ""}</>}
          </h3>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "3px" }}>
            {mode === "faculty"
              ? "A reviewer marked these questions as wrong. Read the note, then edit and resubmit (it goes back to HOD verification) or delete the question."
              : "Edit or delete any question, or use Mark wrong to send it back to the faculty with a note. Returned questions leave the approval queue until the faculty resubmits them."}
          </div>
        </div>
        {mode === "reviewer" && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {(["all", "active", "returned"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} style={{ padding: "6px 11px", borderRadius: "8px", border: "1px solid #deba9b", background: filter === f ? "#774c28" : "#ffffff", color: filter === f ? "#ffffff" : "#774c28", fontSize: "12px", fontWeight: 800, cursor: "pointer" }}>
                {f === "all" ? `All (${list.length})` : f === "active" ? `In review (${list.length - returnedCount})` : `Returned (${returnedCount})`}
              </button>
            ))}
            <button type="button" onClick={() => setAdding(true)} style={btn("#15803d", "#15803d", "#ffffff")}>
              <Plus size={13} /> Add question
            </button>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <div style={{ padding: "24px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
          {filter === "returned" ? "No questions have been returned for correction." : "No questions to show."}
        </div>
      ) : (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>{visible.map((q, i) => renderQuestion(q, i))}</div>
      )}

      <ManualQuestionForm
        isOpen={Boolean(editing)}
        initial={editing}
        subjects={subjectOptions}
        onClose={() => setEditing(null)}
        onSave={(data) => {
          if (!editing) return;
          if (mode === "faculty") {
            examStore.resubmitCorrectedQuestion(editing.id, data, currentUser.name);
            toast("Corrected question resubmitted. It is back with the HOD for verification.");
          } else {
            // Same record and stage: the reviewer's fix travels on to the next step.
            examStore.updateQuestion(editing.id, { ...editing, ...data });
            toast("Question updated.");
          }
          setEditing(null);
        }}
      />
      <ManualQuestionForm
        isOpen={adding}
        initial={null}
        subjects={subjectOptions}
        onClose={() => setAdding(false)}
        onSave={(data, { addAnother }) => {
          examStore.saveQuestion({
            ...data,
            id: `q-rev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            subject: data.subject || subject || "General",
            uploadedBy: currentUser.name,
            email: currentUser.email,
            ...newQuestionStage(currentUser.role),
          });
          toast("Question added.");
          if (!addAnother) setAdding(false);
        }}
      />
      {mode === "reviewer" && returnedCount > 0 && filter !== "returned" && (
        <div style={{ marginTop: "10px", fontSize: "12px", color: "#b91c1c", display: "flex", alignItems: "center", gap: "6px" }}>
          <RotateCcw size={13} /> {returnedCount} question{returnedCount === 1 ? " is" : "s are"} with the faculty for correction.
        </div>
      )}
    </div>
  );
}

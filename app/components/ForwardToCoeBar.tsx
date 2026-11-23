"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { examStore, QuestionItem, SyllabusApprovalItem } from "../lib/examStore";
import { confirmDialog } from "./ConfirmDialog";

const subjectKey = (value?: string) => (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sameSubject = (a?: string, b?: string) => {
  const x = subjectKey(a);
  const y = subjectKey(b);
  return Boolean(x && y) && (x === y || x.includes(y) || y.includes(x));
};
const stamp = () => new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * Scrutinizer's final step: "Verify & Forward to COE". Forwards the
 * Dean-approved questions (and syllabi) that are not flagged; questions not
 * yet reviewed are marked cleared. Limited to `subject` when one is given.
 */
export default function ForwardToCoeBar({ subject, onDone }: { subject?: string; onDone?: (message: string, ok: boolean) => void }) {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [syllabi, setSyllabi] = useState<SyllabusApprovalItem[]>([]);

  useEffect(() => {
    const load = () => {
      setQuestions(examStore.getQuestions());
      setSyllabi(examStore.getSyllabusApprovals());
    };
    load();
    window.addEventListener("exam-cell-store-update", load);
    return () => window.removeEventListener("exam-cell-store-update", load);
  }, []);

  const inSubject = (name?: string) => !subject || sameSubject(name, subject);
  const reachedScrutiny = (q: QuestionItem) => q.status === "Approved" && (q.verifiedRole || "").toUpperCase() === "DEAN";

  const summary = useMemo(() => {
    const atScrutiny = questions.filter((q) => reachedScrutiny(q) && inSubject(q.subject));
    const open = atScrutiny.filter((q) => !q.scrutinyForwarded);
    const waitingSyllabi = syllabi.filter((s) => s.coeStatus === "Waiting_Scrutiny" && inSubject(s.courseName));
    return {
      toForward: open.filter((q) => q.scrutinyStatus !== "Flagged"),
      pending: open.filter((q) => !q.scrutinyStatus).length,
      flagged: open.filter((q) => q.scrutinyStatus === "Flagged").length,
      forwarded: atScrutiny.filter((q) => q.scrutinyForwarded).length,
      syllabiToForward: waitingSyllabi.filter((s) => s.scrutinyStatus !== "Flagged"),
      upcoming: questions.filter((q) => !reachedScrutiny(q) && (q.verifiedRole || "").toUpperCase() !== "COE" && !["Rejected", "Draft", "Archived"].includes(q.status) && inSubject(q.subject)).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, syllabi, subject]);

  const nothingYet = summary.toForward.length === 0 && summary.syllabiToForward.length === 0 && summary.forwarded === 0 && summary.flagged === 0;
  const canForward = summary.toForward.length > 0 || summary.syllabiToForward.length > 0;

  const forward = async () => {
    const qCount = summary.toForward.length;
    const sCount = summary.syllabiToForward.length;
    if (!qCount && !sCount) return;
    const parts = [qCount ? `${qCount} question${qCount === 1 ? "" : "s"}` : "", sCount ? `${sCount} syllab${sCount === 1 ? "us" : "i"}` : ""].filter(Boolean).join(" and ");
    const ok = await confirmDialog(
      `Verify and forward ${parts}${subject ? ` for ${subject}` : ""} to the COE for final approval?${summary.pending ? ` ${summary.pending} unreviewed question${summary.pending === 1 ? " will be" : "s will be"} marked as cleared.` : ""}${summary.flagged ? ` ${summary.flagged} flagged question${summary.flagged === 1 ? " stays" : "s stay"} with the Scrutinizer.` : ""}`,
      { title: "Verify & forward to COE", confirmLabel: "Verify & Forward" },
    );
    if (!ok) return;
    const now = stamp();
    const user = (() => {
      try {
        return JSON.parse(localStorage.getItem("exam_cell_auth_user") || "{}").name || "Scrutinizer";
      } catch {
        return "Scrutinizer";
      }
    })();
    summary.toForward.forEach((q) =>
      examStore.updateQuestion(q.id, { ...q, scrutinyStatus: "Cleared", scrutinyForwarded: true, scrutinizedBy: q.scrutinizedBy || user, scrutinizedAt: q.scrutinizedAt || now }),
    );
    summary.syllabiToForward.forEach((s) =>
      examStore.updateSyllabusApproval(s.id, { scrutinyStatus: "Cleared", scrutinyName: s.scrutinyName || user, scrutinyDate: s.scrutinyDate || now, coeStatus: "Pending" }),
    );
    setQuestions(examStore.getQuestions());
    setSyllabi(examStore.getSyllabusApprovals());
    onDone?.(`${parts.charAt(0).toUpperCase()}${parts.slice(1)} forwarded to the COE.`, true);
  };

  // Just the action: a single "Verify & Forward to COE" button.
  return (
    <div className="scr-forward-row">
      <button
        type="button"
        className="scr-forward-btn"
        onClick={forward}
        disabled={!canForward}
        title={canForward ? undefined : nothingYet ? "Waiting for Dean approval" : "Nothing left to forward"}
      >
        <Send size={16} /> Verify &amp; Forward to COE
      </button>
    </div>
  );
}

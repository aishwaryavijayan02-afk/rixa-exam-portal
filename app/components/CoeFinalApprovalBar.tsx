"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { examStore, QuestionItem, SyllabusApprovalItem } from "../lib/examStore";
import { authStore, roleDisplayName } from "../lib/auth";
import { alertDialog, confirmDialog } from "./ConfirmDialog";
import { VerificationResultModal, type VerificationDetails } from "./CrudModal";

const subjectKey = (value?: string) => (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sameSubject = (a?: string, b?: string) => {
  const x = subjectKey(a);
  const y = subjectKey(b);
  return Boolean(x && y) && (x === y || x.includes(y) || y.includes(x));
};

/**
 * COE's last step: "Final Approval" for everything the Scrutinizer forwarded
 * (questions + syllabi). Locks them for question paper printing.
 */
export default function CoeFinalApprovalBar({ subject }: { subject?: string }) {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [syllabi, setSyllabi] = useState<SyllabusApprovalItem[]>([]);
  const [result, setResult] = useState<{ count: number; details: VerificationDetails; questions: { bloomLevel?: string }[]; remarks: string } | null>(null);

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
  const ready = useMemo(() => {
    const qs = questions.filter(
      (q) => q.status === "Approved" && (q.verifiedRole || "").toUpperCase() === "DEAN" && q.scrutinyStatus === "Cleared" && q.scrutinyForwarded && inSubject(q.subject),
    );
    const ss = syllabi.filter((s) => s.coeStatus === "Pending" && s.scrutinyStatus === "Cleared" && inSubject(s.courseName));
    const waiting = questions.filter(
      (q) => (q.verifiedRole || "").toUpperCase() !== "COE" && !q.scrutinyForwarded && !["Rejected", "Draft", "Archived"].includes(q.status) && inSubject(q.subject),
    ).length;
    // Already finalised by the COE.
    const doneQuestions = questions.filter((q) => (q.verifiedRole || "").toUpperCase() === "COE" && inSubject(q.subject)).length;
    const doneSyllabi = syllabi.filter((s) => s.coeStatus === "Approved" && inSubject(s.courseName)).length;
    return { qs, ss, waiting, doneQuestions, doneSyllabi };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, syllabi, subject]);

  const approve = async () => {
    const qCount = ready.qs.length;
    const sCount = ready.ss.length;
    if (!qCount && !sCount && (ready.doneQuestions || ready.doneSyllabi) && !ready.waiting) {
      // Everything already has final approval: say so instead of "waiting".
      await alertDialog(
        [
          `Final approval has already been given${subject ? ` for ${subject}` : ""}.`,
          ready.doneQuestions ? `${ready.doneQuestions} question${ready.doneQuestions === 1 ? " is" : "s are"} final approved and locked.` : "",
          ready.doneSyllabi ? `${ready.doneSyllabi} syllab${ready.doneSyllabi === 1 ? "us is" : "i are"} approved.` : "",
          "They are ready in Print Question Paper.",
        ]
          .filter(Boolean)
          .join("\n"),
        { title: "Already final approved", confirmLabel: "OK" },
      );
      return;
    }
    if (!qCount && !sCount) {
      await alertDialog(
        [
          "Nothing is waiting for final approval.",
          ready.waiting ? `${ready.waiting} question${ready.waiting === 1 ? " is" : "s are"} still with the HOD / Dean / Scrutinizer.` : "",
          "The Scrutinizer sends questions here with Approve & Forward to COE.",
        ]
          .filter(Boolean)
          .join("\n"),
        { title: "Waiting for the Scrutinizer", confirmLabel: "OK" },
      );
      return;
    }
    const parts = [qCount ? `${qCount} question${qCount === 1 ? "" : "s"}` : "", sCount ? `${sCount} syllab${sCount === 1 ? "us" : "i"}` : ""].filter(Boolean).join(" and ");
    const ok = await confirmDialog(`Give final approval to ${parts}${subject ? ` for ${subject}` : ""}? They will be locked for question paper printing.`, {
      title: "Final approval",
      confirmLabel: "Give final approval",
    });
    if (!ok) return;
    const user = authStore.getCurrentUser();
    const now = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const approvedQuestions = ready.qs;
    examStore.coeFinalizeQuestions(approvedQuestions.map((q) => q.id), user.name);
    ready.ss.forEach((s) => examStore.updateSyllabusApproval(s.id, { coeStatus: "Approved", coeName: user.name, coeDate: now, status: "Approved" }));
    setQuestions(examStore.getQuestions());
    setSyllabi(examStore.getSyllabusApprovals());
    const subjects = Array.from(new Set([...approvedQuestions.map((q) => q.subject), ...ready.ss.map((s) => s.courseName)].filter(Boolean)));
    const faculty = Array.from(new Set([...ready.ss.map((s) => s.submittedBy), ...approvedQuestions.map((q) => q.uploadedBy)].filter(Boolean)));
    const label = roleDisplayName(user.role);
    setResult({
      count: qCount,
      questions: approvedQuestions,
      details: {
        stage: "COE",
        subject: subject || subjects.join(", ") || undefined,
        facultyName: faculty.join(", ") || undefined,
        syllabusName: ready.ss.map((s) => s.documentName || s.courseName).join(", ") || undefined,
        verifierName: user.name && user.name !== label ? `${label} ${user.name}` : label,
        forwardedTo: "Question Bank (ready for printing)",
      },
      remarks: `${parts.charAt(0).toUpperCase()}${parts.slice(1)} received final approval from the COE and are locked for question paper printing.`,
    });
  };

  const canApprove = ready.qs.length > 0 || ready.ss.length > 0;
  return (
    <div className="scr-forward-row">
      <button
        type="button"
        className="approval-model-approve-button approval-model-forward-button"
        onClick={approve}
        aria-disabled={!canApprove}
        title={canApprove ? undefined : "Waiting for the Scrutinizer"}
      >
        <Sparkles size={16} />
        <Check size={16} strokeWidth={3} />
        Final Approval
      </button>
      <VerificationResultModal
        isOpen={Boolean(result)}
        onClose={() => setResult(null)}
        title="Final Approval Complete!"
        verifiedCount={result?.count ?? 0}
        details={result?.details}
        questions={result?.questions}
        remarks={result?.remarks}
      />
    </div>
  );
}

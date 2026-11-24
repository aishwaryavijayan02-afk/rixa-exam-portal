"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Award, CheckCircle2, Clock, Download, FileText, RotateCcw } from "lucide-react";
import { examStore, QuestionItem } from "../lib/examStore";
import { BLOOM_LEVELS, detectExplicitBloomLevel, inferBloomLevel, unitNumber } from "../lib/bloomTaxonomy";
import { StatTile } from "./BloomPatternView";
import { ToastNotification } from "./CrudModal";

type Stage = "hod" | "dean" | "scrutiny" | "coe" | "final" | "rejected" | "draft";

const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: "hod", label: "With HOD", color: "#d97706" },
  { key: "dean", label: "With Dean", color: "#b45309" },
  { key: "scrutiny", label: "With Scrutinizer", color: "#0e7490" },
  { key: "coe", label: "With COE", color: "#7e22ce" },
  { key: "final", label: "Final approved", color: "#15803d" },
  { key: "rejected", label: "Rejected", color: "#dc2626" },
  { key: "draft", label: "Draft", color: "#94a3b8" },
];
const LEVEL_COLORS = ["#64748b", "#0e7490", "#15803d", "#b45309", "#7e22ce", "#be123c"];

const roleOf = (q: QuestionItem) => (q.verifiedRole || "").toUpperCase();

/** Where a question currently is in Staff -> HOD -> Dean -> Scrutinizer -> COE. */
function stageOf(q: QuestionItem): Stage {
  if (q.status === "Rejected") return "rejected";
  if (q.status === "Draft") return "draft";
  if (q.status === "Approved" && roleOf(q) === "COE") return "final";
  if (q.status === "Approved" && roleOf(q) === "DEAN") return q.scrutinyForwarded ? "coe" : "scrutiny";
  if (q.status === "Verified" || roleOf(q) === "HOD") return "dean";
  return "hod";
}

function levelOf(q: QuestionItem): number {
  const saved = BLOOM_LEVELS.findIndex((name) => name.toLowerCase() === (q.bloomLevel || "").toLowerCase());
  if (saved >= 0) return saved + 1;
  return detectExplicitBloomLevel(q.bloomLevel || "") ?? detectExplicitBloomLevel(q.question) ?? inferBloomLevel(q.question) ?? (q.type === "MCQ" ? 1 : 2);
}
const isMcq = (q: QuestionItem) => q.type === "MCQ";
const unitLabel = (q: QuestionItem) => {
  const n = unitNumber(q.unit);
  return n === 99 ? q.unit || "General" : `Unit ${n}`;
};
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/** Reports: real analytics built from the question bank, with working filters. */
export default function ReportsAnalytics() {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [subject, setSubject] = useState("all");
  const [unit, setUnit] = useState("all");
  const [type, setType] = useState("all");
  const [stage, setStage] = useState("all");
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });

  useEffect(() => {
    const load = () => setQuestions(examStore.getQuestions().filter((q) => q.status !== "Archived"));
    load();
    window.addEventListener("exam-cell-store-update", load);
    return () => window.removeEventListener("exam-cell-store-update", load);
  }, []);

  const subjects = useMemo(() => Array.from(new Set(questions.map((q) => q.subject).filter(Boolean))).sort(), [questions]);
  const units = useMemo(
    () => Array.from(new Set(questions.map(unitLabel))).sort((a, b) => unitNumber(a) - unitNumber(b) || a.localeCompare(b)),
    [questions],
  );

  const rows = useMemo(
    () =>
      questions.filter(
        (q) =>
          (subject === "all" || q.subject === subject) &&
          (unit === "all" || unitLabel(q) === unit) &&
          (type === "all" || (type === "MCQ" ? isMcq(q) : !isMcq(q))) &&
          (stage === "all" || stageOf(q) === stage),
      ),
    [questions, subject, unit, type, stage],
  );

  const totalMarks = rows.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  const finalCount = rows.filter((q) => stageOf(q) === "final").length;
  const inApproval = rows.filter((q) => !["final", "rejected", "draft"].includes(stageOf(q))).length;

  const stageCounts = STAGES.map((s) => ({ ...s, count: rows.filter((q) => stageOf(q) === s.key).length }));
  const maxStage = Math.max(1, ...stageCounts.map((s) => s.count));
  const levelCounts = BLOOM_LEVELS.map((_, i) => rows.filter((q) => levelOf(q) === i + 1).length);
  const maxLevel = Math.max(1, ...levelCounts);

  const unitRows = useMemo(() => {
    const map = new Map<string, { unit: string; order: number; mcq: number; descriptive: number; marks: number }>();
    rows.forEach((q) => {
      const label = unitLabel(q);
      const entry = map.get(label) || { unit: label, order: unitNumber(q.unit), mcq: 0, descriptive: 0, marks: 0 };
      if (isMcq(q)) entry.mcq += 1;
      else entry.descriptive += 1;
      entry.marks += Number(q.marks) || 0;
      map.set(label, entry);
    });
    return [...map.values()].sort((a, b) => a.order - b.order);
  }, [rows]);

  const subjectRows = useMemo(() => {
    const map = new Map<string, { subject: string; total: number; mcq: number; descriptive: number; marks: number; final: number }>();
    rows.forEach((q) => {
      const name = q.subject || "Unassigned";
      const entry = map.get(name) || { subject: name, total: 0, mcq: 0, descriptive: 0, marks: 0, final: 0 };
      entry.total += 1;
      if (isMcq(q)) entry.mcq += 1;
      else entry.descriptive += 1;
      entry.marks += Number(q.marks) || 0;
      if (stageOf(q) === "final") entry.final += 1;
      map.set(name, entry);
    });
    return [...map.values()].sort((a, b) => a.subject.localeCompare(b.subject));
  }, [rows]);

  const filtered = subject !== "all" || unit !== "all" || type !== "all" || stage !== "all";
  const reset = () => {
    setSubject("all");
    setUnit("all");
    setType("all");
    setStage("all");
  };
  const notify = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  };

  const exportSummary = () => {
    examStore.exportToCsv(
      "subject_wise_report.csv",
      subjectRows.map((s) => ({ Subject: s.subject, Questions: s.total, MCQ: s.mcq, Descriptive: s.descriptive, TotalMarks: s.marks, FinalApproved: s.final, FinalApprovedPercent: `${pct(s.final, s.total)}%` })),
    );
    notify("Subject-wise summary downloaded as CSV.");
  };
  const exportQuestions = () => {
    examStore.exportToCsv(
      "questions_report.csv",
      rows.map((q) => ({
        Code: q.code || q.id,
        Subject: q.subject,
        Unit: unitLabel(q),
        Type: q.type,
        BloomLevel: BLOOM_LEVELS[levelOf(q) - 1],
        Marks: q.marks,
        Stage: STAGES.find((s) => s.key === stageOf(q))?.label,
        UploadedBy: q.uploadedBy,
        Question: q.question,
      })),
    );
    notify("Questions report downloaded as CSV.");
  };

  return (
    <div className="rp">
      {/* Header */}
      <div className="mq-header">
        <div>
          <div className="mq-kicker">Analytics</div>
          <h1 className="mq-title">Reports</h1>
          <p className="mq-sub">Question bank analytics from the live data: approval progress, Bloom&apos;s levels, unit coverage and subject-wise status.</p>
        </div>
        <div className="rp-actions">
          <button type="button" className="mqf-btn is-outline" onClick={exportSummary} disabled={!rows.length}>
            <Download size={14} /> Export summary
          </button>
          <button type="button" className="mqf-btn is-outline" onClick={exportQuestions} disabled={!rows.length}>
            <Download size={14} /> Export questions
          </button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="mq-stats bpv-stats">
        <StatTile label="Total questions" value={rows.length} icon={FileText} accent="#774c28" index={0} />
        <StatTile label="Final approved" value={finalCount} icon={CheckCircle2} accent="#15803d" index={1} />
        <StatTile label="In approval" value={inApproval} icon={Clock} accent="#b45309" index={2} />
        <StatTile label="Overall marks" value={totalMarks} icon={Award} accent="#7e22ce" index={3} />
      </div>

      {/* Filters */}
      <div className="rp-card rp-filters">
        {[
          { label: "Subject", value: subject, set: setSubject, options: subjects.map((s) => [s, s] as const), all: "All subjects" },
          { label: "Unit", value: unit, set: setUnit, options: units.map((u) => [u, u] as const), all: "All units" },
          { label: "Type", value: type, set: setType, options: [["MCQ", "MCQ"], ["Descriptive", "Descriptive"]] as const, all: "All types" },
          { label: "Stage", value: stage, set: setStage, options: STAGES.map((s) => [s.key, s.label] as const), all: "All stages" },
        ].map((f) => (
          <label key={f.label} className="rp-field">
            <span>{f.label}</span>
            <select value={f.value} onChange={(e) => f.set(e.target.value)}>
              <option value="all">{f.all}</option>
              {f.options.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        ))}
        <button type="button" className="mqf-btn is-outline rp-reset" onClick={reset} disabled={!filtered}>
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      {questions.length === 0 ? (
        <div className="rp-card rp-empty">No questions have been uploaded yet. Reports appear here once staff upload a question bank in the Academic Vault.</div>
      ) : rows.length === 0 ? (
        <div className="rp-card rp-empty">No questions match the selected filters.</div>
      ) : (
        <>
          <div className="rp-grid">
            {/* Approval pipeline */}
            <section className="rp-card">
              <h3 className="rp-card-title">Approval pipeline</h3>
              <p className="rp-card-sub">Where the questions are right now: Staff → HOD → Dean → Scrutinizer → COE.</p>
              <div className="rp-bars">
                {stageCounts.map((s) => (
                  <div key={s.key} className={`rp-bar-row${s.count ? "" : " is-zero"}`}>
                    <span className="rp-bar-label">{s.label}</span>
                    <div className="rp-bar-track">
                      <div className="rp-bar-fill" style={{ width: `${(s.count / maxStage) * 100}%`, background: s.color }} />
                    </div>
                    <span className="rp-bar-value">
                      <b>{s.count}</b> <em>{pct(s.count, rows.length)}%</em>
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Bloom's levels */}
            <section className="rp-card">
              <h3 className="rp-card-title">Bloom&apos;s level distribution</h3>
              <p className="rp-card-sub">Cognitive level of the questions, L1 Remember to L6 Create.</p>
              <div className="rp-bars">
                {BLOOM_LEVELS.map((name, i) => (
                  <div key={name} className={`rp-bar-row${levelCounts[i] ? "" : " is-zero"}`}>
                    <span className="rp-bar-label">L{i + 1} {name}</span>
                    <div className="rp-bar-track">
                      <div className="rp-bar-fill" style={{ width: `${(levelCounts[i] / maxLevel) * 100}%`, background: LEVEL_COLORS[i] }} />
                    </div>
                    <span className="rp-bar-value">
                      <b>{levelCounts[i]}</b> <em>{pct(levelCounts[i], rows.length)}%</em>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Unit coverage */}
          <section className="rp-card">
            <h3 className="rp-card-title">Unit-wise coverage</h3>
            <p className="rp-card-sub">Questions and marks in each unit, split into MCQ and Descriptive.</p>
            <div className="rp-table-wrap">
              <table className="rp-table">
                <thead>
                  <tr><th>Unit</th><th>MCQ</th><th>Descriptive</th><th>Total</th><th>Marks</th></tr>
                </thead>
                <tbody>
                  {unitRows.map((u) => (
                    <tr key={u.unit}>
                      <td className="is-strong">{u.unit}</td>
                      <td className={u.mcq ? "" : "is-alert"}>{u.mcq}</td>
                      <td className={u.descriptive ? "" : "is-alert"}>{u.descriptive}</td>
                      <td>{u.mcq + u.descriptive}</td>
                      <td>{u.marks}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td>{unitRows.reduce((s, u) => s + u.mcq, 0)}</td>
                    <td>{unitRows.reduce((s, u) => s + u.descriptive, 0)}</td>
                    <td>{rows.length}</td>
                    <td>{totalMarks}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* Subject-wise */}
          <section className="rp-card">
            <h3 className="rp-card-title">Subject-wise report</h3>
            <p className="rp-card-sub">Question count, marks and final-approval progress for each subject.</p>
            <div className="rp-table-wrap">
              <table className="rp-table">
                <thead>
                  <tr><th>Subject</th><th>Questions</th><th>MCQ</th><th>Descriptive</th><th>Marks</th><th className="rp-progress-col">Final approval</th></tr>
                </thead>
                <tbody>
                  {subjectRows.map((s) => (
                    <tr key={s.subject}>
                      <td className="is-strong">{s.subject}</td>
                      <td>{s.total}</td>
                      <td>{s.mcq}</td>
                      <td>{s.descriptive}</td>
                      <td>{s.marks}</td>
                      <td className="rp-progress-col">
                        <div className="rp-progress">
                          <div className="rp-progress-track"><div style={{ width: `${pct(s.final, s.total)}%` }} /></div>
                          <span>{s.final}/{s.total} · {pct(s.final, s.total)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <ToastNotification message={toast.message} type="success" isVisible={toast.visible} onClose={() => setToast((t) => ({ ...t, visible: false }))} />
    </div>
  );
}

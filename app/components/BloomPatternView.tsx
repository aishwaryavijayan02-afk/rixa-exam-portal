"use client";

import React, { useEffect, useState } from "react";
import { Award, CheckCircle2, FileQuestion, Layers, ListChecks, PenLine } from "lucide-react";
import { BLOOM_LEVELS, unitNumber } from "../lib/bloomTaxonomy";

/** Counts up from 0 to `value` once (eased); shows the final value right away for reduced motion. */
function useCountUp(value: number, duration = 900) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return shown;
}

function StatTile({ label, value, icon: Icon, accent, index }: { label: string; value: number; icon: React.ElementType; accent: string; index: number }) {
  const shown = useCountUp(value);
  return (
    <div className="bpv-tile" style={{ "--tile-accent": accent, animationDelay: `${index * 70}ms` } as React.CSSProperties}>
      <span className="bpv-tile-icon">
        <Icon size={16} />
      </span>
      <div className="bpv-tile-value">{shown}</div>
      <div className="bpv-tile-label">{label}</div>
    </div>
  );
}

/** The fields of a parsed question this view shows. */
export interface BloomViewQuestion {
  question: string;
  type?: string;
  unit?: string;
  marks?: number;
  bloomLevel?: string;
  options?: string[];
  correctAnswer?: string;
  /** Internal: position in the list passed to the view. */
  __index?: number;
}

const LEVEL_COLORS = ["#64748b", "#0e7490", "#15803d", "#b45309", "#7e22ce", "#be123c"];

const levelOf = (q: BloomViewQuestion) => {
  const index = BLOOM_LEVELS.findIndex((name) => name.toLowerCase() === (q.bloomLevel || "").toLowerCase());
  return index >= 0 ? index + 1 : 0;
};
const isMcq = (q: BloomViewQuestion) => q.type === "MCQ";

/** "Unit I - Exploring Advertising" -> { label: "Unit 1", title: "Exploring Advertising" } */
function unitHeading(unit?: string): { label: string; title: string } {
  const n = unitNumber(unit);
  const title = (unit || "").replace(/^(?:unit|module|chapter)?\s*(?:\d+|[ivxlcdm]+)?\s*[-–—:.)]*\s*/i, "").trim();
  if (n === 99) return { label: unit || "General", title: "" };
  return { label: `Unit ${n}`, title };
}

function groupByUnit(questions: BloomViewQuestion[]) {
  const map = new Map<string, { order: number; label: string; title: string; items: BloomViewQuestion[] }>();
  questions.forEach((q) => {
    const order = unitNumber(q.unit);
    const heading = unitHeading(q.unit);
    const key = order === 99 ? heading.label : `u${order}`;
    const group = map.get(key) || { order, label: heading.label, title: heading.title, items: [] };
    if (!group.title && heading.title) group.title = heading.title;
    group.items.push(q);
    map.set(key, group);
  });
  return [...map.values()]
    .sort((a, b) => a.order - b.order)
    .map((g) => ({ ...g, items: [...g.items].sort((a, b) => levelOf(a) - levelOf(b)) }));
}

function LevelChip({ level, name, onChange }: { level: number; name?: string; onChange?: (level: string) => void }) {
  const color = level ? LEVEL_COLORS[level - 1] : "#94a3b8";
  if (onChange) {
    // Choose the Bloom's level yourself.
    return (
      <span className="bpv-level bpv-level-select" style={{ color, borderColor: `${color}66`, background: `${color}12` }}>
        <span className="bpv-level-dot" style={{ background: color }} />
        <select value={level ? BLOOM_LEVELS[level - 1] : ""} onChange={(e) => onChange(e.target.value)} aria-label="Bloom's level" style={{ color }}>
          {!level && <option value="">Choose level</option>}
          {BLOOM_LEVELS.map((levelName, i) => (
            <option key={levelName} value={levelName}>
              L{i + 1} · {levelName}
            </option>
          ))}
        </select>
      </span>
    );
  }
  return (
    <span className="bpv-level" style={{ color, borderColor: `${color}55`, background: `${color}12` }}>
      <span className="bpv-level-dot" style={{ background: color }} />
      {level ? `L${level} · ${BLOOM_LEVELS[level - 1]}` : name || "—"}
    </span>
  );
}

/**
 * Question bank shown in the Bloom's Taxonomy pattern, laid out like the
 * original paper: Section A (all MCQ) then Section B (all Descriptive), each
 * arranged unit-wise and ordered L1 Remember → L6 Create.
 */
export default function BloomPatternView({
  questions: sourceQuestions,
  onLevelChange,
}: {
  questions: BloomViewQuestion[];
  /** When given, each question's Bloom's level can be chosen from a dropdown. */
  onLevelChange?: (question: BloomViewQuestion, level: string) => void;
}) {
  // Levels chosen here show immediately (summary, distribution and ordering).
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  useEffect(() => setOverrides({}), [sourceQuestions]);
  const questions = sourceQuestions.map((q, i) => ({ ...q, bloomLevel: overrides[i] ?? q.bloomLevel, __index: i }));
  const chooseLevel = (q: { __index: number }, level: string) => {
    setOverrides((prev) => ({ ...prev, [q.__index]: level }));
    onLevelChange?.(sourceQuestions[q.__index], level);
  };
  if (!questions.length) return <div className="bpv-empty">No questions were found in this file.</div>;

  const mcq = questions.filter(isMcq);
  const descriptive = questions.filter((q) => !isMcq(q));
  const totalMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  const levelCounts = BLOOM_LEVELS.map((_, i) => questions.filter((q) => levelOf(q) === i + 1).length);
  const unitCount = new Set(questions.map((q) => unitNumber(q.unit) === 99 ? q.unit || "General" : unitNumber(q.unit))).size;

  const sections = [
    { key: "A", title: "Multiple Choice Questions", icon: ListChecks, items: mcq },
    { key: "B", title: "Descriptive Questions", icon: PenLine, items: descriptive },
  ].filter((s) => s.items.length);

  return (
    <div className="bpv">
      {/* ---------- Summary ---------- */}
      <div className="bpv-summary">
        <div className="bpv-stats">
          {([
            ["Questions", questions.length, FileQuestion, "#774c28"],
            ["MCQ", mcq.length, ListChecks, "#0e7490"],
            ["Descriptive", descriptive.length, PenLine, "#15803d"],
            ["Units", unitCount, Layers, "#b45309"],
            ["Total marks", totalMarks, Award, "#7e22ce"],
          ] as const).map(([label, value, icon, accent], index) => (
            <StatTile key={label} label={label} value={value} icon={icon} accent={accent} index={index} />
          ))}
        </div>
        <div className="bpv-dist">
          <div className="bpv-dist-head">
            <span className="bpv-dist-title">Bloom&apos;s level distribution</span>
            <span className="bpv-dist-hint">
              Higher-order (L4–L6): <b>{Math.round(((levelCounts[3] + levelCounts[4] + levelCounts[5]) / questions.length) * 100)}%</b>
            </span>
          </div>
          <div className="bpv-dist-bar" role="img" aria-label="Bloom's level distribution">
            {levelCounts.map((count, i) =>
              count ? (
                <span
                  key={i}
                  className="bpv-dist-seg"
                  style={{ flex: count, background: LEVEL_COLORS[i], animationDelay: `${150 + i * 110}ms` }}
                  title={`L${i + 1} ${BLOOM_LEVELS[i]}: ${count} (${Math.round((count / questions.length) * 100)}%)`}
                />
              ) : null,
            )}
          </div>
          <div className="bpv-dist-legend">
            {BLOOM_LEVELS.map((name, i) => (
              <span key={name} className={`bpv-chip${levelCounts[i] ? "" : " is-zero"}`} style={{ "--chip": LEVEL_COLORS[i], animationDelay: `${250 + i * 60}ms` } as React.CSSProperties}>
                <i />
                <span className="bpv-chip-name">L{i + 1} {name}</span>
                <b>{levelCounts[i]}</b>
                <em>{Math.round((levelCounts[i] / questions.length) * 100)}%</em>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- Sections (as in the original paper) ---------- */}
      {sections.map((section) => {
        const Icon = section.icon;
        const marks = section.items.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
        let number = 0;
        return (
          <section key={section.key} className="bpv-section">
            <header className="bpv-section-head">
              <span className="bpv-section-badge">{section.key}</span>
              <div className="bpv-section-text">
                <div className="bpv-section-kicker">Section {section.key}</div>
                <div className="bpv-section-title">
                  <Icon size={16} /> {section.title}
                </div>
              </div>
              <div className="bpv-section-meta">
                {section.items.length} question{section.items.length === 1 ? "" : "s"} · {marks} marks
              </div>
            </header>

            {groupByUnit(section.items).map((unit) => (
              <div key={`${section.key}-${unit.label}`} className="bpv-unit">
                <div className="bpv-unit-head">
                  <span className="bpv-unit-label">{unit.label}</span>
                  {unit.title && <span className="bpv-unit-title">{unit.title}</span>}
                  <span className="bpv-unit-count">{unit.items.length}</span>
                </div>
                <ol className="bpv-list">
                  {unit.items.map((q, i) => {
                    number += 1;
                    const level = levelOf(q);
                    const answer = (q.correctAnswer || "").trim();
                    return (
                      <li key={`${section.key}-${unit.label}-${i}`} className="bpv-q">
                        <span className="bpv-q-no">{number}</span>
                        <div className="bpv-q-body">
                          <div className="bpv-q-text">{q.question}</div>
                          {q.options && q.options.length > 0 && (
                            <div className="bpv-options">
                              {q.options.map((option, oi) => {
                                const letter = String.fromCharCode(97 + oi);
                                const correct = answer && (answer.toLowerCase().replace(/[^a-z]/g, "") === letter || answer.toLowerCase() === option.toLowerCase());
                                return (
                                  <div key={oi} className={`bpv-option${correct ? " is-correct" : ""}`}>
                                    <span className="bpv-option-letter">{letter}</span>
                                    <span>{option}</span>
                                    {correct && <CheckCircle2 size={14} className="bpv-option-check" />}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="bpv-q-side">
                          <LevelChip level={level} name={q.bloomLevel} onChange={onLevelChange ? (value) => chooseLevel({ __index: q.__index ?? 0 }, value) : undefined} />
                          <span className="bpv-marks">{q.marks ?? "—"} {q.marks === 1 ? "mark" : "marks"}</span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, ImagePlus, ListChecks, PenLine, Plus, Sparkles, Trash2, X } from "lucide-react";
import { INSTITUTIONAL_SUBJECTS, QuestionItem } from "../lib/examStore";
import { BLOOM_LEVELS, inferBloomLevel } from "../lib/bloomTaxonomy";

const LEVEL_COLORS = ["#64748b", "#0e7490", "#15803d", "#b45309", "#7e22ce", "#be123c"];
const UNITS = ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5"];
const LETTERS = "abcdef";

type QType = "MCQ" | "Descriptive";

interface Draft {
  subject: string;
  unit: string;
  topic: string;
  type: QType;
  question: string;
  options: string[];
  correct: number; // index into options, -1 = not chosen
  bloomLevel: string;
  bloomTouched: boolean;
  marks: number;
  difficulty: "Easy" | "Medium" | "Hard";
  imageUrl?: string;
  diagramTitle: string;
}

/** "Unit I - Intro" / "2" / "Unit 3" -> "Unit 3" style value for the selector. */
function toUnitValue(unit?: string): string {
  // Skip the word "Unit"/"Module" itself (its "i" is not a roman numeral).
  const match = (unit || "").replace(/^\s*(?:unit|module|chapter)\b/i, "").match(/\b(\d+|[ivx]+)\b/i);
  if (!match) return "Unit 1";
  const roman: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 };
  const n = /^\d+$/.test(match[1]) ? Number(match[1]) : roman[match[1].toLowerCase()] || 1;
  return `Unit ${Math.min(Math.max(n, 1), 5)}`;
}

function draftFrom(initial?: Partial<QuestionItem> | null): Draft {
  const type: QType = initial?.type === "MCQ" ? "MCQ" : "Descriptive";
  const options = initial?.options && initial.options.length ? [...initial.options] : ["", "", "", ""];
  const answer = (initial?.correctAnswer || "").trim().toLowerCase();
  const correct = answer ? options.findIndex((o, i) => LETTERS[i] === answer.replace(/[^a-z]/g, "") || o.toLowerCase() === answer) : -1;
  return {
    subject: initial?.subject || "",
    unit: toUnitValue(initial?.unit),
    topic: initial?.topic || "",
    type,
    question: initial?.question || "",
    options: type === "MCQ" ? options : ["", "", "", ""],
    correct,
    bloomLevel: initial?.bloomLevel && BLOOM_LEVELS.includes(initial.bloomLevel as never) ? initial.bloomLevel : "",
    bloomTouched: Boolean(initial?.bloomLevel),
    marks: Number(initial?.marks) || (type === "MCQ" ? 1 : 8),
    difficulty: (initial?.difficulty as Draft["difficulty"]) || "Medium",
    imageUrl: initial?.imageUrl,
    diagramTitle: initial?.diagramTitle || "",
  };
}

/**
 * Professional add / edit form for a single question: subject & unit,
 * MCQ or Descriptive (with options and correct answer), Bloom's level
 * (auto-suggested from the action verb), marks, difficulty and a live preview.
 */
export default function ManualQuestionForm({
  isOpen,
  initial,
  onClose,
  onSave,
  subjects = [],
}: {
  isOpen: boolean;
  /** Extra subject names to offer (e.g. subjects of uploaded question banks). */
  subjects?: string[];
  /** Question being edited; omit to add a new one. */
  initial?: QuestionItem | null;
  onClose: () => void;
  /** Saves the question; `addAnother` keeps the form open for the next one. */
  onSave: (data: Partial<QuestionItem>, opts: { addAnother: boolean }) => void;
}) {
  const isEdit = Boolean(initial);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(initial));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraft(draftFrom(initial));
      setError(null);
    }
  }, [isOpen, initial]);

  // Bloom's level suggested from the question's action verb (until the user picks one).
  const suggestedLevel = useMemo(() => inferBloomLevel(draft.question) || (draft.type === "MCQ" ? 1 : 2), [draft.question, draft.type]);
  const levelName = draft.bloomTouched && draft.bloomLevel ? draft.bloomLevel : BLOOM_LEVELS[suggestedLevel - 1];
  const levelIndex = BLOOM_LEVELS.indexOf(levelName as never) + 1;

  if (!isOpen) return null;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setType = (type: QType) =>
    setDraft((d) => ({ ...d, type, marks: d.marks === (d.type === "MCQ" ? 1 : 8) ? (type === "MCQ" ? 1 : 8) : d.marks }));
  const setOption = (index: number, value: string) => setDraft((d) => ({ ...d, options: d.options.map((o, i) => (i === index ? value : o)) }));
  const addOption = () => setDraft((d) => (d.options.length >= 6 ? d : { ...d, options: [...d.options, ""] }));
  const removeOption = (index: number) =>
    setDraft((d) => {
      if (d.options.length <= 2) return d;
      const options = d.options.filter((_, i) => i !== index);
      const correct = d.correct === index ? -1 : d.correct > index ? d.correct - 1 : d.correct;
      return { ...d, options, correct };
    });

  const handleImage = (file?: File) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setError("Please choose an image smaller than 3 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set("imageUrl", String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const submit = (addAnother: boolean) => {
    const question = draft.question.trim();
    const filledOptions = draft.options.map((o) => o.trim());
    if (!draft.subject) return setError("Please choose the subject.");
    if (question.length < 10) return setError("Please enter the full question (at least 10 characters).");
    if (draft.type === "MCQ") {
      if (filledOptions.filter(Boolean).length < 2) return setError("An MCQ needs at least two options.");
      if (draft.correct < 0 || !filledOptions[draft.correct]) return setError("Please tick the correct answer for the MCQ.");
    }
    if (!draft.marks || draft.marks <= 0) return setError("Please enter the marks for this question.");
    setError(null);
    const options = draft.type === "MCQ" ? filledOptions.filter(Boolean) : [];
    const correctText = draft.type === "MCQ" ? filledOptions[draft.correct] : "";
    onSave(
      {
        question,
        subject: draft.subject,
        unit: draft.unit,
        topic: draft.topic.trim() || "General",
        type: draft.type,
        options,
        correctAnswer: draft.type === "MCQ" ? LETTERS[options.indexOf(correctText)] || "" : "",
        bloomLevel: levelName,
        marks: Number(draft.marks),
        difficulty: draft.difficulty,
        imageUrl: draft.imageUrl,
        diagramTitle: draft.diagramTitle.trim() || undefined,
      },
      { addAnother },
    );
    if (addAnother) {
      // Keep subject, unit, topic and type for the next question.
      setDraft((d) => ({ ...draftFrom({ subject: d.subject, unit: d.unit, topic: d.topic, type: d.type }), marks: d.marks }));
    }
  };

  const subjectInfo = INSTITUTIONAL_SUBJECTS.find((s) => s.name === draft.subject);

  return (
    <div className="mqf-overlay" onClick={onClose}>
      <div className="mqf-card" role="dialog" aria-modal="true" aria-labelledby="mqf-title" onClick={(e) => e.stopPropagation()}>
        <header className="mqf-head">
          <span className="mqf-head-icon"><PenLine size={18} /></span>
          <div className="mqf-head-text">
            <h3 id="mqf-title">{isEdit ? "Edit question" : "Add a question manually"}</h3>
            <p>Fill in the question details. The Bloom&apos;s level is suggested automatically from the question&apos;s action verb.</p>
          </div>
          <button type="button" className="mqf-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="mqf-body">
          <div className="mqf-main">
            {/* 1. Subject & unit */}
            <section className="mqf-section">
              <div className="mqf-section-title"><span>1</span> Subject &amp; unit</div>
              <div className="mqf-grid">
                <label className="mqf-field mqf-span2">
                  <span>Subject *</span>
                  <select value={draft.subject} onChange={(e) => set("subject", e.target.value)}>
                    <option value="">Select a subject</option>
                    {subjects.filter((name) => !INSTITUTIONAL_SUBJECTS.some((s) => s.name === name)).map((name) => (
                      <option key={`up-${name}`} value={name}>{name} (uploaded question bank)</option>
                    ))}
                    {INSTITUTIONAL_SUBJECTS.map((s) => (
                      <option key={s.code} value={s.name}>{s.name} ({s.code})</option>
                    ))}
                    {draft.subject && !subjectInfo && !subjects.includes(draft.subject) && <option value={draft.subject}>{draft.subject}</option>}
                  </select>
                </label>
                <label className="mqf-field">
                  <span>Unit *</span>
                  <select value={draft.unit} onChange={(e) => set("unit", e.target.value)}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
                <label className="mqf-field">
                  <span>Topic</span>
                  <input value={draft.topic} onChange={(e) => set("topic", e.target.value)} placeholder="e.g. Media planning" />
                </label>
              </div>
            </section>

            {/* 2. Question */}
            <section className="mqf-section">
              <div className="mqf-section-title"><span>2</span> Question</div>
              <div className="mqf-toggle" role="radiogroup" aria-label="Question type">
                {(["MCQ", "Descriptive"] as QType[]).map((t) => (
                  <button key={t} type="button" role="radio" aria-checked={draft.type === t} className={draft.type === t ? "is-on" : ""} onClick={() => setType(t)}>
                    {t === "MCQ" ? <ListChecks size={15} /> : <BookOpen size={15} />}
                    {t === "MCQ" ? "Multiple choice (MCQ)" : "Descriptive"}
                  </button>
                ))}
              </div>
              <label className="mqf-field">
                <span>Question text *</span>
                <textarea rows={4} value={draft.question} onChange={(e) => set("question", e.target.value)} placeholder={draft.type === "MCQ" ? "e.g. Which of the following best describes advertising?" : "e.g. Explain the role of advertising in the marketing process."} />
                <em className="mqf-count">{draft.question.trim().length} characters</em>
              </label>

              {draft.type === "MCQ" && (
                <div className="mqf-options">
                  <div className="mqf-options-head">
                    <span>Options * <small>(tick the correct answer)</small></span>
                    {draft.options.length < 6 && (
                      <button type="button" onClick={addOption}><Plus size={13} /> Add option</button>
                    )}
                  </div>
                  {draft.options.map((option, i) => (
                    <div key={i} className={`mqf-option${draft.correct === i ? " is-correct" : ""}`}>
                      <button type="button" className="mqf-tick" onClick={() => set("correct", i)} aria-label={`Mark option ${LETTERS[i]} as correct`} aria-pressed={draft.correct === i}>
                        {draft.correct === i ? <CheckCircle2 size={16} /> : LETTERS[i].toUpperCase()}
                      </button>
                      <input value={option} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${LETTERS[i].toUpperCase()}`} />
                      {draft.options.length > 2 && (
                        <button type="button" className="mqf-remove" onClick={() => removeOption(i)} aria-label={`Remove option ${LETTERS[i]}`}><Trash2 size={14} /></button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 3. Classification */}
            <section className="mqf-section">
              <div className="mqf-section-title"><span>3</span> Classification</div>
              <div className="mqf-field">
                <span>
                  Bloom&apos;s level
                  {!draft.bloomTouched && draft.question.trim() && <em className="mqf-suggest"><Sparkles size={12} /> suggested from the question</em>}
                </span>
                <div className="mqf-levels">
                  {BLOOM_LEVELS.map((name, i) => (
                    <button
                      key={name}
                      type="button"
                      className={levelName === name ? "is-on" : ""}
                      style={{ "--lv": LEVEL_COLORS[i] } as React.CSSProperties}
                      onClick={() => setDraft((d) => ({ ...d, bloomLevel: name, bloomTouched: true }))}
                    >
                      L{i + 1} · {name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mqf-grid">
                <label className="mqf-field">
                  <span>Marks *</span>
                  <input type="number" min={1} max={100} value={draft.marks || ""} onChange={(e) => set("marks", Number(e.target.value))} />
                </label>
                <div className="mqf-field mqf-span2">
                  <span>Difficulty</span>
                  <div className="mqf-toggle is-small">
                    {(["Easy", "Medium", "Hard"] as const).map((d) => (
                      <button key={d} type="button" className={draft.difficulty === d ? "is-on" : ""} onClick={() => set("difficulty", d)}>{d}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mqf-field">
                <span>Diagram / image (optional)</span>
                {draft.imageUrl ? (
                  <div className="mqf-image">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={draft.imageUrl} alt="Question diagram" />
                    <div className="mqf-image-side">
                      <input value={draft.diagramTitle} onChange={(e) => set("diagramTitle", e.target.value)} placeholder="Figure caption, e.g. Figure 1.1: Media mix" />
                      <button type="button" onClick={() => setDraft((d) => ({ ...d, imageUrl: undefined, diagramTitle: "" }))}><Trash2 size={13} /> Remove image</button>
                    </div>
                  </div>
                ) : (
                  <label className="mqf-drop">
                    <ImagePlus size={18} />
                    <span>Click to attach a diagram (PNG / JPG, up to 3 MB)</span>
                    <input type="file" accept="image/*" onChange={(e) => handleImage(e.target.files?.[0])} hidden />
                  </label>
                )}
              </div>
            </section>
          </div>

          {/* Live preview */}
          <aside className="mqf-preview">
            <div className="mqf-preview-title">Live preview</div>
            <div className="mqf-preview-card">
              <div className="mqf-preview-meta">
                <span className="mqf-chip">{draft.type}</span>
                <span className="mqf-chip">{draft.unit}</span>
                <span className="mqf-chip">{draft.marks || 0} mark{draft.marks === 1 ? "" : "s"}</span>
              </div>
              <div className="mqf-preview-q">{draft.question.trim() || <i>Your question will appear here…</i>}</div>
              {draft.type === "MCQ" && (
                <div className="mqf-preview-opts">
                  {draft.options.map((o, i) => (
                    <div key={i} className={draft.correct === i ? "is-correct" : ""}>
                      <b>{LETTERS[i]}</b> {o.trim() || <i>Option {LETTERS[i].toUpperCase()}</i>}
                    </div>
                  ))}
                </div>
              )}
              {draft.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="mqf-preview-img" src={draft.imageUrl} alt="" />
              )}
              <div className="mqf-preview-foot">
                <span className="mqf-level" style={{ color: LEVEL_COLORS[levelIndex - 1], borderColor: `${LEVEL_COLORS[levelIndex - 1]}55`, background: `${LEVEL_COLORS[levelIndex - 1]}12` }}>
                  L{levelIndex} · {levelName}
                </span>
                <span className="mqf-preview-subject">{draft.subject || "No subject selected"}</span>
              </div>
            </div>
          </aside>
        </div>

        <footer className="mqf-foot">
          {error ? <div className="mqf-error" role="alert">{error}</div> : <div className="mqf-hint">Fields marked * are required.</div>}
          <div className="mqf-actions">
            {!isEdit && <button type="button" className="mqf-btn is-outline" onClick={() => submit(true)}><Plus size={14} /> Save &amp; add another</button>}
            <button type="button" className="mqf-btn is-ghost" onClick={() => submit(false)}>Save</button>
          </div>
        </footer>
      </div>
    </div>
  );
}

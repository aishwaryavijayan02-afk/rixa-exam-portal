"use client";

import ModalPortal from "./ModalPortal";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Trash2, Edit3, Eye, CheckCircle2, AlertTriangle, Save, Info, Sparkles, Check, FileText, Printer, Layers, School, FileCheck } from "lucide-react";
import { getQuestionBankDocument } from "../lib/questionBankDocuments";
import BloomPatternView, { type BloomViewQuestion } from "./BloomPatternView";
import { examStore, type QuestionItem } from "../lib/examStore";

// ======================== VIEW MODAL ========================
export interface ViewField {
  label: string;
  value: React.ReactNode;
  spanFull?: boolean;
}

export interface ViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: any; // string | { label: string; bg?: string; color?: string }
  badgeColor?: string;
  fields?: ViewField[];
  data?: any; // ViewField[] | Record<string, any>
  onEdit?: () => void;
  onDelete?: () => void;
  onVerify?: () => void;
  verifyLabel?: string;
  questionsList?: any[];
  originalDocumentUrl?: string | null;
  groupQuestionsByUnit?: boolean;
  hideVerifyAction?: boolean;
}

function UnitWiseQuestionPreview({ questions }: { questions: any[] }) {
  const groups = new Map<string, any[]>();
  let activeUnit = "1";
  let activeType: "MCQ" | "Descriptive" = "Descriptive";
  questions.forEach((question) => {
    const rawText = String(question.question || question.statement || "");
    const unitIsDefault = /^(?:unit\s*)?0*1$/i.test(String(question.unit || "1").trim());
    const questionHasOptions = Array.isArray(question.options) && question.options.length > 0;
    const normalized = {
      ...question,
      unit: unitIsDefault ? activeUnit : String(question.unit).trim(),
      type: questionHasOptions || /mcq|multiple[\s-]*choice/i.test(String(question.type || "")) || activeType === "MCQ" ? "MCQ" : "Descriptive",
      question: rawText
        .replace(/^\s*UNIT\s+(?:[IVXLCDM]+|\d+)\s*(?:[-–—:].*)?$/gim, "")
        .replace(/^\s*SECTION\s+[A-Z0-9]+\s*[-–—:].*$/gim, "")
        .replace(/^\s*MCQ\s+ANSWER\s+KEY\s*$/gim, "")
        .trim(),
    };

    const unitHeadings = [...rawText.matchAll(/^\s*UNIT\s+([IVXLCDM]+|\d+)\s*(?:[-–—:]\s*([^\n]*))?\s*$/gim)];
    const lastUnitHeading = unitHeadings[unitHeadings.length - 1];
    if (lastUnitHeading) activeUnit = `Unit ${lastUnitHeading[1]}${lastUnitHeading[2]?.trim() ? ` - ${lastUnitHeading[2].trim()}` : ""}`;
    const sectionHeadings = [...rawText.matchAll(/^\s*(?:SECTION\s+[A-Z0-9]+\s*[-–—:]\s*)?(MCQ|MULTIPLE[\s-]*CHOICE|DESCRIPTIVE)[^\n]*$/gim)];
    const lastSectionHeading = sectionHeadings[sectionHeadings.length - 1]?.[1];
    if (lastSectionHeading) activeType = /mcq|multiple[\s-]*choice/i.test(lastSectionHeading) ? "MCQ" : "Descriptive";

    const unit = String(normalized.unit || "Unassigned").trim();
    groups.set(unit, [...(groups.get(unit) || []), normalized]);
  });
  const romanRanks: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
  const unitRank = (unit: string) => {
    const match = unit.match(/(?:unit\s*)?(\d+|i{1,3}|iv|v|vi{0,3}|ix|x)/i);
    return match ? Number(match[1]) || romanRanks[match[1].toUpperCase()] || Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
  };
  const orderedGroups = [...groups.entries()].sort(([a], [b]) => unitRank(a) - unitRank(b) || a.localeCompare(b));

  return (
    <div style={{ display: "grid", gap: "15px" }}>
      {orderedGroups.map(([unit, unitQuestions], unitIndex) => {
        const title = /^unit\b/i.test(unit) || unit === "Unassigned" ? unit : `Unit ${unit}`;
        return (
          <section key={unit} style={{ overflow: "hidden", border: "1px solid #d7e3f0", borderRadius: "14px", background: "#fff", boxShadow: "0 4px 14px rgba(75, 49, 31,.045)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "13px 16px", borderBottom: "1px solid #e5edf5", background: "linear-gradient(105deg,#eff6ff,#f8fbff)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                <span style={{ display: "grid", width: "34px", height: "34px", flex: "0 0 34px", placeItems: "center", borderRadius: "10px", background: "#dcecff", color: "#7d5029", fontSize: "12px", fontWeight: 850 }}>{String(unitIndex + 1).padStart(2, "0")}</span>
                <div style={{ minWidth: 0 }}><h4 style={{ margin: 0, color: "#5a3a25", fontSize: "14px", fontWeight: 850 }}>{title}</h4><div style={{ marginTop: "3px", color: "#9a8471", fontSize: "11px" }}>Unit question bank</div></div>
              </div>
              <span style={{ padding: "5px 10px", border: "1px solid #c8dcf2", borderRadius: "999px", background: "#fff", color: "#8f5c30", fontSize: "11px", fontWeight: 800, whiteSpace: "nowrap" }}>{unitQuestions.length} {unitQuestions.length === 1 ? "question" : "questions"}</span>
            </div>
            <div style={{ display: "grid", gap: "14px", padding: "12px" }}>
              {(["MCQ", "Descriptive"] as const).map((questionKind) => {
                const matchingQuestions = unitQuestions.filter((question) => {
                  const type = String(question.type || "");
                  const isMcq = /mcq|multiple[\s-]*choice/i.test(type) || (Array.isArray(question.options) && question.options.length > 0);
                  return questionKind === "MCQ" ? isMcq : !isMcq;
                });
                if (matchingQuestions.length === 0) return null;
                return (
                  <section key={`${unit}-${questionKind}`} style={{ overflow: "hidden", border: "1px solid #e1eaf4", borderRadius: "11px", background: "#f8fbff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", padding: "10px 13px", borderBottom: "1px solid #e2eaf3", background: questionKind === "MCQ" ? "#eef6ff" : "#f3f6fb" }}>
                      <h5 style={{ margin: 0, color: "#784d28", fontSize: "12px", fontWeight: 850 }}>{questionKind === "MCQ" ? "Multiple Choice Questions" : "Descriptive Questions"}</h5>
                      <span style={{ color: "#8d7764", fontSize: "11px", fontWeight: 750 }}>{matchingQuestions.length} {matchingQuestions.length === 1 ? "question" : "questions"}</span>
                    </div>
                    <div style={{ display: "grid", gap: "8px", padding: "10px" }}>
                      {matchingQuestions.map((question, questionIndex) => (
                        <article key={question.id || `${unit}-${questionKind}-${questionIndex}`} style={{ padding: "13px 14px", border: "1px solid #e7edf4", borderRadius: "10px", background: questionIndex % 2 === 0 ? "#fff" : "#f9fbfd" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                            <div style={{ display: "flex", gap: "10px", minWidth: 0 }}><span style={{ color: "#a47246", fontSize: "11px", fontWeight: 850, whiteSpace: "nowrap" }}>Q{questionIndex + 1}</span><div style={{ color: "#1e293b", fontSize: "13px", fontWeight: 650, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{question.question || question.statement}</div></div>
                            <span style={{ padding: "4px 8px", borderRadius: "7px", background: "#eaf2fc", color: "#89582e", fontSize: "10px", fontWeight: 850, whiteSpace: "nowrap" }}>{Number(question.marks) || 2} marks</span>
                          </div>
                          {question.options?.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "7px 14px", margin: "10px 0 0 32px", color: "#475569", fontSize: "12px", lineHeight: 1.5 }}>{question.options.map((option: string, optionIndex: number) => <div key={`${question.id}-option-${optionIndex}`}><strong style={{ color: "#8b5b31" }}>{String.fromCharCode(65 + optionIndex)}.</strong> {option}</div>)}</div>}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "7px", margin: "10px 0 0 32px" }}>
                            {[question.topic, questionKind, question.difficulty || "Medium"].filter(Boolean).map((meta, metaIndex) => <span key={`${question.id}-meta-${metaIndex}`} style={{ padding: "3px 8px", border: "1px solid #e1e8f0", borderRadius: "999px", color: "#8d7764", background: "#fff", fontSize: "10px", fontWeight: 650 }}>{meta}</span>)}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function OriginalQuestionBankPreview({ name, url, fileAvailable }: { name: string; url: string; fileAvailable: boolean }) {
  const documentRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState(false);
  const isWordDocument = /\.docx$/i.test(name);

  useEffect(() => {
    const container = documentRef.current;
    if (!container || !fileAvailable || !url || !isWordDocument) return;
    let active = true;
    setRenderError(false);
    container.replaceChildren();
    void fetch(url).then((response) => {
      if (!response.ok) throw new Error("Unable to retrieve the original Word document.");
      return response.blob();
    }).then(async (documentBlob) => {
      const docxPreview = await import("docx-preview");
      if (!active || !documentRef.current) return;
      await docxPreview.renderAsync(documentBlob, documentRef.current, documentRef.current, {
        className: "approval-word-document",
        inWrapper: true,
        breakPages: true,
        ignoreLastRenderedPageBreak: false,
        renderHeaders: true,
        renderFooters: true,
      });
    }).catch((error) => {
      console.error("Unable to render the original Word question bank.", error);
      if (active) setRenderError(true);
    });
    return () => { active = false; };
  }, [fileAvailable, isWordDocument, url]);

  return (
    <section style={{ border: "1px solid #d8e1ec", borderRadius: "13px", background: "#e9eef5", overflow: "auto", padding: "18px", maxHeight: "62vh" }}>
      <div style={{ maxWidth: "980px", minHeight: "52vh", margin: "0 auto", border: "1px solid #e2e8f0", borderRadius: "8px", background: "#fff", boxShadow: "0 8px 24px rgba(40, 26, 17,.08)", overflow: "auto" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 2, padding: "14px 24px", borderBottom: "1px solid #edf1f5", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", color: "#64748b", fontSize: "11px", fontWeight: 700 }}><span>ORIGINAL WORD DOCUMENT</span><span>{name}</span></div>
        {fileAvailable && url && isWordDocument && !renderError ? <div ref={documentRef} style={{ padding: "20px", overflow: "auto" }} /> : (
          <div style={{ minHeight: "40vh", display: "grid", placeItems: "center", padding: "28px", textAlign: "center", color: "#746252", fontSize: "13px", lineHeight: 1.65 }}>
            {!fileAvailable ? <span>The original Word file is not stored for this earlier upload. Re-upload the .docx question bank in Academic Vault to view its original Word layout here.</span> : renderError ? <span>The Word file could not be rendered. <a href={url} download={name} style={{ color: "#7d5029", fontWeight: 800 }}>Download the original file</a> to open it in Microsoft Word.</span> : <span>This file type cannot be previewed as a Word document. <a href={url} download={name} style={{ color: "#7d5029", fontWeight: 800 }}>Download the original file</a>.</span>}
          </div>
        )}
      </div>
    </section>
  );
}

export function ViewModal({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  badgeColor,
  fields,
  data,
  onEdit,
  onDelete,
  onVerify,
  verifyLabel = "Verify Question",
  questionsList,
  originalDocumentUrl,
  groupQuestionsByUnit = false,
  hideVerifyAction = false,
}: ViewModalProps) {
  const [viewMode, setViewMode] = useState<"word" | "cards" | "units" | "original">(groupQuestionsByUnit ? "original" : "word");
  const [originalDocument, setOriginalDocument] = useState<{ name: string; url: string } | null>(null);
  const [documentLookupComplete, setDocumentLookupComplete] = useState(false);

  useEffect(() => {
    if (!isOpen || !groupQuestionsByUnit || !questionsList?.length) return;
    const sourceFile = questionsList.find((question) => question.sourceFile)?.sourceFile as string | undefined;
    if (!sourceFile) {
      setDocumentLookupComplete(true);
      setViewMode("original");
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    setDocumentLookupComplete(false);
    setOriginalDocument(null);
    setViewMode("original");
    void getQuestionBankDocument(sourceFile).then(async (file) => {
      if (!file) return null;
      objectUrl = URL.createObjectURL(file);
      return { name: sourceFile, url: objectUrl };
    }).then((document) => {
      if (!active) return;
      setOriginalDocument(document);
      setDocumentLookupComplete(true);
      if (!document) setViewMode("original");
    }).catch((error) => {
      console.warn("Unable to load the original question bank document.", error);
      if (active) {
        setOriginalDocument(null);
        setDocumentLookupComplete(true);
        setViewMode("original");
      }
    });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, groupQuestionsByUnit, questionsList]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Compute normalized fields
  const normalizedFields: ViewField[] = useMemo(() => {
    if (fields && Array.isArray(fields) && fields.length > 0) {
      return fields;
    }
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        label: item.label || item.key || item.name || "Field",
        value: item.value ?? item.text ?? "—",
        spanFull: item.spanFull,
      }));
    }
    if (data && typeof data === "object") {
      return Object.entries(data)
        .filter(([k]) => !["id", "dotColor", "typeBg", "typeColor", "raw"].includes(k))
        .map(([k, v]) => ({
          label: k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
          value: typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "—"),
        }));
    }
    return [];
  }, [fields, data]);

  // Compute normalized badge
  const normalizedBadge = useMemo(() => {
    if (!badge) return null;
    if (typeof badge === "object" && badge.label) return badge;
    if (typeof badge === "string") {
      const lower = badge.toLowerCase();
      let bg = "#e0e7ff";
      let color = "#c07d42";

      if (badgeColor === "green" || lower.includes("active") || lower.includes("success") || lower.includes("approv") || lower.includes("verif") || lower.includes("completed")) {
        bg = "#dcfce7";
        color = "#16a34a";
      } else if (badgeColor === "red" || lower.includes("reject") || lower.includes("fail") || lower.includes("danger") || lower.includes("error")) {
        bg = "#fee2e2";
        color = "#dc2626";
      } else if (badgeColor === "yellow" || lower.includes("pend") || lower.includes("warn") || lower.includes("medium") || lower.includes("progress")) {
        bg = "#fef3c7";
        color = "#d97706";
      } else if (badgeColor === "blue") {
        bg = "#eff6ff";
        color = "#c3844d";
      }
      return { label: badge, bg, color };
    }
    return null;
  }, [badge, badgeColor]);

  // Print function for internal paper document preview
  const handlePrintDocument = () => {
    const printContent = document.getElementById("word-document-preview-area");
    if (!printContent) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${title} - Question Paper Document</title>
          <style>
            body { font-family: 'Times New Roman', Georgia, serif; padding: 40px; color: #000; background: #fff; }
            .no-print { display: none !important; }
            h1, h2, h3 { text-align: center; margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; }
            td, th { border: 1px solid #000; padding: 6px 10px; font-size: 13px; }
            .section-header { font-weight: bold; margin-top: 18px; border-bottom: 2px solid #000; padding-bottom: 4px; }
            .q-item { margin-bottom: 14px; page-break-inside: avoid; }
            .q-marks { float: right; font-weight: bold; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  };

  if (!isOpen) return null;

  // Extract subject title if available
  const detectedSubject = title.split("-")[0]?.trim() || "Question Paper";

  return (
    <ModalPortal>
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(40, 26, 17, 0.65)",
        backdropFilter: "blur(6px)",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        className="crud-modal-box"
        style={{
          width: "100%",
          maxWidth: questionsList && questionsList.length > 0 ? "820px" : "680px",
          maxHeight: "90vh",
          background: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(240, 234, 226, 0.8)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, rgba(202, 146, 97, 0.15), rgba(212, 167, 128, 0.25))",
                color: "#ca9261",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Eye size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: "16.5px", fontWeight: 700, color: "#0f172a" }}>
                  {title}
                </h3>
                {normalizedBadge && (
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      background: normalizedBadge.bg,
                      color: normalizedBadge.color,
                    }}
                  >
                    {normalizedBadge.label}
                  </span>
                )}
              </div>
              {subtitle && (
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Mode Selector Switcher + Print & Close */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {questionsList && questionsList.length > 0 && (
              <div
                style={{
                  display: "inline-flex",
                  background: "#f1f5f9",
                  borderRadius: "10px",
                  padding: "3px",
                  border: "1px solid #e2e8f0",
                }}
              >
                {groupQuestionsByUnit && (
                  <button type="button" role="tab" aria-selected={viewMode === "original"} onClick={() => setViewMode("original")} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "8px", border: "none", background: viewMode === "original" ? "#ffffff" : "transparent", color: viewMode === "original" ? "#0f172a" : "#64748b", fontWeight: viewMode === "original" ? 800 : 650, fontSize: "12px", cursor: "pointer", boxShadow: viewMode === "original" ? "0 2px 6px rgba(0,0,0,0.06)" : "none" }}>
                    Bloom&apos;s Taxonomy Pattern
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewMode("word")}
                  style={{
                    display: groupQuestionsByUnit ? "none" : "flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "none",
                    background: viewMode === "word" ? "#ffffff" : "transparent",
                    color: viewMode === "word" ? "#c3844d" : "#64748b",
                    fontWeight: viewMode === "word" ? 700 : 500,
                    fontSize: "12px",
                    cursor: "pointer",
                    boxShadow: viewMode === "word" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <FileText size={14} />
                  <span>📄 Word Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  style={{
                    display: groupQuestionsByUnit ? "none" : "flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "none",
                    background: viewMode === "cards" ? "#ffffff" : "transparent",
                    color: viewMode === "cards" ? "#c3844d" : "#64748b",
                    fontWeight: viewMode === "cards" ? 700 : 500,
                    fontSize: "12px",
                    cursor: "pointer",
                    boxShadow: viewMode === "cards" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Layers size={14} />
                  <span>📋 Card View</span>
                </button>
              </div>
            )}

            {questionsList && questionsList.length > 0 && !groupQuestionsByUnit && originalDocumentUrl && (
              <button
                type="button"
                onClick={() => setViewMode("original")}
                style={{ padding: "7px 11px", border: `1px solid ${viewMode === "original" ? "#c3844d" : "#cbd5e1"}`, borderRadius: "8px", background: viewMode === "original" ? "#eff6ff" : "#fff", color: "#b8763d", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
              >
                View original upload
              </button>
            )}

            {questionsList && questionsList.length > 0 && viewMode === "word" && (
              <button
                type="button"
                onClick={handlePrintDocument}
                title="Print / View Fullscreen Internal Paper"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Printer size={14} />
                <span>Print Paper</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                color: "#64748b",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, background: viewMode === "word" && questionsList && questionsList.length > 0 ? "#f8fafc" : "#ffffff" }}>
          {normalizedFields.length === 0 && (!questionsList || questionsList.length === 0) ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
              No specific details available for this record.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {groupQuestionsByUnit && (
                <div style={{ marginBottom: "-4px", padding: "12px 15px", borderRadius: "10px", border: "1px solid #dbeafe", background: "linear-gradient(100deg,#eff6ff,#f0fdfa)", color: "#475569", fontSize: "12px" }}>
                  <strong style={{ color: "#0f172a" }}>Review the question bank.</strong> Questions are shown in the Bloom&apos;s Taxonomy pattern — Section A (MCQ) and Section B (Descriptive), each unit-wise from L1 to L6.
                </div>
              )}
              {normalizedFields.length > 0 && (
                <div
                  className="crud-form-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "14px",
                  }}
                >
                  {normalizedFields.map((f, i) => (
                    <div
                      key={i}
                      style={{
                        gridColumn: f.spanFull ? "span 2" : "span 1",
                        background: "#ffffff",
                        borderRadius: "12px",
                        padding: "12px 14px",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: "#64748b",
                          marginBottom: "5px",
                        }}
                      >
                        {f.label}
                      </div>
                      <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#1e293b", lineHeight: 1.5 }}>
                        {f.value || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Render Diagram / Image Attachment Preview if present */}
              {(data?.imageUrl || data?.raw?.imageUrl) && (
                <div
                  style={{
                    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                    borderRadius: "16px",
                    padding: "18px",
                    border: "1px solid rgba(204, 149, 100, 0.3)",
                    boxShadow: "0 8px 24px rgba(40, 26, 17, 0.25)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "18px" }}>🖼️</span>
                      <strong style={{ color: "#cc9564", fontSize: "13.5px", fontWeight: 700 }}>
                        Attached Question Diagram / Figure
                      </strong>
                      <span style={{ background: "rgba(204, 149, 100, 0.15)", color: "#cc9564", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700 }}>
                        {data?.diagramType || data?.raw?.diagramType || "Illustration"}
                      </span>
                    </div>
                  </div>

                  <div style={{ width: "100%", borderRadius: "12px", overflow: "hidden", background: "#120b07", border: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "center", alignItems: "center", padding: "12px" }}>
                    <img
                      src={data?.imageUrl || data?.raw?.imageUrl}
                      alt={data?.diagramTitle || "Question Diagram"}
                      style={{ maxWidth: "100%", maxHeight: "280px", objectFit: "contain", borderRadius: "8px" }}
                    />
                  </div>

                  {(data?.diagramTitle || data?.raw?.diagramTitle) && (
                    <div style={{ fontSize: "12.5px", color: "#e2e8f0", fontWeight: 600, textAlign: "center", fontStyle: "italic" }}>
                      {data?.diagramTitle || data?.raw?.diagramTitle}
                    </div>
                  )}
                </div>
              )}

              {/* ================= WORD DOCUMENT PAPER PREVIEW (Internal Format) ================= */}
              {questionsList && questionsList.length > 0 && groupQuestionsByUnit && viewMode === "original" && (
                <BloomPatternView questions={questionsList as BloomViewQuestion[]} />
              )}

              {questionsList && questionsList.length > 0 && viewMode === "word" && (
                <div
                  id="word-document-preview-area"
                  style={{
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
                    padding: "36px 40px",
                    position: "relative",
                    overflow: "hidden",
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    color: "#0f172a",
                    lineHeight: 1.6,
                  }}
                >
                  {/* Subtle Diagonal Watermark */}
                  <div
                    style={{
                      position: "absolute",
                      top: "40%",
                      left: "50%",
                      transform: "translate(-50%, -50%) rotate(-30deg)",
                      fontSize: "36px",
                      fontWeight: 800,
                      color: "rgba(240, 234, 226, 0.6)",
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                      letterSpacing: "4px",
                      textTransform: "uppercase",
                      userSelect: "none",
                    }}
                  >
                    CONFIDENTIAL • ACADEMIC INSPECTION
                  </div>

                  {/* University Header Banner */}
                  <div style={{ textAlign: "center", borderBottom: "2px double #0f172a", paddingBottom: "16px", marginBottom: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "4px" }}>
                      <img src="/images/rgu-logo.svg" alt="University Logo" style={{ height: "36px", objectFit: "contain" }} />
                    </div>
                    <h2 style={{ margin: "4px 0 2px", fontSize: "17px", fontWeight: 800, letterSpacing: "0.5px", textTransform: "uppercase", color: "#0f172a" }}>
                      RATHINAM GLOBAL (DEEMED TO BE UNIVERSITY)
                    </h2>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "1px" }}>
                      OFFICE OF THE CONTROLLER OF EXAMINATIONS
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "6px", color: "#1e293b", textTransform: "uppercase" }}>
                      END SEMESTER EXAMINATIONS — INTERNAL QUESTION PAPER PREVIEW
                    </div>
                  </div>

                  {/* Document Metadata Table */}
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "12.5px",
                      marginBottom: "20px",
                      background: "#fafafa",
                      border: "1px solid #0f172a",
                      fontFamily: "sans-serif",
                    }}
                  >
                    <tbody>
                      <tr>
                        <td style={{ padding: "6px 12px", border: "1px solid #0f172a", fontWeight: 700, width: "15%", background: "#f1f5f9" }}>Course / Subj:</td>
                        <td style={{ padding: "6px 12px", border: "1px solid #0f172a", fontWeight: 600 }}>{detectedSubject}</td>
                        <td style={{ padding: "6px 12px", border: "1px solid #0f172a", fontWeight: 700, width: "15%", background: "#f1f5f9" }}>Duration:</td>
                        <td style={{ padding: "6px 12px", border: "1px solid #0f172a", fontWeight: 600, width: "20%" }}>3 Hours</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "6px 12px", border: "1px solid #0f172a", fontWeight: 700, background: "#f1f5f9" }}>Semester/Year:</td>
                        <td style={{ padding: "6px 12px", border: "1px solid #0f172a", fontWeight: 600 }}>IV Semester / Academic Year 2024-2025</td>
                        <td style={{ padding: "6px 12px", border: "1px solid #0f172a", fontWeight: 700, background: "#f1f5f9" }}>Max. Marks:</td>
                        <td style={{ padding: "6px 12px", border: "1px solid #0f172a", fontWeight: 700, color: "#16a34a" }}>100 Marks</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* General Instructions */}
                  <div style={{ fontSize: "11.5px", fontStyle: "italic", border: "1px dashed #cbd5e1", padding: "8px 14px", borderRadius: "6px", marginBottom: "22px", background: "#f8fafc", fontFamily: "sans-serif" }}>
                    <strong>General Instructions to Inspection Authority:</strong> This digital paper preview formats questions into Word document specification. Answer all sections as per regulations. All diagrams must be verified for clarity.
                  </div>

                  {/* Render Question Sections (Part A, Part B, Part C...) */}
                  {(() => {
                    const uniqueMarks = Array.from(
                      new Set(questionsList.map((q) => Number(q.marks) || 5))
                    ).sort((a, b) => a - b);

                    const letterMap: Record<number, string> = { 2: "A", 5: "B", 10: "C", 12: "D", 15: "E", 16: "F" };

                    return uniqueMarks.map((mVal, mIdx) => {
                      const group = questionsList.filter((q) => (Number(q.marks) || 5) === mVal);
                      if (group.length === 0) return null;

                      const letter = letterMap[mVal] || String.fromCharCode(65 + mIdx);
                      const typeDesc = mVal <= 2 ? "Short Answer Questions" : mVal <= 5 ? "Descriptive Questions" : mVal <= 10 ? "Problem Solving & Analytical Questions" : "Case Study & Comprehensive Questions";
                      const sectionName = `PART — ${letter} (${mVal} Marks ${typeDesc})`;

                      return (
                        <div key={mVal} style={{ marginBottom: "24px" }}>
                          <div style={{ textAlign: "center", borderBottom: "1.5px solid #0f172a", paddingBottom: "4px", marginBottom: "14px" }}>
                            <strong style={{ fontSize: "14px", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                              {sectionName}
                            </strong>
                            <div style={{ fontSize: "11.5px", fontFamily: "sans-serif", color: "#475569", marginTop: "2px" }}>
                              Answer ALL Questions ({group.length} × {mVal} = {group.length * mVal} Marks)
                            </div>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            {group.map((q, qIdx) => (
                              <div key={q.id || qIdx} className="q-item" style={{ fontSize: "13.5px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
                                  <div style={{ flex: 1 }}>
                                    <strong>Q{qIdx + 1}.</strong> {q.question || q.statement}
                                  </div>
                                  <div className="q-marks" style={{ fontWeight: 700, flexShrink: 0, fontSize: "13px" }}>
                                    [{mVal}]
                                  </div>
                                </div>

                                {/* MCQ Options if available */}
                                {q.options && q.options.length > 0 && (
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "8px", marginLeft: "20px", fontSize: "12.5px", fontFamily: "sans-serif" }}>
                                    {q.options.map((opt: string, optIdx: number) => (
                                      <div key={optIdx}>
                                        <strong>({String.fromCharCode(65 + optIdx)})</strong> {opt}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Attached Diagram Image inside Word Paper */}
                                {(q.imageUrl || q.raw?.imageUrl) && (
                                  <div style={{ marginTop: "10px", marginLeft: "20px", textAlign: "center", border: "1px solid #e2e8f0", padding: "10px", borderRadius: "8px", background: "#fafafa" }}>
                                    <img src={q.imageUrl || q.raw?.imageUrl} alt="Question Diagram" style={{ maxHeight: "200px", maxWidth: "100%", objectFit: "contain" }} />
                                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", fontStyle: "italic" }}>
                                      Figure Q{qIdx + 1}: {q.diagramTitle || "Question Diagram"}
                                    </div>
                                  </div>
                                )}

                                {/* Question Metadata Footer */}
                                <div style={{ display: "flex", gap: "12px", fontSize: "10.5px", color: "#64748b", fontFamily: "sans-serif", marginTop: "4px", marginLeft: "20px" }}>
                                  <span>Unit: {q.unit || "Unit I"}</span>
                                  {q.bloomLevel && <span>Bloom's: {q.bloomLevel}</span>}
                                  <span>CO: CO{(qIdx % 4) + 1}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}

                  <div style={{ textAlign: "center", marginTop: "30px", borderTop: "1px solid #cbd5e1", paddingTop: "12px", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>
                    *** END OF QUESTION PAPER ***
                  </div>
                </div>
              )}

              {/* Categorized Questions List (Card Mode) */}
              {questionsList && questionsList.length > 0 && viewMode === "cards" && (
                <div style={{ marginTop: "6px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>Inspection Preview ({questionsList.length} Questions)</span>
                      <span style={{ fontSize: "11px", background: "#e0e7ff", color: "#c07d42", padding: "2px 8px", borderRadius: "12px", fontWeight: 700 }}>
                        Categorized by Marks
                      </span>
                    </div>
                    <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                      {Array.from(new Set(questionsList.map(q => Number(q.marks) || 5)))
                        .sort((a,b) => a - b)
                        .map(m => `${m} Marks: ${questionsList.filter(q => (Number(q.marks) || 5) === m).length}`)
                        .join(" | ")}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxHeight: "380px", overflowY: "auto", paddingRight: "4px" }}>
                    {(() => {
                      const uniqueMarks = Array.from(
                        new Set(questionsList.map((q) => Number(q.marks) || 5))
                      ).sort((a, b) => a - b);

                      return uniqueMarks.map((mVal) => {
                        const markGroup = questionsList.filter((q) => (Number(q.marks) || 5) === mVal);
                        if (markGroup.length === 0) return null;

                        const badgeBg = mVal <= 2 ? "#fef2f2" : mVal === 5 ? "#eff6ff" : mVal === 10 ? "#f0fdf4" : "#faf5ff";
                        const badgeColor = mVal <= 2 ? "#dc2626" : mVal === 5 ? "#b8763d" : mVal === 10 ? "#15803d" : "#b4743c";
                        const badgeBorder = mVal <= 2 ? "#fca5a5" : mVal === 5 ? "#bfdbfe" : mVal === 10 ? "#bbf7d0" : "#e9d5ff";

                        return (
                          <div key={mVal} style={{ background: "#f8fafc", border: `1px solid ${badgeBorder}`, borderRadius: "14px", padding: "14px" }}>
                            <div style={{ fontSize: "12.5px", fontWeight: 800, color: badgeColor, marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ background: badgeBg, padding: "3px 10px", borderRadius: "8px", border: `1px solid ${badgeBorder}` }}>
                                📌 Section ({mVal} Marks Questions) — {markGroup.length} Question(s)
                              </span>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                              {markGroup.map((q, qIdx) => (
                                <div
                                  key={q.id || qIdx}
                                  style={{
                                    background: "#ffffff",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "12px",
                                    padding: "12px 16px",
                                    boxShadow: "0 2px 6px rgba(0, 0, 0, 0.02)",
                                  }}
                                >
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "6px" }}>
                                    <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0f172a", lineHeight: 1.4 }}>
                                      Q{qIdx + 1}. {q.question || q.statement}
                                    </div>
                                    <span style={{ fontSize: "11px", fontWeight: 700, background: badgeBg, color: badgeColor, padding: "2px 8px", borderRadius: "6px", flexShrink: 0 }}>
                                      {mVal} Marks
                                    </span>
                                  </div>

                                <div style={{ display: "flex", gap: "12px", fontSize: "11.5px", color: "#64748b", flexWrap: "wrap", marginTop: "4px" }}>
                                  <span>Type: <strong>{q.type || "Descriptive"}</strong></span>
                                  <span>Difficulty: <strong>{q.difficulty || "Medium"}</strong></span>
                                  <span>Unit: <strong>{q.unit || "Unit I"}</strong></span>
                                  {q.bloomLevel && <span style={{ color: "#c9905e" }}>Bloom's: <strong>{q.bloomLevel}</strong></span>}
                                </div>

                                {q.options && q.options.length > 0 && (
                                  <div style={{ marginTop: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "12px", background: "#f8fafc", padding: "8px 10px", borderRadius: "8px" }}>
                                    {q.options.map((opt: string, optIdx: number) => (
                                      <div key={optIdx} style={{ color: "#334155" }}>
                                        <strong>{String.fromCharCode(65 + optIdx)}.</strong> {opt}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#ffffff",
          }}
        >
          <div>
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete();
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  border: "1px solid #fee2e2",
                  background: "#fff1f2",
                  color: "#e11d48",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              onClick={onClose}
              className="crud-close-btn"
              style={{
                padding: "8px 18px",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Close
            </button>

            {onVerify && !hideVerifyAction && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onVerify();
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "8px 20px",
                  borderRadius: "10px",
                  border: "none",
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)",
                  transition: "all 0.2s ease",
                }}
              >
                <Sparkles size={15} color="#ffffff" style={{ filter: "drop-shadow(0 0 4px rgba(255,255,255,0.8))" }} />
                <span>{verifyLabel}</span>
              </button>
            )}

            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit();
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 18px",
                  borderRadius: "10px",
                  border: "none",
                  background: "linear-gradient(135deg, #ca9261 0%, #cc9565 100%)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(202, 146, 97, 0.35)",
                }}
              >
                <Edit3 size={14} />
                <span>Edit Item</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

// ======================== EDIT / ADD FORM MODAL ========================
export interface FormFieldDef {
  key?: string;
  name?: string;
  label?: string;
  type?: "text" | "number" | "select" | "textarea" | string;
  options?: any[];
  placeholder?: string;
  required?: boolean;
  spanFull?: boolean;
}

export interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  fields?: FormFieldDef[];
  initialValues?: Record<string, any>;
  initialData?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => void;
  submitLabel?: string;
  onFieldChange?: (key: string, val: any, currentValues: Record<string, any>) => Record<string, any> | void;
}

export function FormModal({
  isOpen,
  onClose,
  title,
  subtitle,
  fields = [],
  initialValues,
  initialData,
  onSubmit,
  submitLabel = "Save Changes",
  onFieldChange,
}: FormModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isImageDragOver, setIsImageDragOver] = useState(false);
  const prevIsOpenRef = React.useRef(false);

  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      const init = initialValues || initialData || {};
      setFormData({ ...init });
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleChange = (key: string, val: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [key]: val };
      if (onFieldChange) {
        const patch = onFieldChange(key, val, updated);
        if (patch && typeof patch === "object") {
          return { ...updated, ...patch };
        }
      }
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  const handleDiagramImage = (fieldKey: string, file?: File) => {
    if (!file || !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = (evt) => handleChange(fieldKey, evt.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <ModalPortal>
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(40, 26, 17, 0.65)",
        backdropFilter: "blur(6px)",
        padding: "16px",
      }}
    >
      <div
        className="crud-modal-box"
        style={{
          width: "100%",
          maxWidth: "620px",
          maxHeight: "90vh",
          background: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(240, 234, 226, 0.8)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, rgba(202, 146, 97, 0.12), rgba(212, 167, 128, 0.2))",
                color: "#ca9261",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Edit3 size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#0f172a" }}>
                {title}
              </h3>
              {subtitle && (
                <p style={{ margin: "3px 0 0", fontSize: "12.5px", color: "#64748b" }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              color: "#64748b",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
            <div
              className="crud-form-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "16px",
              }}
            >
              {fields.map((f, i) => {
                const fieldKey = f.key || f.name || `field_${i}`;
                const fieldLabel = f.label || fieldKey;
                const val = formData[fieldKey] !== undefined ? formData[fieldKey] : "";
                const isFull = f.spanFull || f.type === "textarea";

                return (
                  <div
                    key={fieldKey || i}
                    style={{
                      gridColumn: isFull ? "span 2" : "span 1",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <label
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#334155",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span>{fieldLabel}</span>
                      {f.required && <span style={{ color: "#ef4444" }}>*</span>}
                    </label>

                    {f.type === "image" || f.type === "file" || fieldKey === "imageUrl" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {val ? (
                          <div
                            style={{
                              position: "relative",
                              border: "1px solid #cbd5e1",
                              borderRadius: "12px",
                              padding: "10px",
                              background: "#0f172a",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <img
                              src={val}
                              alt="Diagram Preview"
                              style={{ maxHeight: "180px", maxWidth: "100%", objectFit: "contain", borderRadius: "8px" }}
                            />
                            <button
                              type="button"
                              onClick={() => handleChange(fieldKey, "")}
                              style={{
                                padding: "4px 12px",
                                borderRadius: "6px",
                                background: "#ef4444",
                                color: "#ffffff",
                                border: "none",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Remove Diagram Image
                            </button>
                          </div>
                        ) : (
                          <div
                            className={`question-bank-dropzone crud-image-dropzone${isImageDragOver ? " is-drag-over" : ""}`}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); (event.currentTarget as HTMLElement).click(); } }}
                            onDragEnter={(event) => { event.preventDefault(); setIsImageDragOver(true); }}
                            onDragOver={(event) => { event.preventDefault(); setIsImageDragOver(true); }}
                            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsImageDragOver(false); }}
                            onDrop={(event) => { event.preventDefault(); setIsImageDragOver(false); handleDiagramImage(fieldKey, event.dataTransfer.files?.[0]); }}
                            style={{
                              border: "2px dashed #94a3b8",
                              borderRadius: "12px",
                              padding: "16px",
                              textAlign: "center",
                              background: "#f8fafc",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                            }}
                            onClick={() => {
                              const input = document.createElement("input");
                              input.type = "file";
                              input.accept = "image/*";
                              input.onchange = (e: any) => {
                                handleDiagramImage(fieldKey, e.target.files?.[0]);
                              };
                              input.click();
                            }}
                          >
                            <div style={{ fontSize: "24px", marginBottom: "4px" }}>🖼️</div>
                            <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#cc9565" }}>
                              Click or Drag & Drop Image/Diagram File
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                              Supports PNG, JPG, SVG, WebP (Max 5MB)
                            </div>
                          </div>
                        )}
                      </div>
                    ) : f.type === "textarea" ? (
                      <textarea
                        required={f.required}
                        value={val}
                        placeholder={f.placeholder}
                        onChange={(e) => handleChange(fieldKey, e.target.value)}
                        rows={3}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: "1px solid #cbd5e1",
                          fontSize: "13.5px",
                          color: "#0f172a",
                          outline: "none",
                          fontFamily: "inherit",
                          resize: "vertical",
                          boxSizing: "border-box",
                        }}
                      />
                    ) : f.type === "select" ? (
                      <select
                        required={f.required}
                        value={val}
                        onChange={(e) => handleChange(fieldKey, e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: "1px solid #cbd5e1",
                          fontSize: "13.5px",
                          color: "#0f172a",
                          outline: "none",
                          background: "#ffffff",
                          fontFamily: "inherit",
                          boxSizing: "border-box",
                          cursor: "pointer",
                        }}
                      >
                        {val &&
                          f.options &&
                          !f.options.some((opt: any) =>
                            typeof opt === "object" ? opt.value === val || opt.label === val : opt === val
                          ) && <option value={val}>{val}</option>}
                        {f.options?.map((opt: any, optIdx: number) => {
                          const optVal = typeof opt === "object" && opt !== null ? opt.value ?? opt.label : opt;
                          const optLabel = typeof opt === "object" && opt !== null ? opt.label ?? opt.value : opt;
                          return (
                            <option key={optVal ?? optIdx} value={optVal}>
                              {optLabel}
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <input
                        type={f.type || "text"}
                        required={f.required}
                        value={val !== undefined && val !== null ? val : ""}
                        placeholder={f.placeholder}
                        onFocus={(e) => {
                          if (f.type === "number" && (e.target.value === "0" || e.target.value === "")) {
                            e.target.select();
                          }
                        }}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (f.type === "number") {
                            handleChange(fieldKey, raw === "" ? "" : Number(raw));
                          } else {
                            handleChange(fieldKey, raw);
                          }
                        }}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: "1px solid #cbd5e1",
                          fontSize: "13.5px",
                          color: "#0f172a",
                          outline: "none",
                          fontFamily: "inherit",
                          boxSizing: "border-box",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "16px 24px",
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "12px",
              background: "#ffffff",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "9px 18px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                color: "#475569",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "9px 22px",
                borderRadius: "10px",
                border: "none",
                background: "linear-gradient(135deg, #ca9261 0%, #cc9565 100%)",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(202, 146, 97, 0.4)",
              }}
            >
              <Save size={15} />
              <span>{submitLabel}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
}

// ======================== DELETE CONFIRMATION MODAL ========================
export interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  itemName?: string;
  message?: string;
  onConfirm: () => void;
}

export function DeleteModal({
  isOpen,
  onClose,
  title = "Delete Item",
  itemName,
  message,
  onConfirm,
}: DeleteModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <ModalPortal>
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(40, 26, 17, 0.65)",
        backdropFilter: "blur(6px)",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        className="crud-modal-box"
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(240, 234, 226, 0.8)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "28px 24px 20px", textAlign: "center" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "#fef2f2",
              border: "1px solid #fee2e2",
              color: "#ef4444",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
            }}
          >
            <AlertTriangle size={28} />
          </div>

          <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
            {title}
          </h3>

          <p style={{ margin: 0, fontSize: "13.5px", color: "#64748b", lineHeight: 1.5 }}>
            {message || (
              <>
                Are you sure you want to permanently delete{" "}
                <strong style={{ color: "#0f172a" }}>{itemName ? `"${itemName}"` : "this item"}</strong>?
                This action cannot be undone.
              </>
            )}
          </p>
        </div>

        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #f1f5f9",
            background: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "9px 18px",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              color: "#475569",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 20px",
              borderRadius: "10px",
              border: "none",
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(239, 68, 68, 0.35)",
            }}
          >
            <Trash2 size={14} />
            <span>Delete Permanently</span>
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

// ======================== TOAST NOTIFICATION ========================
export function ToastNotification({
  message,
  isOpen,
  isVisible: isVisProp,
  onClose,
  type = "success",
}: {
  message?: string | null;
  isOpen?: boolean;
  isVisible?: boolean;
  onClose: () => void;
  type?: "success" | "danger" | "error" | "info" | string;
}) {
  const isVisible = isOpen !== undefined ? isOpen : isVisProp !== undefined ? isVisProp : !!message;
  if (!isVisible || !message) return null;

  const isDanger = type === "danger" || type === "error";
  // Professional brown palette: deep espresso surface, caramel accent stripe,
  // cream text. Errors keep a muted red so they still read as errors.
  const bg = isDanger
    ? "linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)"
    : "linear-gradient(135deg, #3b2416 0%, #4a2f1d 55%, #5a3a24 100%)";
  const accent = isDanger ? "#fca5a5" : "#d6a26a";
  const edge = isDanger ? "rgba(252, 165, 165, .4)" : "rgba(214, 162, 106, .45)";

  return (
    <ModalPortal>
    <div
      className="no-print exam-toast-pop"
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: "22px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 16px 12px 18px",
        borderRadius: "12px",
        background: bg,
        borderStyle: "solid",
        borderWidth: "1px 1px 1px 4px",
        borderColor: `${edge} ${edge} ${edge} ${accent}`,
        overflow: "hidden",
        color: "#f8eedb",
        fontSize: "14px",
        fontWeight: 650,
        letterSpacing: ".1px",
        maxWidth: "min(520px, calc(100vw - 28px))",
        boxSizing: "border-box",
        boxShadow: "0 14px 36px rgba(30, 18, 10, .45), 0 2px 6px rgba(30, 18, 10, .25)",
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: "26px",
          height: "26px",
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: isDanger ? "rgba(252, 165, 165, .18)" : "rgba(214, 162, 106, .2)",
          border: `1px solid ${edge}`,
          color: accent,
        }}
      >
        {isDanger ? <X size={14} /> : <CheckCircle2 size={15} />}
      </span>
      <span>{message}</span>
      <button
        type="button"
        onClick={onClose}
        style={{
          background: "transparent",
          border: "none",
          color: "rgba(248, 238, 219, 0.65)",
          cursor: "pointer",
          marginLeft: "4px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <X size={14} />
      </button>
    </div>
    </ModalPortal>
  );
}

// ======================== VERIFICATION POP-UP MODAL ========================
type VerificationStage = "HOD" | "DEAN" | "SCRUTINIZER" | "COE";

/** Real details of what was just verified (all optional). */
export interface VerificationDetails {
  stage?: VerificationStage;
  subject?: string;
  facultyName?: string;
  syllabusName?: string;
  verifierName?: string;
  forwardedTo?: string;
  /** Live count of this faculty's questions for the subject (adds / deletes included, returned ones excluded). */
  questionBankTotal?: number;
  /** Of those, how many reviewers added on the faculty's behalf. */
  questionBankAddedByReviewers?: number;
}

const VR_LEVELS = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];
const VR_LEVEL_COLORS = ["#64748b", "#0e7490", "#15803d", "#b45309", "#7e22ce", "#be123c"];

export function VerificationResultModal({
  isOpen,
  onClose,
  title = "Verification Complete",
  itemName,
  qualityScore,
  bloomLevel,
  verifiedCount = 1,
  remarks,
  details,
  questions,
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  itemName?: string;
  /** Shown only when a real AI score is available. */
  qualityScore?: number;
  bloomLevel?: string;
  verifiedCount?: number;
  remarks?: string;
  details?: VerificationDetails;
  /** The verified questions, used for the real Bloom's level distribution. */
  questions?: { bloomLevel?: string }[];
}) {
  if (!isOpen) return null;

  const cleanTitle = title.replace(/^[^\p{L}\p{N}]+/u, "").replace(/!+$/, "");
  const stage = details?.stage;
  const steps: { key: string; label: string }[] = [
    { key: "STAFF", label: "Staff upload" },
    { key: "HOD", label: "HOD verification" },
    { key: "DEAN", label: "Dean approval" },
    { key: "SCRUTINIZER", label: "Scrutiny" },
    { key: "COE", label: "COE final" },
  ];
  const doneUpTo = stage ? steps.findIndex((s) => s.key === stage) : -1;

  const levelCounts = VR_LEVELS.map((name) => (questions || []).filter((q) => (q.bloomLevel || "").toLowerCase() === name.toLowerCase()).length);
  const levelTotal = levelCounts.reduce((a, b) => a + b, 0);

  const rows: [string, string | undefined][] = [
    ["Subject", details?.subject],
    ["Faculty", details?.facultyName],
    ["Questions approved now", verifiedCount > 0 ? `${verifiedCount} question${verifiedCount === 1 ? "" : "s"}` : undefined],
    ["Question bank total", typeof details?.questionBankTotal === "number" ? `${details.questionBankTotal} question${details.questionBankTotal === 1 ? "" : "s"}${details.questionBankAddedByReviewers ? ` (incl. ${details.questionBankAddedByReviewers} added by reviewers)` : ""}` : undefined],
    ["Syllabus", details?.syllabusName],
    ["Verified by", details?.verifierName],
    ["Forwarded to", details?.forwardedTo],
    ["Date & time", new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })],
  ];
  const visibleRows = rows.filter(([, value]) => value);
  const hasDetails = Boolean(details);

  return (
    <ModalPortal>
    <div className="vr-overlay" onClick={onClose}>
      <div className="vr-card vr2-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="vr-title">
        <button type="button" onClick={onClose} className="vr-close" aria-label="Close">
          <X size={16} />
        </button>

        <div className="vr2-head">
          <div className="vr-icon-wrap vr2-icon-wrap" aria-hidden="true">
            <span className="vr-icon-ring" />
            <span className="vr-icon">
              <CheckCircle2 size={30} />
            </span>
          </div>
          <div className="vr2-head-text">
            <h3 id="vr-title" className="vr2-title">{cleanTitle}</h3>
            <p className="vr2-subtitle">{details?.subject || itemName || "The submission passed review."}</p>
          </div>
        </div>

        {/* Approval workflow */}
        {stage && (
          <ol className="vr2-steps" aria-label="Approval workflow">
            {steps.map((step, index) => {
              const state = index <= doneUpTo ? "done" : index === doneUpTo + 1 ? "next" : "todo";
              return (
                <li key={step.key} className={`vr2-step is-${state}`}>
                  <span className="vr2-step-dot">{state === "done" ? <Check size={12} /> : index + 1}</span>
                  <span className="vr2-step-label">{step.label}</span>
                  {state === "next" && <span className="vr2-step-tag">Next</span>}
                </li>
              );
            })}
          </ol>
        )}

        {/* Details */}
        <div className="vr2-panel">
          {(hasDetails ? visibleRows : visibleRows.filter(([label]) => label === "Questions approved now" || label === "Date & time")).map(([label, value]) => (
            <div key={label} className="vr2-row">
              <span className="vr2-row-label">{label}</span>
              <span className="vr2-row-value">{value}</span>
            </div>
          ))}
          {!hasDetails && itemName && (
            <div className="vr2-row">
              <span className="vr2-row-label">Item</span>
              <span className="vr2-row-value">{itemName}</span>
            </div>
          )}
          {typeof qualityScore === "number" && (
            <div className="vr2-row">
              <span className="vr2-row-label">AI quality check</span>
              <span className="vr2-row-value"><span className="vr2-pill">{qualityScore}%</span></span>
            </div>
          )}
          {levelTotal > 0 ? (
            <div className="vr2-bloom">
              <div className="vr2-row-label">Bloom&apos;s level distribution</div>
              <div className="vr2-bloom-bar">
                {levelCounts.map((count, i) => (count ? <span key={i} style={{ flex: count, background: VR_LEVEL_COLORS[i], animationDelay: `${200 + i * 90}ms` }} title={`L${i + 1} ${VR_LEVELS[i]}: ${count}`} /> : null))}
              </div>
              <div className="vr2-bloom-legend">
                {levelCounts.map((count, i) =>
                  count ? (
                    <span key={i}>
                      <i style={{ background: VR_LEVEL_COLORS[i] }} />L{i + 1} <b>{count}</b>
                    </span>
                  ) : null,
                )}
              </div>
            </div>
          ) : bloomLevel ? (
            <div className="vr2-row">
              <span className="vr2-row-label">Bloom&apos;s level</span>
              <span className="vr2-row-value">{bloomLevel}</span>
            </div>
          ) : null}
        </div>

        {remarks && <p className="vr2-remarks">{remarks}</p>}

        <button type="button" onClick={onClose} className="vr-ok vr2-ok">
          Done
        </button>
      </div>
    </div>
    </ModalPortal>
  );
}

export { CrudActionButtons } from "./CrudActionButtons";
export type { CrudActionButtonsProps } from "./CrudActionButtons";

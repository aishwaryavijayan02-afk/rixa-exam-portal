"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  BookOpen,
  FileText,
  CheckSquare,
  Upload,
  Search,
  BarChart2,
  Bell,
  Edit3,
  Settings,
  Briefcase,
  Printer,
  Shield,
  ArrowRight,
  School,
  Sparkles,
  Sliders,
  SlidersHorizontal,
  CheckCircle2,
  Layers,
  FileUp,
  Download,
  Eye,
  Building2,
  Archive,
  Users,
} from "lucide-react";
import { examStore, QuestionItem } from "../lib/examStore";
import { authStore, AuthUser, hasPermission } from "../lib/auth";
import RoleGuard from "../components/RoleGuard";
import PortalHeader from "../components/PortalHeader";
import PortalFooter from "../components/PortalFooter";
import { ToastNotification } from "../components/CrudModal";

const BLOOM_NAMES: Record<string, string> = {
  L1: "Remember",
  L2: "Understand",
  L3: "Apply",
  L4: "Analyze",
  L5: "Evaluate",
  L6: "Create",
};

const ROMAN_UNITS = ["I", "II", "III", "IV", "V", "VI"];

interface ParsedQuestion {
  text: string;
  options: string[];
  unit: string;
  co: string;
  level: string;
}

/**
 * Uploaded question banks store each row as one string, e.g.
 *   "26 IV CO4 L1 The derivative of xⁿ is: A) xⁿ⁻¹B) nxⁿ⁻¹C) n+xD) nxⁿ B"
 * Split it into the question text, its options, and the Unit / CO / Bloom
 * level so the paper prints cleanly. The trailing answer key is dropped.
 */
function parseQuestion(q: QuestionItem): ParsedQuestion {
  let text = (q.question || "").replace(/\s*\(Question\s*#\d+\)/gi, "").trim();
  let unit = "";
  let co = "";
  let level = "";

  text = text.replace(/^\d+[.)]?\s+/, "");
  const unitMatch = text.match(/^(VI|IV|V|III|II|I)\s+/);
  if (unitMatch) {
    unit = unitMatch[1];
    text = text.slice(unitMatch[0].length);
  }
  const coMatch = text.match(/^CO\s*(\d+)\s+/i);
  if (coMatch) {
    co = `CO${coMatch[1]}`;
    text = text.slice(coMatch[0].length);
  }
  const levelMatch = text.match(/^L\s*([1-6])\s+/i);
  if (levelMatch) {
    level = `L${levelMatch[1]}`;
    text = text.slice(levelMatch[0].length);
  }

  let options = (q.options || []).filter((opt) => (opt || "").trim());
  if (options.length === 0 && /\bA\)\s*\S/.test(text) && /B\)\s*\S/.test(text)) {
    const parts = text.split(/\s*\(?([A-D])\)\s*/);
    // parts = [stem, "A", optA, "B", optB, ...]
    if (parts.length >= 5) {
      text = parts[0].trim();
      options = [];
      for (let i = 1; i + 1 < parts.length; i += 2) options.push(parts[i + 1].trim());
      const last = options.length - 1;
      options[last] = options[last].replace(/\s+[A-D]$/, "").trim();
    }
  }

  if (!unit && q.unit) {
    const n = Number(String(q.unit).replace(/[^0-9]/g, ""));
    unit = n >= 1 && n <= 6 ? ROMAN_UNITS[n - 1] : String(q.unit).replace(/^unit\s*/i, "");
  }
  if (!level && q.bloomLevel) level = q.bloomLevel;

  return { text, options, unit, co, level };
}

export default function PrintPaperPage() {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState("print-paper");
  const [currentUser, setCurrentUser] = useState<AuthUser>(() => authStore.getCurrentUser());

  useEffect(() => {
    const handleAuth = () => setCurrentUser(authStore.getCurrentUser());
    handleAuth();
    window.addEventListener("exam-cell-auth-update", handleAuth);
    return () => window.removeEventListener("exam-cell-auth-update", handleAuth);
  }, []);

  const rawMenuItems = [
    { id: "dashboard", label: "Dashboard", icon: Home, route: "/dashboard" },
    { id: "school", label: "School", icon: School, route: "/subjects" },
    { id: "staff-work-status", label: "Staff Work Status", icon: Briefcase, route: "/staff-work-status" },
    { id: "academic-vault", label: "Academic Vault", icon: Archive, route: "/academic-vault" },
    { id: "verify-approval", label: "Verify & Approval", icon: CheckSquare, route: "/approval" },
    { id: "reports", label: "Reports", icon: BarChart2, route: "/reports" },
    { id: "manual-questions", label: "Manual Questions", icon: Edit3, badge: "New", route: "/manual-questions" },
    { id: "notifications", label: "Notifications", icon: Bell, route: "/notifications" },
    { id: "print-paper", label: "Print Question Paper", icon: Printer, badge: "Print", route: "/print-paper" },
    { id: "settings", label: "Settings", icon: Settings, hasArrow: true, route: "/settings" },
  ];

  const menuItems = rawMenuItems.filter((item) =>
    hasPermission(currentUser.role, item.route, currentUser.isSubjectFaculty)
  );

  // Store Questions
  const [allQuestions, setAllQuestions] = useState<QuestionItem[]>(() => examStore.getQuestions());
  const [approvedOnly, setApprovedOnly] = useState(false);

  useEffect(() => {
    const loadQs = () => setAllQuestions(examStore.getQuestions());
    loadQs();
    window.addEventListener("exam-cell-store-update", loadQs);
    return () => window.removeEventListener("exam-cell-store-update", loadQs);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subject = params.get("subject");
    const onlyApproved = params.get("approvedOnly") === "true";
    if (subject) setSelectedSubject(subject);
    if (onlyApproved) {
      setApprovedOnly(true);
      setPrintMode("all");
    }
  }, []);

  const STORAGE_KEY = "exam_cell_print_paper_config";

  const getSavedConfig = () => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  };

  const initialConfig = typeof window !== "undefined" ? getSavedConfig() : null;

  // Form Controls
  const rawSubjects = Array.from(new Set(allQuestions.map((q) => (q.subject || "ENGINEERING GRAPHICS").trim())));
  const subjectsList = ["All Subjects (Complete Question Bank)", ...rawSubjects];
  const [selectedSubject, setSelectedSubject] = useState<string>(() => initialConfig?.selectedSubject || "ENGINEERING GRAPHICS");
  const [printMode, setPrintMode] = useState<"all" | "custom">(() => initialConfig?.printMode || "custom");
  const [examType, setExamType] = useState<string>(() => initialConfig?.examType || "End Semester Examination (Regular)");
  const [maxMarks, setMaxMarks] = useState<number>(() => initialConfig?.maxMarks ?? 100);
  const [duration, setDuration] = useState<string>(() => initialConfig?.duration || "3 Hours");
  const [semesterYear, setSemesterYear] = useState<string>(() => initialConfig?.semesterYear || "IV Semester / Academic Year 2024-2025");

  // Quantity Sliders / Inputs (Custom mode)
  const [mcqCount, setMcqCount] = useState<number>(() => initialConfig?.mcqCount ?? 0);
  const [descriptiveCount, setDescriptiveCount] = useState<number>(() => initialConfig?.descriptiveCount ?? 0);
  const [diagramCount, setDiagramCount] = useState<number>(() => initialConfig?.diagramCount ?? 0);

  // Sync to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            selectedSubject,
            printMode,
            examType,
            maxMarks,
            duration,
            semesterYear,
            mcqCount,
            descriptiveCount,
            diagramCount,
          })
        );
      } catch (e) {}
    }
  }, [selectedSubject, printMode, examType, maxMarks, duration, semesterYear, mcqCount, descriptiveCount, diagramCount]);

  const [toast, setToast] = useState<{ message: string; isVisible: boolean; type?: "success" | "danger" }>({
    message: "",
    isVisible: false,
  });

  const showToast = (message: string, type: "success" | "danger" = "success") => {
    setToast({ message, isVisible: true, type });
    setTimeout(() => setToast((prev) => ({ ...prev, isVisible: false })), 3000);
  };


  // Filter Questions based on subject selection
  const subjectQs = allQuestions.filter((q) => {
    if (approvedOnly && !(q.status === "Approved" && (q.verifiedRole || "").toUpperCase() === "COE")) return false;
    if (!selectedSubject || selectedSubject.startsWith("All Subjects")) return true;
    const qSubj = (q.subject || "").trim().toLowerCase();
    const target = selectedSubject.trim().toLowerCase();
    return qSubj.includes(target) || target.includes(qSubj);
  });

  // Categorize questions
  let finalMcqs: QuestionItem[] = [];
  let finalDescriptives: QuestionItem[] = [];
  let finalDiagrams: QuestionItem[] = [];
  let finalOthers: QuestionItem[] = [];

  if (printMode === "all") {
    finalMcqs = subjectQs.filter((q) => q.type === "MCQ" || q.type === "Short Answer" || (q.options && q.options.length > 0));
    finalDescriptives = subjectQs.filter((q) => q.type === "Descriptive" && !q.imageUrl && !(q as any).raw?.imageUrl);
    finalDiagrams = subjectQs.filter((q) => q.imageUrl || (q as any).raw?.imageUrl || q.type === "Problem Solving");
    
    // Any question not in the 3 pools
    const usedIds = new Set([...finalMcqs, ...finalDescriptives, ...finalDiagrams].map((q) => q.id));
    finalOthers = subjectQs.filter((q) => !usedIds.has(q.id));
  } else {
    const mcqPool = subjectQs.filter((q) => q.type === "MCQ" || q.type === "Short Answer" || (q.options && q.options.length > 0));
    const descPool = subjectQs.filter((q) => q.type === "Descriptive" && !q.imageUrl && !(q as any).raw?.imageUrl);
    const diagPool = subjectQs.filter((q) => q.imageUrl || (q as any).raw?.imageUrl || q.type === "Problem Solving");

    finalMcqs = mcqPool.length > 0 ? mcqPool.slice(0, mcqCount) : subjectQs.slice(0, mcqCount);
    finalDescriptives = descPool.length > 0 ? descPool.slice(0, descriptiveCount) : subjectQs.slice(mcqCount, mcqCount + descriptiveCount);
    finalDiagrams = diagPool.length > 0 ? diagPool.slice(0, diagramCount) : subjectQs.slice(mcqCount + descriptiveCount, mcqCount + descriptiveCount + diagramCount);
    finalOthers = [];
  }

  const totalQuestionsInPaper = finalMcqs.length + finalDescriptives.length + finalDiagrams.length + finalOthers.length;

  // Print Action
  const handleTriggerPrint = () => {
    window.print();
  };

  return (
    <RoleGuard route="/print-paper">
      <div
        style={{
          display: "flex",
          height: "100vh",
          maxHeight: "100vh",
          background: "#f4f6fb",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          color: "#0f172a",
          width: "100%",
          maxWidth: "100vw",
          overflow: "hidden",
        }}
      >
        <style>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 12mm 12mm 12mm 12mm;
            }

            html, body {
              background: #ffffff !important;
              margin: 0 !important;
              padding: 0 !important;
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            /* Print only the question paper: hide every element that is not
               the paper, inside the paper, or a wrapper around it (sidebar,
               settings panel, footer, toasts, dev overlays). Nothing hidden
               keeps its height, so no blank pages are produced. */
            body *:not(#official-printable-paper):not(#official-printable-paper *):not(:has(#official-printable-paper)),
            #official-printable-paper .no-print {
              display: none !important;
            }

            /* Wrappers around the paper: plain block flow, no fixed heights or
               scroll containers that would clip or pad the printout. */
            body *:has(#official-printable-paper) {
              display: block !important;
              position: static !important;
              width: auto !important;
              max-width: none !important;
              height: auto !important;
              min-height: 0 !important;
              max-height: none !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
              border: none !important;
              box-shadow: none !important;
              background: transparent !important;
            }

            /* The paper keeps its own layout (flex/grid rows, rules); only the
               screen card styling is removed. */
            #official-printable-paper {
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              overflow: visible !important;
              background: #ffffff !important;
              color: #000000 !important;
            }

            #official-printable-paper > :last-child {
              margin-bottom: 0 !important;
              padding-bottom: 0 !important;
            }

            .paper-meta-row {
              break-after: avoid !important;
              page-break-after: avoid !important;
            }

            /* Spacing between questions comes from the list's flex gap only. */
            .question-block {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              margin-bottom: 0 !important;
            }

            .part-header {
              page-break-after: avoid !important;
              break-after: avoid !important;
              margin-top: 14px !important;
              margin-bottom: 10px !important;
            }

            .end-paper-footer {
              page-break-before: avoid !important;
              break-before: avoid !important;
              margin-top: 20px !important;
            }
          }
        `}</style>

        {/* Sidebar */}
        <aside className="no-print digital-vfx-sidebar"
          style={{
            width: "260px",
            background: "linear-gradient(180deg, #1c120c 0%, #120c08 100%)",
            color: "#94a3b8",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            borderRight: "1px solid rgba(255, 255, 255, 0.06)",
            padding: "20px 14px",
            justifyContent: "space-between",
            height: "100vh",
            overflowY: "auto",
          }}
        >
          <div>
            <div style={{ padding: "6px 10px 24px 10px" }}>
              <div className="brand-orbit-logo" aria-label="Rathinam Global (Deemed to be University)"><span className="brand-orbit-mark">RG</span><span className="brand-orbit-name">Rathinam Global</span></div>
            </div>

            <nav style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {menuItems.map((item) => {
                const IconComp = item.icon;
                const isActive = activeMenu === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveMenu(item.id);
                      if (item.route) router.push(item.route);
                    }}
                    data-route={item.route} className={`sidebar-btn-3d ${isActive ? "sidebar-btn-active" : "sidebar-btn-inactive"}`}
                  >
                    <IconComp
                      size={18}
                      style={{
                        filter: isActive ? "drop-shadow(0 0 6px rgba(255,255,255,0.8))" : "none",
                        transition: "filter 0.2s ease",
                      }}
                    />
                    <span style={{ flex: 1, letterSpacing: "0.2px" }}>{item.label}</span>
                    {item.badge && <span className="badge-neon-3d">{item.badge}</span>}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="support-card-3d">
            <div className="shield-icon-3d">
              <Shield size={19} style={{ filter: "drop-shadow(0 0 6px rgba(214, 170, 132, 0.8))" }} />
            </div>
            <strong style={{ display: "block", color: "#ffffff", fontSize: "13.5px", marginBottom: "4px", fontWeight: 700 }}>
              Official COE Exam Cell
            </strong>
            <p style={{ fontSize: "11.5px", color: "#94a3b8", lineHeight: 1.4, margin: "0 0 14px 0" }}>
              Generates Word paper specification prints for all COE departments.
            </p>
          </div>
        </aside>

        {/* Main Workspace */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
          <div className="no-print">
            <PortalHeader activeRoute="print-paper" />
          </div>

          <main style={{ flex: 1, padding: "24px 28px", overflowY: "auto", overflowX: "hidden", width: "100%", boxSizing: "border-box" }}>
            {/* Header Title */}
            <div className="no-print qp-hero">
              <div className="qp-hero-text">
                <div className="qp-eyebrow">COE · Examination Output</div>
                <h1 className="qp-title">Question Paper Generator</h1>
                <p className="qp-subtitle">
                  {approvedOnly ? "Final COE-approved questions for this subject are ready to print." : "Choose the subject, format and question counts, then print the official paper."}
                </p>
              </div>

              <div className="qp-hero-side">
                <div className="qp-stat">
                  <span className="qp-stat-value">{totalQuestionsInPaper}</span>
                  <span className="qp-stat-label">Questions</span>
                </div>
                <div className="qp-stat">
                  <span className="qp-stat-value">{maxMarks}</span>
                  <span className="qp-stat-label">Max Marks</span>
                </div>
                <div className="qp-stat">
                  <span className="qp-stat-value">{duration.replace(" Hours", "h")}</span>
                  <span className="qp-stat-label">Duration</span>
                </div>
                <button type="button" onClick={handleTriggerPrint} className="qp-btn-primary">
                  <Printer size={16} />
                  <span>Print Paper (PDF)</span>
                </button>
              </div>
            </div>

            {/* Grid Layout: Configurator Controls (Left) & Live Paper Preview (Right) */}
            <div className="print-layout-container qp-layout">
              {/* Left Configurator Column */}
              <div className="no-print qp-panel">
                <div className="qp-panel-head">
                  <span className="qp-panel-icon"><SlidersHorizontal size={16} /></span>
                  <div>
                    <div className="qp-panel-title">Paper Builder</div>
                    <div className="qp-panel-sub">Settings update the preview instantly</div>
                  </div>
                </div>

                <div className="qp-section-label">Paper details</div>

                <label className="qp-field">
                  <span className="qp-label">Subject</span>
                  <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="qp-select qp-select-strong">
                    {subjectsList.map((subj) => (
                      <option key={subj} value={subj}>{subj}</option>
                    ))}
                  </select>
                </label>

                <label className="qp-field">
                  <span className="qp-label">Examination type</span>
                  <select value={examType} onChange={(e) => setExamType(e.target.value)} className="qp-select">
                    <option value="Odd Semester Examination">Odd Semester Examination</option>
                    <option value="End Semester Examination (Regular)">End Semester Examination (Regular)</option>
                    <option value="Mid-Term Internal Assessment">Mid-Term Internal Assessment</option>
                    <option value="Continuous Assessment Test (CAT-I)">Continuous Assessment Test (CAT-I)</option>
                    <option value="Model Examination Paper">Model Examination Paper</option>
                  </select>
                </label>

                <div className="qp-field-row">
                  <label className="qp-field">
                    <span className="qp-label">Max marks</span>
                    <select value={maxMarks} onChange={(e) => setMaxMarks(Number(e.target.value))} className="qp-select">
                      <option value={100}>100 Marks</option>
                      <option value={75}>75 Marks</option>
                      <option value={50}>50 Marks</option>
                    </select>
                  </label>
                  <label className="qp-field">
                    <span className="qp-label">Duration</span>
                    <select value={duration} onChange={(e) => setDuration(e.target.value)} className="qp-select">
                      <option value="3 Hours">3 Hours</option>
                      <option value="2 Hours">2 Hours</option>
                      <option value="1.5 Hours">1.5 Hours</option>
                    </select>
                  </label>
                </div>

                <div className="qp-section-label">Question selection</div>

                <div className="qp-mode-group" role="radiogroup">
                  <label className={`qp-mode ${printMode === "all" ? "is-active" : ""}`}>
                    <input type="radio" name="printMode" checked={printMode === "all"} onChange={() => setPrintMode("all")} />
                    <div>
                      <div className="qp-mode-title">All questions <span className="qp-pill">{subjectQs.length}</span></div>
                      <div className="qp-mode-sub">Every question uploaded for this subject</div>
                    </div>
                  </label>
                  <label className={`qp-mode ${printMode === "custom" ? "is-active" : ""}`}>
                    <input type="radio" name="printMode" checked={printMode === "custom"} onChange={() => setPrintMode("custom")} />
                    <div>
                      <div className="qp-mode-title">Custom count</div>
                      <div className="qp-mode-sub">Choose how many of each question type</div>
                    </div>
                  </label>
                </div>

                {printMode === "custom" && (
                  <div className="qp-counts">
                    {[
                      { label: "Multiple choice", hint: "Part A", value: mcqCount, set: setMcqCount, max: Math.max(50, subjectQs.length) },
                      { label: "Descriptive", hint: "Part B", value: descriptiveCount, set: setDescriptiveCount, max: Math.max(50, subjectQs.length) },
                      { label: "Diagram / problem", hint: "Part C", value: diagramCount, set: setDiagramCount, max: Math.max(30, subjectQs.length) },
                    ].map((row) => (
                      <div key={row.label} className="qp-count-row">
                        <div className="qp-count-top">
                          <div>
                            <div className="qp-count-label">{row.label}</div>
                            <div className="qp-count-hint">{row.hint}</div>
                          </div>
                          <div className="qp-stepper">
                            <button type="button" aria-label={`Decrease ${row.label}`} onClick={() => row.set((v) => Math.max(0, v - 1))}>−</button>
                            <span>{row.value}</span>
                            <button type="button" aria-label={`Increase ${row.label}`} onClick={() => row.set((v) => v + 1)}>+</button>
                          </div>
                        </div>
                        <input type="range" min={0} max={row.max} value={row.value} onChange={(e) => row.set(Number(e.target.value))} className="qp-range" />
                      </div>
                    ))}
                  </div>
                )}

                <div className="qp-summary">
                  <div>
                    <div className="qp-summary-value">{totalQuestionsInPaper} questions</div>
                    <div className="qp-summary-sub">selected for {selectedSubject}</div>
                  </div>
                  {printMode === "custom" && (
                    <button
                      type="button"
                      className="qp-btn-ghost"
                      onClick={() => {
                        setMcqCount(0);
                        setDescriptiveCount(0);
                        setDiagramCount(0);
                      }}
                    >
                      Reset
                    </button>
                  )}
                </div>

                <button type="button" onClick={handleTriggerPrint} className="qp-btn-primary qp-btn-block">
                  <Printer size={16} />
                  <span>Print Official Paper</span>
                </button>
              </div>

              {/* Right: live paper preview */}
              <div className="qp-stage">
                <div className="no-print qp-stage-bar">
                  <span className="qp-live-dot" /> Live preview
                  <span className="qp-stage-meta">A4 · Portrait</span>
                </div>

                <div id="official-printable-paper" className="qp-paper">
                  <div className="qp-paper-top">
                    <div>QP Code: <strong>252S099</strong></div>
                    <div className="qp-regno">
                      <span>Reg. No.</span>
                      {Array.from({ length: 10 }).map((_, i) => <i key={i} />)}
                    </div>
                  </div>

                  <div className="qp-paper-head">
                    <div className="qp-uni">RATHINAM GLOBAL (DEEMED TO BE UNIVERSITY)</div>
                    <div className="qp-uni-sub">Eachanari, Coimbatore – 641021 · Approved by UGC &amp; AICTE</div>
                    <div className="qp-exam">{examType}</div>
                    <div className="qp-sem">{semesterYear}</div>
                  </div>

                  <div className="paper-meta-row qp-meta">
                    <div><span>Subject</span><strong>{selectedSubject}</strong></div>
                    <div><span>Time</span><strong>{duration}</strong></div>
                    <div><span>Maximum Marks</span><strong>{maxMarks}</strong></div>
                  </div>

                  <div className="qp-instructions">
                    <strong>Instructions:</strong> Answer all questions. Figures to the right indicate full marks. CO – Course Outcome, BL – Bloom&apos;s Level.
                  </div>

                  {[
                    { key: "A", title: "Multiple Choice & Short Answer", items: finalMcqs, start: 0, marks: () => 2 },
                    { key: "B", title: "Descriptive & Analytical", items: finalDescriptives, start: finalMcqs.length, marks: () => 5 },
                    { key: "C", title: "Problem Solving & Diagram Based", items: finalDiagrams, start: finalMcqs.length + finalDescriptives.length, marks: (q: QuestionItem) => q.marks || 10 },
                    { key: "D", title: "Additional Questions", items: finalOthers, start: finalMcqs.length + finalDescriptives.length + finalDiagrams.length, marks: (q: QuestionItem) => q.marks || 5 },
                  ]
                    .filter((part) => part.items.length > 0)
                    .map((part) => {
                      const partTotal = part.items.reduce((sum, q) => sum + Number(part.marks(q)), 0);
                      const uniform = part.items.every((q) => part.marks(q) === part.marks(part.items[0]));
                      return (
                        <section key={part.key} className="qp-part">
                          <div className="part-header qp-part-head">
                            <div className="qp-part-title">PART – {part.key}</div>
                            <div className="qp-part-sub">{part.title}</div>
                            <div className="qp-part-marks">
                              {uniform ? `(${part.items.length} × ${part.marks(part.items[0])} = ${partTotal} Marks)` : `(${partTotal} Marks)`}
                            </div>
                          </div>

                          <div className="qp-qhead">
                            <span>Q.No</span>
                            <span>Question</span>
                            <span>CO</span>
                            <span>BL</span>
                            <span>Marks</span>
                          </div>

                          {part.items.map((q, idx) => {
                            const p = parseQuestion(q);
                            const number = part.start + idx + 1;
                            const image = q.imageUrl || (q as { raw?: { imageUrl?: string } }).raw?.imageUrl;
                            return (
                              <div key={q.id || `${part.key}-${idx}`} className="question-block qp-q">
                                <span className="qp-qno">{number}.</span>
                                <div className="qp-qbody">
                                  <div className="qp-qtext">{p.text}</div>
                                  {p.options.length > 0 && (
                                    <div className="qp-options">
                                      {p.options.map((opt, optIdx) => (
                                        <div key={optIdx}>
                                          <b>({String.fromCharCode(97 + optIdx)})</b> {opt}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {image && (
                                    <figure className="qp-figure">
                                      <img src={image} alt={`Figure for question ${number}`} />
                                      <figcaption>Fig. {number}: {q.diagramTitle || "Diagram"}</figcaption>
                                    </figure>
                                  )}
                                  {p.unit && <div className="qp-unit">Unit {p.unit}</div>}
                                </div>
                                <span className="qp-cell">{p.co || "–"}</span>
                                <span className="qp-cell" title={BLOOM_NAMES[p.level] || ""}>{p.level || "–"}</span>
                                <span className="qp-cell qp-mark">{part.marks(q)}</span>
                              </div>
                            );
                          })}
                        </section>
                      );
                    })}

                  {totalQuestionsInPaper === 0 && (
                    <div className="no-print qp-empty">
                      No questions selected yet. Choose “All questions” or increase the counts in the Paper Builder.
                    </div>
                  )}

                  <div className="end-paper-footer qp-end">*** End of Question Paper ***</div>
                </div>
              </div>
            </div>
          </main>

          <div className="no-print">
            <PortalFooter />
          </div>
        </div>

        <ToastNotification
          message={toast.message}
          type={toast.type || "success"}
          isVisible={toast.isVisible}
          onClose={() => setToast((prev) => ({ ...prev, isVisible: false }))}
        />
      </div>
    </RoleGuard>
  );
}

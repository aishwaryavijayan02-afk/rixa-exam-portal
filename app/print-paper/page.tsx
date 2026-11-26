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
import { examStore, QuestionItem, INSTITUTIONAL_SUBJECTS } from "../lib/examStore";
import { sortForPrint } from "../lib/questionCheck";
import NavIcon from "../components/NavIcon";
import { authStore, AuthUser, hasPermission } from "../lib/auth";
import { menuForUser } from "../lib/auth";
import { SCRUTINY_MENU_ITEMS } from "../lib/scrutinyMenu";
import RoleGuard from "../components/RoleGuard";
import PortalHeader from "../components/PortalHeader";
import PortalFooter from "../components/PortalFooter";
import { ToastNotification } from "../components/CrudModal";
import ModalPortal from "../components/ModalPortal";
import QuestionPaperFormat, { FormatThumbnail, PAPER_FORMATS, type PaperFormat, type PaperRow, type PaperSection } from "../components/QuestionPaperFormats";

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

    ...SCRUTINY_MENU_ITEMS,
    { id: "school", label: "School", icon: School, route: "/subjects" },
    { id: "staff-work-status", label: "Staff Work Status", icon: Briefcase, route: "/staff-work-status" },
    { id: "academic-vault", label: "Academic Vault", icon: Archive, route: "/academic-vault" },
    { id: "verify-approval", label: "Verify & Approval", icon: CheckSquare, route: "/approval" },
    { id: "reports", label: "Reports", icon: BarChart2, route: "/reports" },
    { id: "manual-questions", label: "Manual Questions", icon: Edit3, badge: "New", route: "/manual-questions" },
    { id: "print-paper", label: "Print Question Paper", icon: Printer, badge: "Print", route: "/print-paper" },
    { id: "notifications", label: "Notifications", icon: Bell, route: "/notifications" },
    { id: "settings", label: "Settings", icon: Settings, hasArrow: true, route: "/settings" },
  ];

  const menuItems = menuForUser(rawMenuItems, currentUser);

  // Store Questions
  const [allQuestions, setAllQuestions] = useState<QuestionItem[]>(() => examStore.getQuestions());
  // Only questions with COE final approval can ever be printed.
  const isFinalApproved = (q: QuestionItem) => q.status === "Approved" && (q.verifiedRole || "").toUpperCase() === "COE";
  const printableQuestions = allQuestions.filter(isFinalApproved);

  useEffect(() => {
    const loadQs = () => setAllQuestions(examStore.getQuestions());
    loadQs();
    window.addEventListener("exam-cell-store-update", loadQs);
    return () => window.removeEventListener("exam-cell-store-update", loadQs);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subject = params.get("subject");
    if (subject) setSelectedSubject(subject);
    if (params.get("approvedOnly") === "true") setPrintMode("all");
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
  const rawSubjects = Array.from(new Set(printableQuestions.map((q) => (q.subject || "ENGINEERING GRAPHICS").trim())));
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

  // Official paper header + layout (Format 1 table / Format 2 plain)
  const defaultSession = () => `${new Date().toLocaleString("en-US", { month: "long" }).toUpperCase()} - ${new Date().getFullYear()}`;
  const [paperFormat, setPaperFormat] = useState<PaperFormat>(() => (initialConfig?.paperFormat === "plain" ? "plain" : "table"));
  const [degree, setDegree] = useState<string>(() => initialConfig?.degree || "");
  const [subjectCode, setSubjectCode] = useState<string>(() => initialConfig?.subjectCode || "");
  const [semesterNo, setSemesterNo] = useState<string>(() => initialConfig?.semesterNo || "III");
  const [examSession, setExamSession] = useState<string>(() => initialConfig?.examSession || defaultSession());
  const [qpCode, setQpCode] = useState<string>(() => initialConfig?.qpCode || "");
  const [isFormatChooserOpen, setIsFormatChooserOpen] = useState(false);

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
            paperFormat,
            degree,
            subjectCode,
            semesterNo,
            examSession,
            qpCode,
          })
        );
      } catch (e) {}
    }
  }, [selectedSubject, printMode, examType, maxMarks, duration, semesterYear, mcqCount, descriptiveCount, diagramCount, paperFormat, degree, subjectCode, semesterNo, examSession, qpCode]);

  const [toast, setToast] = useState<{ message: string; isVisible: boolean; type?: "success" | "danger" }>({
    message: "",
    isVisible: false,
  });

  const showToast = (message: string, type: "success" | "danger" = "success") => {
    setToast({ message, isVisible: true, type });
    setTimeout(() => setToast((prev) => ({ ...prev, isVisible: false })), 3000);
  };


  // Filter Questions based on subject selection
  const inSelectedSubject = (q: QuestionItem) => {
    if (!selectedSubject || selectedSubject.startsWith("All Subjects")) return true;
    const qSubj = (q.subject || "").trim().toLowerCase();
    const target = selectedSubject.trim().toLowerCase();
    return qSubj.includes(target) || target.includes(qSubj);
  };
  const subjectQs = printableQuestions.filter(inSelectedSubject);
  // Shown so the COE knows why some uploaded questions are not on the paper.
  const awaitingFinalApproval = allQuestions.filter((q) => !isFinalApproved(q) && !q.correctionRequested && !["Rejected", "Archived"].includes(q.status) && inSelectedSubject(q)).length;

  // Categorize questions
  let finalMcqs: QuestionItem[] = [];
  let finalDescriptives: QuestionItem[] = [];
  let finalDiagrams: QuestionItem[] = [];
  let finalOthers: QuestionItem[] = [];

  // Content check: each question goes only to its own part (MCQ -> A,
  // Descriptive -> B, Diagram -> C). No filling one part with another type.
  const { pools: printPools, rejected: failedCheck } = sortForPrint(subjectQs);
  const mcqPool = printPools.MCQ;
  const descPool = printPools.Descriptive;
  const diagPool = printPools.Diagram;
  if (printMode === "all") {
    finalMcqs = mcqPool;
    finalDescriptives = descPool;
    finalDiagrams = diagPool;
  } else {
    finalMcqs = mcqPool.slice(0, mcqCount);
    finalDescriptives = descPool.slice(0, descriptiveCount);
    finalDiagrams = diagPool.slice(0, diagramCount);
  }
  finalOthers = [];
  // Parts that cannot be printed because the question bank has no such questions.
  const missingParts = [
    { part: "Part A", kind: "MCQ", count: mcqPool.length },
    { part: "Part B", kind: "descriptive", count: descPool.length },
    { part: "Part C", kind: "diagram", count: diagPool.length },
  ].filter((p) => p.count === 0);

  // ---- Official paper (Format 1 / Format 2) ----
  const KNOWLEDGE = ["remember", "understand", "apply", "analyze", "evaluate", "create"];
  const knowledgeLevel = (level: string) => {
    const l = /^L\s*([1-6])$/i.exec(level || "")?.[1];
    if (l) return `K${l}`;
    const i = KNOWLEDGE.indexOf((level || "").trim().toLowerCase().replace("analyse", "analyze"));
    return i >= 0 ? `K${i + 1}` : "–";
  };
  const courseOutcome = (q: QuestionItem, p: { co: string; unit: string }) => {
    if (p.co) return p.co;
    const roman = ROMAN_UNITS.indexOf(p.unit) + 1;
    const n = roman || Number(String(q.unit || "").replace(/[^0-9]/g, ""));
    return n >= 1 && n <= 6 ? `CO${n}` : "–";
  };
  const lookupSubjectCode = () => {
    const key = selectedSubject.trim().toLowerCase();
    return (
      examStore.getSubjects().find((s) => s.name.trim().toLowerCase() === key)?.code ||
      INSTITUTIONAL_SUBJECTS.find((s) => s.name.trim().toLowerCase() === key)?.code ||
      ""
    );
  };
  const examTitleBase = examType.replace(/\s*\(.*\)\s*/, "").trim().toUpperCase();
  const paperHeader = {
    qpCode,
    examTitle: `${/EXAMINATION$/.test(examTitleBase) ? `${examTitleBase}S` : examTitleBase}${examSession ? `, ${examSession.toUpperCase()}` : ""}`,
    semester: semesterNo,
    degree,
    subject: selectedSubject.startsWith("All Subjects") ? "" : selectedSubject,
    subjectCode: subjectCode || lookupSubjectCode(),
    duration,
    maxMarks,
  };
  const paperSections: PaperSection[] = (() => {
    let counter = 0;
    const letters = "ABCDEF";
    const toRow = (q: QuestionItem, no: string): PaperRow => {
      const p = parseQuestion(q);
      const image = q.imageUrl || (q as { raw?: { imageUrl?: string } }).raw?.imageUrl;
      return { kind: "q", key: `${q.id}-${no}`, no, text: p.text, options: p.options, image, caption: image ? q.diagramTitle || "Diagram" : undefined, co: courseOutcome(q, p), k: knowledgeLevel(p.level) };
    };
    return [
      { items: finalMcqs, paired: false },
      { items: finalDescriptives, paired: true },
      { items: finalDiagrams, paired: true },
    ]
      .filter((g) => g.items.length > 0)
      .map((g, index) => {
        const rows: PaperRow[] = [];
        let answerCount = 0;
        if (!g.paired) {
          g.items.forEach((q) => rows.push(toRow(q, `${++counter}.`)));
          answerCount = g.items.length;
        } else {
          // Either / or: 1.A (OR) 1.B
          for (let i = 0; i < g.items.length; i += 2) {
            counter += 1;
            const pair = g.items.slice(i, i + 2);
            rows.push(toRow(pair[0], pair.length > 1 ? `${counter}.A` : `${counter}.`));
            if (pair[1]) {
              rows.push({ kind: "or", key: `or-${counter}-${index}` });
              rows.push(toRow(pair[1], `${counter}.B`));
            }
            answerCount += 1;
          }
        }
        const marksEach = Number(g.items[0].marks) || (g.paired ? 10 : 1);
        const letter = letters[index];
        return { letter, heading: `SECTION ${letter} - (${answerCount} x ${marksEach} = ${answerCount * marksEach})`, rows };
      });
  })();

  // Never keep a saved count above what the question bank has (e.g. 3
  // diagram questions for a subject with none).
  useEffect(() => {
    if (mcqCount > mcqPool.length) setMcqCount(mcqPool.length);
    if (descriptiveCount > descPool.length) setDescriptiveCount(descPool.length);
    if (diagramCount > diagPool.length) setDiagramCount(diagPool.length);
  }, [mcqPool.length, descPool.length, diagPool.length, mcqCount, descriptiveCount, diagramCount]);

  const totalQuestionsInPaper = finalMcqs.length + finalDescriptives.length + finalDiagrams.length + finalOthers.length;

  // Print Action
  const handleTriggerPrint = () => {
    if (totalQuestionsInPaper === 0) {
      showToast(printableQuestions.length === 0 ? "No questions have COE final approval yet. Give final approval before printing." : "No COE final-approved questions are selected for this paper.", "danger");
      return;
    }
    // Ask which official format to print in.
    setIsFormatChooserOpen(true);
  };

  const printInFormat = (format: PaperFormat) => {
    setPaperFormat(format);
    setIsFormatChooserOpen(false);
    // Let the preview re-render in the chosen format before the print dialog opens.
    window.setTimeout(() => window.print(), 350);
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
          .qp-page-border { display: none; }

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
            @page {
              @bottom-center { content: "- " counter(page) " -"; font-family: "Times New Roman", serif; font-size: 10pt; }
            }
            .qp-page-border {
              display: block !important;
              position: fixed !important;
              inset: 0 !important;
              border: 1.5px dotted #000 !important;
              pointer-events: none;
            }
            body *:has(#official-printable-paper) {
              transform: none !important;
              filter: none !important;
              perspective: none !important;
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
              padding: 5mm 6mm !important;
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
                    <span className="nav-icon-3d" style={{ display: "flex", alignItems: "center" }}>
                      <NavIcon route={item.route} fallback={IconComp} />
                    </span>
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
                  Only questions with COE final approval are printed. Choose the subject, format and question counts, then print the official paper.
                </p>
                {failedCheck.length > 0 && (
                  <div className="no-print" title={failedCheck.slice(0, 12).map((f) => `• ${(f.question.question || "").slice(0, 70)} — ${f.reason}`).join(" | ")} style={{ marginTop: "10px", marginRight: "8px", display: "inline-block", padding: "8px 12px", borderRadius: "10px", background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: "12.5px", fontWeight: 600, lineHeight: 1.5 }}>
                    {failedCheck.length} approved question{failedCheck.length === 1 ? "" : "s"} failed the question check ({Array.from(new Set(failedCheck.map((f) => f.reason))).join("; ")}) and {failedCheck.length === 1 ? "is" : "are"} not printed.
                  </div>
                )}
                {awaitingFinalApproval > 0 && (
                  <div className="no-print" style={{ marginTop: "10px", display: "inline-block", padding: "8px 12px", borderRadius: "10px", background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: "12.5px", fontWeight: 600, lineHeight: 1.5 }}>
                    {awaitingFinalApproval} question{awaitingFinalApproval === 1 ? " is" : "s are"} still awaiting COE final approval and {awaitingFinalApproval === 1 ? "is" : "are"} not included in this paper.
                  </div>
                )}
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
                <button type="button" onClick={handleTriggerPrint} className="qp-btn-primary" disabled={totalQuestionsInPaper === 0} style={totalQuestionsInPaper === 0 ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
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

                <div className="qp-section-label">Paper format</div>
                <div className="qp-mode-group" role="radiogroup" aria-label="Paper format">
                  {PAPER_FORMATS.map((fmt) => (
                    <label key={fmt.id} className={`qp-mode ${paperFormat === fmt.id ? "is-active" : ""}`}>
                      <input type="radio" name="paperFormat" checked={paperFormat === fmt.id} onChange={() => setPaperFormat(fmt.id)} />
                      <div>
                        <div className="qp-mode-title">{fmt.name}</div>
                        <div className="qp-mode-sub">{fmt.description}</div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="qp-field-row">
                  <label className="qp-field">
                    <span className="qp-label">Exam month &amp; year</span>
                    <input className="qp-select" value={examSession} onChange={(e) => setExamSession(e.target.value)} placeholder="NOVEMBER - 2026" />
                  </label>
                  <label className="qp-field">
                    <span className="qp-label">Semester</span>
                    <select value={semesterNo} onChange={(e) => setSemesterNo(e.target.value)} className="qp-select">
                      {["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                </div>
                <label className="qp-field">
                  <span className="qp-label">Degree</span>
                  <input className="qp-select" value={degree} onChange={(e) => setDegree(e.target.value)} placeholder="e.g. MA Journalism and Mass Communication" />
                </label>
                <div className="qp-field-row">
                  <label className="qp-field">
                    <span className="qp-label">Subject code</span>
                    <input className="qp-select" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} placeholder={lookupSubjectCode() || "e.g. 25MJC3CA"} />
                  </label>
                  <label className="qp-field">
                    <span className="qp-label">QP code</span>
                    <input className="qp-select" value={qpCode} onChange={(e) => setQpCode(e.target.value)} placeholder="Optional" />
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
                      { label: "Multiple choice", part: "Part A", kind: "MCQ", value: Math.min(mcqCount, mcqPool.length), set: setMcqCount, max: mcqPool.length },
                      { label: "Descriptive", part: "Part B", kind: "descriptive", value: Math.min(descriptiveCount, descPool.length), set: setDescriptiveCount, max: descPool.length },
                      { label: "Diagram / problem", part: "Part C", kind: "diagram", value: Math.min(diagramCount, diagPool.length), set: setDiagramCount, max: diagPool.length },
                    ].map((row) => (
                      <div key={row.label} className="qp-count-row" style={row.max === 0 ? { opacity: 0.85, background: "#fff7ed", borderColor: "#fed7aa" } : undefined}>
                        <div className="qp-count-top">
                          <div>
                            <div className="qp-count-label">{row.label}</div>
                            <div className="qp-count-hint">{row.part} · {row.max} available</div>
                          </div>
                          {row.max > 0 && (
                            <div className="qp-stepper">
                              <button type="button" aria-label={`Decrease ${row.label}`} onClick={() => row.set((v) => Math.max(0, Math.min(v, row.max) - 1))}>−</button>
                              <span>{row.value}</span>
                              <button type="button" aria-label={`Increase ${row.label}`} disabled={row.value >= row.max} onClick={() => row.set((v) => Math.min(row.max, Math.min(v, row.max) + 1))}>+</button>
                            </div>
                          )}
                        </div>
                        {row.max > 0 ? (
                          <input type="range" min={0} max={row.max} value={row.value} onChange={(e) => row.set(Number(e.target.value))} className="qp-range" />
                        ) : (
                          <div className="qp-part-unavailable" role="status" style={{ marginTop: "8px", fontSize: "12px", fontWeight: 600, color: "#9a3412", lineHeight: 1.45 }}>
                            No {row.kind} questions in the question bank for this subject, so {row.part} cannot be added.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {printMode === "all" && subjectQs.length > 0 && missingParts.length > 0 && (
                  <div className="qp-part-unavailable" role="status" style={{ padding: "9px 12px", borderRadius: "10px", background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", fontSize: "12px", fontWeight: 600, lineHeight: 1.5 }}>
                    {missingParts.map((p) => `No ${p.kind} questions in the question bank, so ${p.part} will not be printed.`).join(" ")}
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

                <button type="button" onClick={handleTriggerPrint} className="qp-btn-primary qp-btn-block" disabled={totalQuestionsInPaper === 0} style={totalQuestionsInPaper === 0 ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
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
                  {/* Dotted page border, repeated on every printed page */}
                  <div className="qp-page-border" aria-hidden="true" />
                  <QuestionPaperFormat format={paperFormat} header={paperHeader} sections={paperSections} />

                  {totalQuestionsInPaper === 0 && (
                    <div className="no-print qp-empty">
                      {printableQuestions.length === 0
                        ? "No questions have COE final approval yet. Questions can be printed only after the COE gives final approval."
                        : subjectQs.length === 0
                          ? "This subject has no COE final-approved questions yet."
                          : "No questions selected yet. Choose “All questions” or increase the counts in the Paper Builder."}
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

        {isFormatChooserOpen && (
          <ModalPortal>
            <div className="no-print" role="dialog" aria-modal="true" aria-labelledby="qp-format-title" onClick={(e) => { if (e.target === e.currentTarget) setIsFormatChooserOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(30, 20, 12, 0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
              <div style={{ width: "min(640px, 100%)", background: "#fffdf9", borderRadius: "18px", boxShadow: "0 24px 60px rgba(0,0,0,0.3)", padding: "22px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                  <div>
                    <h2 id="qp-format-title" style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#3b2414" }}>Which format do you want to print?</h2>
                    <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#7a6250" }}>{totalQuestionsInPaper} COE-approved question{totalQuestionsInPaper === 1 ? "" : "s"} · {selectedSubject}</p>
                  </div>
                  <button type="button" aria-label="Close" onClick={() => setIsFormatChooserOpen(false)} style={{ border: "1px solid #e7d6c6", background: "#fff", borderRadius: "9px", width: "32px", height: "32px", cursor: "pointer", fontSize: "16px" }}>×</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginTop: "16px" }}>
                  {PAPER_FORMATS.map((fmt) => (
                    <button key={fmt.id} type="button" onClick={() => printInFormat(fmt.id)} style={{ textAlign: "left", border: paperFormat === fmt.id ? "2px solid #8b5a2b" : "1.5px solid #e7d6c6", background: paperFormat === fmt.id ? "#fdf4ec" : "#ffffff", borderRadius: "14px", padding: "12px", cursor: "pointer", display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ width: "120px", alignSelf: "center" }}><FormatThumbnail format={fmt.id} /></div>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 800, color: "#3b2414" }}>{fmt.name}</div>
                        <div style={{ fontSize: "12px", color: "#7a6250", marginTop: "3px", lineHeight: 1.45 }}>{fmt.description}</div>
                      </div>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "8px 10px", borderRadius: "9px", background: "#5b3a22", color: "#fff", fontSize: "12.5px", fontWeight: 800 }}>
                        <Printer size={14} /> Print in this format
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </ModalPortal>
        )}

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

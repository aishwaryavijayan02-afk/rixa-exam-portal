"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  BookOpen,
  FileText,
  CheckSquare,
  Upload,
  Search,
  CheckCircle2,
  BarChart2,
  Bell,
  Edit3,
  Users,
  Briefcase,
  Settings,
  Printer,
  Shield,
  ChevronRight,
  ArrowRight,
  Headphones,
  Info,
  School,
  SlidersHorizontal,
  Clock,
  XCircle,
  X,
  Eye,
  Check,
  Sparkles,
  RotateCcw,
  Trash2,
  Plus,
  Download,
  AlertCircle,
  ShieldCheck,
  Archive,
  LayoutGrid,
  ListFilter,
  UserRound,
} from "lucide-react";
import { examStore, QuestionItem, SyllabusUnit, SyllabusApprovalItem } from "../lib/examStore";
import { authStore, AuthUser, hasPermission } from "../lib/auth";
import RoleGuard from "../components/RoleGuard";
import {
  ViewModal,
  FormModal,
  DeleteModal,
  ToastNotification,
  VerificationResultModal,
  FormFieldDef,
  CrudActionButtons,
} from "../components/CrudModal";
import PortalFooter from "../components/PortalFooter";
import { confirmDialog } from "../components/ConfirmDialog";
import PortalHeader from "../components/PortalHeader";
import Pagination from "../components/Pagination";
import SyllabusDocumentPreview from "../components/SyllabusDocumentPreview";

function buildHodSyllabusPreview(item: SyllabusApprovalItem, units: SyllabusUnit[]): string {
  const uploadedText = (item.documentText || "").trim();
  // Use the staff's extracted document when it contains the actual unit
  // headings. This keeps HOD's preview identical to the staff preview.
  if (uploadedText && /^(unit|module|chapter)\b/im.test(uploadedText)) return uploadedText;

  const courseName = item.courseName.trim().toLowerCase();
  const matchingUnits = units
    .filter((unit) => unit.subject.trim().toLowerCase() === courseName)
    .sort((a, b) => Number(a.num) - Number(b.num));

  return [
    `Syllabus document: ${item.documentName || `${item.courseName}.docx`}`,
    `Subject: ${item.courseName}`,
    `Course code: ${item.courseCode}`,
    `Department: ${item.department}`,
    `Semester: ${item.semester}`,
    "",
    ...matchingUnits.flatMap((unit) => [
      `UNIT ${unit.num} - ${unit.name}`,
      ...(unit.subtopics || []).map((topic) => `• ${topic}`),
    ]),
  ].join("\n");
}

export default function ApprovalPage() {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState("approval");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRows, setSelectedRows] = useState<(number | string)[]>([]);
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards");
  const [currentPage, setCurrentPage] = useState(1);

  // CRUD state
  const [questions, setQuestions] = useState<QuestionItem[]>(() => examStore.getQuestions());
  const [viewingQuestion, setViewingQuestion] = useState<QuestionItem | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState<QuestionItem | null>(null);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);

  // Subject Questions Viewer Modal State
  const [subjectModalData, setSubjectModalData] = useState<{
    isOpen: boolean;
    subjectName: string;
    questions: QuestionItem[];
  }>({
    isOpen: false,
    subjectName: "",
    questions: [],
  });

  const handleOpenSubjectModal = (subjName: string, questionIds?: Array<number | string>) => {
    const cleanSubj = subjName.replace(/\s*\(All\)/i, "").trim();
    // The inspection view should always show the full subject pack. Filter by
    // approval stage only when deciding whether the bulk-approval action is available.
    const subjQuestions = examStore.getQuestions().filter((q) => {
      if (questionIds && !questionIds.some((id) => String(id) === String(q.id))) return false;
      const qSubj = (q.subject || "").trim();
      return Boolean(qSubj) && (
        qSubj.toLowerCase().includes(cleanSubj.toLowerCase()) ||
        cleanSubj.toLowerCase().includes(qSubj.toLowerCase())
      );
    });

    setSubjectModalData({
      isOpen: true,
      subjectName: cleanSubj,
      questions: subjQuestions,
    });
  };

  const closeSubjectQuestionModal = () => {
    setSubjectModalData({ isOpen: false, subjectName: "", questions: [] });
  };

  const handleApproveSubjectFromModal = () => {
    const ids = subjectModalData.questions
      .filter((q) => {
        const verifiedRole = (q.verifiedRole || "").toUpperCase();
        if (currentUser.role === "HOD") return q.status === "Pending";
        if (currentUser.role === "DEAN") return q.status === "Verified" || (q.status === "Approved" && verifiedRole === "HOD");
        if (currentUser.role === "COE") return q.status === "Approved" && verifiedRole === "DEAN";
        return q.status === "Verified";
      })
      .map((q) => q.id);
    if (ids.length === 0) {
      triggerToast(`No questions are currently waiting for ${currentUser.role === "DEAN" ? "Dean" : currentUser.role === "COE" ? "COE" : "HOD"} approval.`, "info");
      return;
    }

    if (currentUser.role === "HOD") {
      examStore.hodVerifyQuestions(ids, currentUser.name);
      setVerifyPopModal({
        isOpen: true,
        itemName: `${subjectModalData.subjectName} (${ids.length} Questions)`,
        verifiedCount: ids.length,
        title: "HOD Subject Verification Complete!",
        remarks: `Verified all ${ids.length} question(s) in ${subjectModalData.subjectName} by HOD ${currentUser.name}. Forwarded to Dean Academic Affairs for approval.`,
      });
    } else if (currentUser.role === "DEAN") {
      examStore.deanApproveQuestions(ids, currentUser.name);
      setVerifyPopModal({
        isOpen: true,
        itemName: `${subjectModalData.subjectName} (${ids.length} Questions)`,
        verifiedCount: ids.length,
        title: "Dean Subject Approval Complete!",
        remarks: `Approved all ${ids.length} question(s) in ${subjectModalData.subjectName} by Dean ${currentUser.name}. Forwarded to COE Question Bank.`,
      });
    } else if (currentUser.role === "COE") {
      examStore.coeFinalizeQuestions(ids, currentUser.name);
      setVerifyPopModal({
        isOpen: true,
        itemName: `${subjectModalData.subjectName} (${ids.length} Questions)`,
        verifiedCount: ids.length,
        title: "COE Final Approval Complete!",
        remarks: `Final sign-off granted by COE ${currentUser.name} for all ${ids.length} question(s) in ${subjectModalData.subjectName}. Ready for Question Paper Printing.`,
      });
    } else {
      examStore.deanApproveQuestions(ids, currentUser.name);
      setVerifyPopModal({
        isOpen: true,
        itemName: `${subjectModalData.subjectName} (${ids.length} Questions)`,
        verifiedCount: ids.length,
        title: "Subject Questions Approved!",
        remarks: `All ${ids.length} question(s) in ${subjectModalData.subjectName} have been verified and added to Question Bank.`,
      });
    }
  };

  // Verification Pop-up Modal State
  const [verifyPopModal, setVerifyPopModal] = useState<{
    isOpen: boolean;
    itemName?: string;
    title?: string;
    remarks?: string;
    verifiedCount?: number;
  }>({
    isOpen: false,
    itemName: "",
    title: "",
    remarks: "",
  });

  // Toast
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">("success");
  const [showToast, setShowToast] = useState(false);

  const triggerToast = (msg: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>(() => examStore.getLastUpdated());

  const [units, setUnits] = useState<SyllabusUnit[]>(() => examStore.getUnits());
  const [syllabusApprovals, setSyllabusApprovals] = useState<SyllabusApprovalItem[]>(() => examStore.getSyllabusApprovals());
  const [selectedSyllabus, setSelectedSyllabus] = useState<SyllabusApprovalItem | null>(null);

  useEffect(() => {
    const loadQuestions = () => {
      const all = examStore.getQuestions();
      setQuestions(all);
      setUnits(examStore.getUnits());
      setSyllabusApprovals(examStore.getSyllabusApprovals());
      setLastUpdatedTime(examStore.getLastUpdated());
    };
    loadQuestions();
    window.addEventListener("exam-cell-store-update", loadQuestions);
    // Staff uploads happen in a different tab/window. Refresh approval data
    // when localStorage changes there or when the HOD returns to this tab.
    const handleStorageSync = (event: StorageEvent) => {
      if (!event.key || event.key.startsWith("exam_cell_") || event.key === "subjects" || event.key === "syllabus_units" || event.key === "syllabus_approvals") {
        loadQuestions();
      }
    };
    const handleWindowFocus = () => loadQuestions();
    window.addEventListener("storage", handleStorageSync);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleWindowFocus);
    // Fallback poll only. Re-parsing the whole question store and re-rendering
    // this page every 1.5 s caused visible stutter, so poll gently and never
    // while the tab is hidden; store events above cover instant updates.
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") loadQuestions();
    }, 10000);
    return () => {
      window.removeEventListener("exam-cell-store-update", loadQuestions);
      window.removeEventListener("storage", handleStorageSync);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleWindowFocus);
      window.clearInterval(refreshTimer);
    };
  }, []);

  // A syllabus uploaded from another computer arrives without the original
  // file; fetch it from Supabase when the reviewer opens it.
  useEffect(() => {
    if (!selectedSyllabus || selectedSyllabus.documentData) return;
    let cancelled = false;
    void examStore.fetchSyllabusDocument(selectedSyllabus.id).then((documentData) => {
      if (!cancelled && documentData) {
        setSelectedSyllabus((current) => (current && current.id === selectedSyllabus.id ? { ...current, documentData } : current));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedSyllabus?.id, selectedSyllabus?.documentData]);

  // Auth User State
  const [currentUser, setCurrentUser] = useState<AuthUser>(() => authStore.getCurrentUser());
  const [selectedSubmissionKey, setSelectedSubmissionKey] = useState("");

  const approvalCandidates = questions.filter((question) => {
    const verifiedRole = (question.verifiedRole || "").toUpperCase();
    if (currentUser.role === "HOD") return question.status === "Pending";
    if (currentUser.role === "DEAN") return question.status === "Verified" || (question.status === "Approved" && verifiedRole === "HOD");
    if (currentUser.role === "COE") return question.status === "Approved" && verifiedRole === "DEAN";
    return question.status === "Verified";
  });
  const normalizeStaffName = (value: string) => value.toLowerCase().replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s*/i, "").trim();
  const submissionGroups = (() => {
    type ReviewGroup = {
      key: string;
      identity: string;
      staffName: string;
      email: string;
      subject: string;
      questions: QuestionItem[];
      candidates: QuestionItem[];
      syllabus: SyllabusApprovalItem | null;
    };
    const groups = new Map<string, ReviewGroup>();
    const getIdentity = (name: string, email: string) => {
      const normalizedName = normalizeStaffName(name);
      return normalizedName && normalizedName !== "faculty member" ? normalizedName : email.trim().toLowerCase() || normalizedName;
    };
    const addGroup = (name: string, email: string, subject: string) => {
      const identity = getIdentity(name, email);
      const groupSubject = subject.trim() || "Unassigned subject";
      const key = `${identity}::${groupSubject.toLowerCase()}`;
      if (!groups.has(key)) groups.set(key, { key, identity, staffName: name || "Faculty member", email, subject: groupSubject, questions: [], candidates: [], syllabus: null });
      return groups.get(key)!;
    };

    questions.forEach((question) => {
      const name = question.uploadedBy || "Faculty member";
      const email = question.email || "";
      const group = addGroup(name, email, question.subject);
      group.questions.push(question);
      if (approvalCandidates.some((candidate) => String(candidate.id) === String(question.id))) group.candidates.push(question);
    });

    const syllabusNeedsReview = (item: SyllabusApprovalItem) => {
      if (currentUser.role === "HOD") return item.hodStatus === "Pending" && item.status === "Pending";
      if (currentUser.role === "DEAN") return item.hodStatus === "Approved" && item.deanStatus === "Pending";
      if (currentUser.role === "COE") return item.deanStatus === "Approved" && (item.coeStatus === "Pending" || item.coeStatus === "Locked");
      return item.status === "Pending";
    };
    // Pair a syllabus with the same staff member's question bank even when the
    // subject names differ slightly (e.g. "Basic Mathematics" vs an older
    // upload saved as "Basic Mathematics Bloom").
    const subjectKey = (value: string) => value.toLowerCase().replace(/&/g, " ").replace(/\band\b/g, " ").replace(/[^a-z0-9]+/g, "");
    const sameSubject = (a: string, b: string) => {
      const x = subjectKey(a);
      const y = subjectKey(b);
      return Boolean(x && y) && (x === y || (Math.min(x.length, y.length) >= 6 && (x.includes(y) || y.includes(x))));
    };
    syllabusApprovals.filter(syllabusNeedsReview).forEach((item) => {
      const identity = getIdentity(item.submittedBy, item.submitterEmail);
      const existing = [...groups.values()].find(
        (group) => group.identity === identity && !group.syllabus && (sameSubject(group.subject, item.courseName) || (item.courseCode && sameSubject(group.subject, item.courseCode))),
      );
      const group = existing || addGroup(item.submittedBy, item.submitterEmail, item.courseName);
      if (!group.syllabus) group.syllabus = item;
    });

    return [...groups.values()]
      .filter((group) => group.candidates.length > 0 || Boolean(group.syllabus) || (currentUser.role === "COE" && group.questions.some((question) => question.status === "Approved" && (question.verifiedRole || "").toUpperCase() === "COE")))
      .sort((a, b) => {
        const currentIdentity = normalizeStaffName(currentUser.name) || currentUser.email.trim().toLowerCase();
        return Number(a.identity === currentIdentity) - Number(b.identity === currentIdentity);
      });
  })();
  const activeSubmission = submissionGroups.find((group) => group.key === selectedSubmissionKey) || submissionGroups[0] || null;
  const featuredQuestion = activeSubmission?.candidates[0] || activeSubmission?.questions[0] || null;
  const featuredSubject = activeSubmission?.subject || "";
  const featuredSubjectQuestions = activeSubmission?.questions || [];
  const featuredSubjectCandidates = activeSubmission?.candidates || [];
  const finalizedSubjectQuestions = featuredSubjectQuestions.filter((question) => question.status === "Approved" && (question.verifiedRole || "").toUpperCase() === "COE");
  const featuredSyllabus = activeSubmission?.syllabus || null;
  const facultyName = activeSubmission?.staffName || "No faculty upload yet";
  const submissionProxyUploader =
    featuredSyllabus?.uploadedOnBehalfBy ||
    featuredSubjectQuestions.find((question) => question.uploadedOnBehalfBy)?.uploadedOnBehalfBy ||
    "";

  const approveQuestionIds = (ids: (number | string)[]) => {
    if (ids.length === 0) return;
    if (currentUser.role === "HOD") examStore.hodVerifyQuestions(ids, currentUser.name);
    else if (currentUser.role === "COE") examStore.coeFinalizeQuestions(ids, currentUser.name);
    else examStore.deanApproveQuestions(ids, currentUser.name);
  };

  const buildSyllabusApprovalUpdates = (): Partial<SyllabusApprovalItem> => {
    const now = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const role = currentUser.role;
    if (role === "HOD") return { stage: "dean", status: "Approved", hodStatus: "Approved", hodName: currentUser.name, hodDate: now, deanStatus: "Pending", remarks: `Verified by HOD ${currentUser.name}. Forwarded to Dean for academic approval.` };
    if (role === "DEAN") return { stage: "coe", status: "Approved", deanStatus: "Approved", deanName: currentUser.name, deanDate: now, coeStatus: "Pending", remarks: `Approved by Dean ${currentUser.name}. Forwarded to COE for final review.` };
    if (role === "COE") return { stage: "coe", status: "Approved", coeStatus: "Approved", coeName: currentUser.name, coeDate: now, remarks: `Final syllabus approval completed by COE ${currentUser.name}.` };
    return {};
  };

  /** Verifies the whole active submission: pending questions + syllabus. */
  const handleVerifyFeaturedSubject = async () => {
    const questionIds = featuredSubjectCandidates.map((question) => question.id);
    const syllabus = featuredSyllabus;
    if (questionIds.length === 0 && !syllabus) {
      triggerToast("No staff submission is waiting for review.", "info");
      return;
    }
    const role = currentUser.role;
    const target = role === "HOD" ? "Dean" : role === "DEAN" ? "COE" : "the Question Bank";
    const items = [
      questionIds.length > 0 ? `${questionIds.length} question(s)` : "",
      syllabus ? `the syllabus "${syllabus.documentName || syllabus.courseName}"` : "",
    ].filter(Boolean).join(" and ");
    if (!(await confirmDialog(`${role === "HOD" ? "Verify" : "Approve"} ${items} from ${facultyName} for ${featuredSubject} and forward to ${target}?`, { title: role === "HOD" ? "Verify and forward" : "Approve and forward", confirmLabel: role === "HOD" ? "Verify" : "Approve" }))) return;

    approveQuestionIds(questionIds);
    if (syllabus) {
      const updates = buildSyllabusApprovalUpdates();
      if (Object.keys(updates).length > 0) examStore.updateSyllabusApproval(syllabus.id, updates);
    }
    setVerifyPopModal({
      isOpen: true,
      itemName: `${featuredSubject} · ${items}`,
      verifiedCount: questionIds.length,
      title: role === "HOD" ? "HOD Verification Complete!" : role === "DEAN" ? "Dean Approval Complete!" : "Final Approval Complete!",
      remarks: `${items.charAt(0).toUpperCase()}${items.slice(1)} ${role === "HOD" ? "verified by HOD" : "approved by"} ${currentUser.name} and forwarded to ${target}.`,
    });
  };

  const handlePrintFinalizedSubject = () => {
    if (!featuredSubject || finalizedSubjectQuestions.length === 0) return;
    router.push(`/print-paper?subject=${encodeURIComponent(featuredSubject)}&approvedOnly=true`);
  };

  const canApproveSubjectQuestions = subjectModalData.questions.some((q) => {
    const verifiedRole = (q.verifiedRole || "").toUpperCase();
    if (currentUser.role === "HOD") return q.status === "Pending";
    if (currentUser.role === "DEAN") return q.status === "Verified" || (q.status === "Approved" && verifiedRole === "HOD");
    if (currentUser.role === "COE") return q.status === "Approved" && verifiedRole === "DEAN";
    return q.status === "Verified";
  });

  useEffect(() => {
    const handleAuth = () => {
      setCurrentUser(authStore.getCurrentUser());
    };
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

  const handleApproveQuestion = (id: number | string) => {
    const q = questions.find((item) => String(item.id) === String(id));
    const qText = q ? q.question.slice(0, 45) + "..." : `#${id}`;

    if (currentUser.role === "HOD") {
      examStore.hodVerifyQuestions([id], currentUser.name);
      setVerifyPopModal({
        isOpen: true,
        itemName: qText,
        title: "HOD Verification Complete!",
        remarks: `Verified by HOD ${currentUser.name}. Question has been forwarded to Dean Academic Affairs (Dr. V Rajlakshmi) for final approval.`,
      });
    } else if (currentUser.role === "DEAN") {
      examStore.deanApproveQuestions([id], currentUser.name);
      setVerifyPopModal({
        isOpen: true,
        itemName: qText,
        title: "Dean Approval Complete!",
        remarks: `Approved by Dean ${currentUser.name}. Question has been forwarded to Controller of Examinations (COE Dr. Rajubalaji).`,
      });
    } else if (currentUser.role === "COE") {
      examStore.coeFinalizeQuestions([id], currentUser.name);
      setVerifyPopModal({
        isOpen: true,
        itemName: qText,
        title: "COE Final Approval Complete!",
        remarks: `Final sign-off granted by COE ${currentUser.name}. Question is locked in Question Bank and available for Question Paper Printing.`,
      });
    } else {
      examStore.deanApproveQuestions([id], currentUser.name);
      setVerifyPopModal({
        isOpen: true,
        itemName: qText,
        title: "Question Fully Approved!",
        remarks: `Question #${id} has completed academic verification and is now available in COE Question Bank.`,
      });
    }
  };

  const handleReturnForEdit = (id: number | string) => {
    examStore.saveQuestion({ id, status: "Pending" });
    triggerToast(`Question #${id} returned for editing.`, "info");
  };

  const handleRejectQuestion = (id: number | string) => {
    examStore.saveQuestion({ id, status: "Rejected" });
    triggerToast(`Question #${id} marked as Rejected.`, "info");
  };

  const handleRequestEditQuestion = (id: number | string) => {
    handleReturnForEdit(id);
  };

  const handleBulkApprove = () => {
    if (selectedRows.length === 0) return;
    if (currentUser.role === "HOD") {
      examStore.hodVerifyQuestions(selectedRows, currentUser.name);
      setVerifyPopModal({
        isOpen: true,
        itemName: `${selectedRows.length} Selected Question(s)`,
        title: "HOD Batch Verification Complete!",
        remarks: `Verified ${selectedRows.length} question(s) by HOD ${currentUser.name}. Forwarded to Dean Academic Affairs for approval.`,
      });
    } else if (currentUser.role === "DEAN") {
      examStore.deanApproveQuestions(selectedRows, currentUser.name);
      setVerifyPopModal({
        isOpen: true,
        itemName: `${selectedRows.length} Selected Question(s)`,
        title: "Dean Batch Approval Complete!",
        remarks: `Approved ${selectedRows.length} question(s) by Dean ${currentUser.name}. Forwarded to COE Question Bank.`,
      });
    } else if (currentUser.role === "COE") {
      examStore.coeFinalizeQuestions(selectedRows, currentUser.name);
      setVerifyPopModal({
        isOpen: true,
        itemName: `${selectedRows.length} Selected Question(s)`,
        title: "COE Final Sign-Off Complete!",
        remarks: `Final sign-off granted by COE ${currentUser.name} for ${selectedRows.length} question(s). Locked into COE Question Bank for exam paper printing.`,
      });
    } else {
      examStore.deanApproveQuestions(selectedRows, currentUser.name);
      setVerifyPopModal({
        isOpen: true,
        itemName: `${selectedRows.length} Selected Question(s)`,
        title: "Dean Batch Approval Complete!",
        remarks: `Approved ${selectedRows.length} question(s) by Dean ${currentUser.name}. Forwarded to COE Question Bank.`,
      });
    }
    setSelectedRows([]);
  };

  const handleBulkReturn = () => {
    if (selectedRows.length === 0) return;
    examStore.bulkUpdateQuestions(selectedRows.map(Number), "Pending");
    setSelectedRows([]);
    triggerToast(`Returned ${selectedRows.length} question(s) for editing.`, "info");
  };

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) return;
    if (await confirmDialog(`Delete ${selectedRows.length} selected question(s)?`, { danger: true })) {
      examStore.bulkDeleteQuestions(selectedRows.map(Number));
      setSelectedRows([]);
      triggerToast(`Removed ${selectedRows.length} question(s).`, "error");
    }
  };

  const handleExportApproved = () => {
    const approved = questions.filter((q) => q.status === "Approved");
    const dataToExport = approved.length > 0 ? approved : questions;
    const rows = dataToExport.map((q) => ({
      ID: q.id,
      Question: q.question,
      Subject: q.subject,
      Unit: q.unit,
      Topic: q.topic,
      Type: q.type,
      Difficulty: q.difficulty,
      Marks: q.marks,
      Status: q.status,
    }));
    examStore.exportToCsv("approved_questions_export.csv", rows);
    triggerToast(`Exported ${rows.length} questions to CSV!`, "success");
  };

  const toggleRow = (id: number | string) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRows.length === filteredQuestions.length && filteredQuestions.length > 0) {
      setSelectedRows([]);
    } else {
      setSelectedRows(filteredQuestions.map((q) => q.id));
    }
  };

  const handleReset = () => {
    setSearchQuery("");
  };

  const filteredQuestions = questions.filter((q) => {
    // 3-Tier Approval Workflow Filter
    if (currentUser.role === "HOD" && q.status !== "Pending") return false;
    if (currentUser.role === "DEAN" && q.status !== "Verified") return false;
    if (currentUser.role === "COE" && q.status !== "Approved" && q.status !== "Verified") return false;

    if (searchQuery.trim()) {
      const qLower = searchQuery.toLowerCase();
      const match =
        q.question.toLowerCase().includes(qLower) ||
        q.subject.toLowerCase().includes(qLower) ||
        q.topic.toLowerCase().includes(qLower) ||
        (q.uploadedBy && q.uploadedBy.toLowerCase().includes(qLower)) ||
        (q.sourceFile && q.sourceFile.toLowerCase().includes(qLower));
      if (!match) return false;
    }
    return true;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const itemsPerPage = 6;
  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const paginatedQuestions = filteredQuestions.slice(startIndex, startIndex + itemsPerPage);

  const questionFields: FormFieldDef[] = [
    { name: "question", label: "Question Text", type: "textarea", required: true },
    {
      name: "subject",
      label: "Subject",
      type: "select",
      options: ["Viscom & VFX", "Viscom", "Animation Basics", "Sound Engineering"],
      required: true,
    },
    { name: "unit", label: "Unit", type: "text", required: true },
    { name: "topic", label: "Topic", type: "text", required: true },
    {
      name: "type",
      label: "Question Type",
      type: "select",
      options: ["MCQ", "Descriptive", "Match Type", "Short Answer"],
      required: true,
    },
    {
      name: "difficulty",
      label: "Difficulty Level",
      type: "select",
      options: ["Easy", "Medium", "Hard"],
      required: true,
    },
    { name: "marks", label: "Marks", type: "number", required: true },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: ["Pending", "Verified", "Approved", "Rejected"],
      required: true,
    },
  ];

  return (
    <RoleGuard route="/approval">
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
      {/* ================================= SIDEBAR ================================= */}
      <aside className="digital-vfx-sidebar"
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
          {/* RGU Logo */}
          <div style={{ padding: "6px 10px 24px 10px" }}>
            <div className="brand-orbit-logo" aria-label="Rathinam Global (Deemed to be University)"><span className="brand-orbit-mark">RG</span><span className="brand-orbit-name">Rathinam Global</span></div>
          </div>

          {/* Navigation Items */}
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
                    className="nav-icon-3d"
                    style={{
                      filter: isActive
                        ? "drop-shadow(0 0 6px rgba(255,255,255,0.8))"
                        : "none",
                      transition: "filter 0.2s ease",
                    }}
                  />
                  <span style={{ flex: 1, letterSpacing: "0.2px" }}>{item.label}</span>

                  {item.badge && (
                    <span className="badge-neon-3d">
                      {item.badge}
                    </span>
                  )}

                  {item.hasArrow && (
                    <ChevronRight
                      size={16}
                      color="#ffffff"
                      style={{
                        filter: "drop-shadow(0 0 4px rgba(255,255,255,0.6))",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Need Help Box */}
        <div className="support-card-3d">
          <div className="shield-icon-3d">
            <Shield
              size={19}
              style={{
                filter: "drop-shadow(0 0 6px rgba(214, 170, 132, 0.8))",
              }}
            />
          </div>
          <strong
            style={{
              display: "block",
              color: "#ffffff",
              fontSize: "13.5px",
              marginBottom: "4px",
              fontWeight: 700,
            }}
          >
            Need Help?
          </strong>
          <p
            style={{
              fontSize: "11.5px",
              color: "#94a3b8",
              lineHeight: 1.4,
              margin: "0 0 14px 0",
            }}
          >
            Our support team is ready to assist you.
          </p>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("open-exam-support-modal"));
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              width: "100%",
              padding: "9px 12px",
              borderRadius: "10px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.14)",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.16)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.14)";
            }}
          >
            <span>Contact Support</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </aside>

      {/* ================================= MAIN CONTENT ================================= */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        <PortalHeader activeRoute="approval" />

        <main className="approval-page-main approval-model-main" style={{ flex: 1, padding: "28px 32px", overflowY: "auto", overflowX: "hidden", minWidth: 0, width: "100%", boxSizing: "border-box" }}>
          <section className="approval-model-sheet" aria-label="Submission verification details">
            {submissionGroups.length > 1 && (
              <div className="approval-model-picker-row">
                <label htmlFor="approval-submission-picker">Staff submission</label>
                <select id="approval-submission-picker" value={activeSubmission?.key || ""} onChange={(event) => setSelectedSubmissionKey(event.target.value)}>
                  {submissionGroups.map((group) => <option key={group.key} value={group.key}>{group.staffName} · {group.subject}</option>)}
                </select>
                <span>{submissionGroups.length} submissions awaiting review</span>
              </div>
            )}
            <div className="approval-model-columns">
              <section className="approval-model-column approval-model-faculty">
                <div className="approval-model-column-heading"><Users size={19} /><h2>Faculty Name</h2></div>
                {activeSubmission ? (
                  <div className="approval-model-document approval-model-faculty-card">
                    <span className="approval-model-document-icon approval-model-faculty-avatar" aria-hidden="true">
                      {(facultyName.replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s*/i, "").trim()[0] || "F").toUpperCase()}
                    </span>
                    <span className="approval-model-document-meta">
                      <strong title={facultyName}>{facultyName}</strong>
                      <small title={activeSubmission.email || ""}>{activeSubmission.email || "Faculty member"}</small>
                      {submissionProxyUploader && <small title={submissionProxyUploader}>Uploaded by {submissionProxyUploader} (HOD)</small>}
                    </span>
                    <span className="approval-model-document-status"><UserRound size={13} /> {featuredSubject || "Subject"}</span>
                  </div>
                ) : (
                  <div className="approval-model-empty"><UserRound size={22} /><strong>No faculty selected</strong><span>Faculty details appear here when a staff member submits work.</span></div>
                )}
              </section>

              <section className="approval-model-column">
                <div className="approval-model-column-heading"><BookOpen size={19} /><h2>Syllabus</h2></div>
                {featuredSyllabus ? (
                  <div className="approval-model-document">
                    <span className="approval-model-document-icon"><FileText size={21} /></span>
                    <span className="approval-model-document-meta"><strong>{featuredSyllabus.documentName || featuredSyllabus.courseName}</strong><small>{featuredSyllabus.courseName} · {featuredSyllabus.courseCode || "Syllabus"} · {featuredSyllabus.semester || "Semester not provided"}</small></span>
                    <button type="button" className="approval-model-view-button" onClick={() => setSelectedSyllabus(featuredSyllabus)}><Eye size={16} /> View</button>
                    <span className="approval-model-document-status"><span className={`approval-model-status-dot ${featuredSyllabus.hodStatus === "Approved" ? "is-complete" : "is-pending"}`} />{featuredSyllabus.hodStatus === "Approved" ? "Verified" : "Pending review"}</span>
                  </div>
                ) : (
                  <div className="approval-model-empty"><FileText size={22} /><strong>No syllabus uploaded by this staff</strong><span>This staff member has not uploaded a syllabus for this subject.</span></div>
                )}
              </section>

              <section className="approval-model-column">
                <div className="approval-model-column-heading"><Archive size={19} /><h2>Question Bank</h2></div>
                {featuredSubjectQuestions.length > 0 ? (
                  <div className="approval-model-document">
                    <span className="approval-model-document-icon question"><Archive size={21} /></span>
                    <span className="approval-model-document-meta"><strong>{featuredQuestion?.sourceFile || (featuredQuestion ? `${/^unit\b/i.test(featuredQuestion.unit) ? "" : "Unit "}${featuredQuestion.unit} · ${featuredQuestion.type}` : featuredSubject)}</strong><small>{featuredSubject} · {featuredSubjectQuestions.length} {featuredSubjectQuestions.length === 1 ? "question" : "questions"} from {facultyName}</small></span>
                    <button type="button" className="approval-model-view-button" onClick={() => handleOpenSubjectModal(featuredSubject, featuredSubjectQuestions.map((question) => question.id))}><Eye size={16} /> View</button>
                    <span className="approval-model-document-status"><span className={`approval-model-status-dot ${featuredSubjectCandidates.length > 0 ? "is-pending" : "is-complete"}`} />{featuredSubjectCandidates.length > 0 ? `${featuredSubjectCandidates.length} awaiting review` : "Reviewed"}</span>
                  </div>
                ) : (
                  <div className="approval-model-empty"><Archive size={22} /><strong>No question bank submitted</strong><span>Question bank uploads will appear here when faculty submit them.</span></div>
                )}
              </section>
            </div>

            <div className="approval-model-action-bar">
              <div className="approval-model-action-copy"><span className="approval-model-action-shield"><ShieldCheck size={19} /></span><span><strong>{finalizedSubjectQuestions.length > 0 ? "Final approval complete" : "Ready for academic review"}</strong><small>{finalizedSubjectQuestions.length > 0 ? `${finalizedSubjectQuestions.length} approved question${finalizedSubjectQuestions.length === 1 ? "" : "s"} ready to print.` : `${featuredSubjectCandidates.length} question${featuredSubjectCandidates.length === 1 ? "" : "s"} currently await ${currentUser.role === "HOD" ? "HOD verification" : currentUser.role === "DEAN" ? "Dean approval" : currentUser.role === "COE" ? "COE sign-off" : "review"}.`}</small></span></div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                {currentUser.role === "COE" && finalizedSubjectQuestions.length > 0 && (
                  <button type="button" className="approval-model-approve-button" onClick={handlePrintFinalizedSubject} style={{ background: "linear-gradient(135deg, #8b5a2b, #5a3a24)", borderColor: "#c08552" }}>
                    <Printer size={18} /> Print approved questions <ArrowRight size={17} />
                  </button>
                )}
                <button type="button" className="approval-model-approve-button approval-model-forward-button" onClick={handleVerifyFeaturedSubject} disabled={featuredSubjectCandidates.length === 0 && !featuredSyllabus} title={featuredSubjectCandidates.length === 0 && !featuredSyllabus ? "Nothing is waiting for review" : undefined}>
                    <Sparkles size={16} />
                    <Check size={16} strokeWidth={3} />
                    {currentUser.role === "HOD" ? "Verify & Forward to Dean" : currentUser.role === "DEAN" ? "Approve & Forward to COE" : currentUser.role === "COE" ? "Final Approval" : "Verify & Forward"}
                </button>
              </div>
            </div>
          </section>

          <PortalFooter />
        </main>
      </div>

      {selectedSyllabus && (
        <div className="syllabus-review-overlay" onClick={() => setSelectedSyllabus(null)} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(40, 26, 17, 0.62)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div className="syllabus-review-modal" onClick={(event) => event.stopPropagation()} style={{ width: "min(860px, 100%)", height: "86vh", maxHeight: "86vh", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "18px", background: "#ffffff", boxShadow: "0 24px 70px rgba(40, 26, 17, 0.28)" }}>
            <div className="syllabus-review-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", padding: "18px 20px", background: "linear-gradient(135deg, #eff6ff, #f8fafc)", borderBottom: "1px solid #dbeafe" }}>
              <div><div style={{ fontSize: "10px", color: "#c3844d", fontWeight: 850, textTransform: "uppercase", letterSpacing: "0.08em" }}>Syllabus Document Review</div><h2 style={{ margin: "5px 0 0", color: "#4c311f", fontSize: "18px", fontWeight: 850 }}>{selectedSyllabus.courseName}</h2><div style={{ marginTop: "4px", color: "#64748b", fontSize: "11px" }}>Uploaded by {selectedSyllabus.submittedBy}{selectedSyllabus.uploadedOnBehalfBy ? ` (via HOD ${selectedSyllabus.uploadedOnBehalfBy})` : ""} · {selectedSyllabus.documentName || "Syllabus document"}</div></div>
              <button type="button" onClick={() => setSelectedSyllabus(null)} aria-label="Close document preview" style={{ width: "32px", height: "32px", display: "grid", placeItems: "center", border: "none", borderRadius: "9px", background: "#e2e8f0", color: "#475569", cursor: "pointer" }}><X size={17} /></button>
            </div>
            <SyllabusDocumentPreview
              text={buildHodSyllabusPreview(selectedSyllabus, units)}
              fileName={selectedSyllabus.documentName || `${selectedSyllabus.courseName}.docx`}
              subject={selectedSyllabus.courseName}
              code={selectedSyllabus.courseCode}
              semester={selectedSyllabus.semester}
              department={selectedSyllabus.department}
              fileUrl={selectedSyllabus.documentData || null}
            />
            <div style={{ display: "none", padding: "20px", maxHeight: "calc(86vh - 110px)", overflowY: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "16px" }}>
                {[['Course Code', selectedSyllabus.courseCode], ['Semester', selectedSyllabus.semester], ['Department', selectedSyllabus.department]].map(([label, value]) => <div key={label} style={{ padding: "10px 12px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}><div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 800, textTransform: "uppercase" }}>{label}</div><div style={{ marginTop: "4px", color: "#334155", fontSize: "12px", fontWeight: 750 }}>{value}</div></div>)}
              </div>
              {(() => {
                const previewText = selectedSyllabus.documentText || [
                  `Syllabus document: ${selectedSyllabus.documentName || `${selectedSyllabus.courseName}.docx`}`,
                  `Subject: ${selectedSyllabus.courseName}`,
                  `Course code: ${selectedSyllabus.courseCode}`,
                  `Department: ${selectedSyllabus.department}`,
                  `Semester: ${selectedSyllabus.semester}`,
                  "",
                  "This syllabus was uploaded and ingested successfully. The document record is ready for HOD verification.",
                ].join("\n");
                let unitNumber = 0;
                let topicNumber = 0;
                let outcomeNumber = 0;
                return (
                  <div style={{ padding: "26px 18px 34px", maxHeight: "calc(86vh - 110px)", overflowY: "auto", background: "linear-gradient(135deg, #e8edf5 0%, #f8fafc 55%, #e9eef8 100%)" }}>
                    <div style={{ maxWidth: "850px", minHeight: "100%", margin: "0 auto", background: "#ffffff", border: "1px solid #dbe3ee", borderRadius: "4px", boxShadow: "0 12px 30px rgba(40, 26, 17, 0.12)", overflow: "hidden" }}>
                      <div style={{ padding: "30px 38px 24px", borderBottom: "1px solid #dbe3ee", background: "linear-gradient(135deg, #f8fafc, #eef2ff)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", marginBottom: "20px" }}>
                          <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#d4a780" }}>Official Academic Document</div>
                          <div style={{ padding: "5px 9px", borderRadius: "999px", background: "#e0e7ff", color: "#c07d42", fontSize: "10px", fontWeight: 800 }}>FULL PREVIEW</div>
                        </div>
                        <div style={{ fontSize: "24px", fontWeight: 850, lineHeight: 1.25, color: "#4c311f" }}>Syllabus Document</div>
                        <div style={{ marginTop: "8px", fontSize: "12px", color: "#64748b" }}>{selectedSyllabus.documentName || `${selectedSyllabus.courseName}.docx`}</div>
                      </div>
                      <div style={{ padding: "30px 38px 46px", fontFamily: "Arial, sans-serif" }}>
                        {previewText.split(/\r?\n/).map((line, index) => {
                          const value = line.trim();
                          if (!value) return <div key={`space-${index}`} style={{ height: "10px" }} />;
                          const isTitle = index === 0;
                          const isUnit = /^(unit|module|chapter)\s*(\d+|[ivx]+)?\s*[:.)-]?/i.test(value);
                          const isLabel = /^(subject code|programme|level|course type|suggested credits|suggested contact hours|semester|department|unit|course objectives?|course outcomes?|topics?|references?)\s*:?$/i.test(value);
                          const isOutcome = /^CO\s*\d+\s*[:.)-]?/i.test(value);
                          if (isUnit) { unitNumber += 1; topicNumber = 0; }
                          if (isOutcome) outcomeNumber += 1;
                          const isTopic = unitNumber > 0 && !isTitle && !isUnit && !isLabel && !isOutcome;
                          const displayValue = isOutcome ? value.replace(/^CO\s*\d+\s*[:.)-]?\s*/i, "") : value;
                          const number = isOutcome ? outcomeNumber : isTopic ? ++topicNumber : "";
                          return (
                            <div key={`${value}-${index}`} style={{ display: "flex", alignItems: "flex-start", gap: (isTopic || isOutcome) ? "12px" : 0, marginTop: isUnit ? "22px" : 0, marginBottom: isTitle ? "20px" : isUnit ? "10px" : isLabel ? "6px" : "13px", padding: isUnit ? "12px 14px" : isLabel ? "8px 10px" : (isTopic || isOutcome) ? "7px 10px" : 0, borderLeft: isUnit ? "5px solid #ca9261" : isLabel ? "3px solid #deba9b" : (isTopic || isOutcome) ? "3px solid #c7d2fe" : "none", borderBottom: isUnit || isLabel ? "1px solid #dbe3ee" : "none", borderRadius: isUnit ? "8px" : (isTopic || isOutcome) ? "6px" : 0, background: isUnit ? "linear-gradient(135deg, #eef2ff, #f8fafc)" : isLabel ? "#f8faff" : (isTopic || isOutcome) ? "#fbfdff" : "transparent", color: isTitle ? "#7e512a" : isUnit ? "#81552e" : isLabel ? "#c07d42" : "#334155", fontSize: isTitle ? "20px" : isUnit ? "15px" : isLabel ? "11px" : "13px", fontWeight: isTitle || isUnit || isLabel ? 800 : 500, letterSpacing: isUnit || isLabel ? "0.06em" : "normal", textTransform: isUnit || isLabel ? "uppercase" : "none", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                              {(isTopic || isOutcome) && <span style={{ flex: "0 0 32px", display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: "24px", borderRadius: "6px", background: isOutcome ? "#dcfce7" : "#e0e7ff", color: isOutcome ? "#166534" : "#c07d42", fontSize: "11px", fontWeight: 800 }}>{number}</span>}
                              <span style={{ flex: 1 }}>{displayValue}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "12px 18px", borderTop: "1px solid #dbeafe", background: "#f8fafc" }}>
              <div style={{ fontSize: "11px", color: "#64748b" }}>
                {selectedSyllabus.hodStatus === "Approved" ? "Verified and forwarded in the approval workflow." : "Review the complete Unit 1–5 document before forwarding."}
              </div>
              {/* Read-only preview: approval is done with "Verify & Forward" on the review page. */}
            </div>
          </div>
        </div>
      )}

      {/* ================= CRUD MODALS ================= */}
      <ViewModal
        isOpen={subjectModalData.isOpen}
        onClose={closeSubjectQuestionModal}
        title={`${subjectModalData.subjectName} - Questions Approval Inspection`}
        subtitle="Read all questions in full detail below before giving official verification approval"
        questionsList={subjectModalData.questions}
        groupQuestionsByUnit
        // Read-only inspection: approval is done with the "Verify & Forward"
        // button on the review page, so no verify button is shown here.
      />

      <ViewModal
        isOpen={!!viewingQuestion}
        onClose={() => setViewingQuestion(null)}
        title="Question Details & Verification"
        subtitle={`ID: #${viewingQuestion?.id} • Subject: ${viewingQuestion?.subject}`}
        badge={viewingQuestion?.status || "Pending"}
        badgeColor={
          viewingQuestion?.status === "Approved"
            ? "green"
            : viewingQuestion?.status === "Verified"
            ? "blue"
            : "yellow"
        }
        questionsList={viewingQuestion ? [viewingQuestion] : []}
        verifyLabel={
          currentUser.role === "HOD"
            ? "Verify & Send to Dean"
            : currentUser.role === "DEAN"
            ? "Approve & Send to COE"
            : "Verify Question"
        }
        onVerify={() => {
          if (!viewingQuestion) return;
          handleApproveQuestion(viewingQuestion.id);
          setViewingQuestion(null);
        }}
        data={
          viewingQuestion
            ? [
                { label: "Question Statement", value: viewingQuestion.question, spanFull: true },
                { label: "Subject", value: viewingQuestion.subject },
                { label: "Unit", value: viewingQuestion.unit },
                { label: "Topic", value: viewingQuestion.topic },
                { label: "Type", value: viewingQuestion.type },
                { label: "Difficulty", value: viewingQuestion.difficulty },
                { label: "Marks", value: viewingQuestion.marks || 5 },
                { label: "Status", value: viewingQuestion.status },
                { label: "Uploaded By", value: viewingQuestion.uploadedBy || "Prof. Priya Sharma" },
                { label: "Verified By", value: viewingQuestion.verifiedBy || "Pending Review" },
                { label: "Verified On", value: viewingQuestion.date ? `${viewingQuestion.date}, ${viewingQuestion.time || ""}` : "Pending" },
              ]
            : []
        }
      />

      <FormModal
        isOpen={isAddingQuestion || !!editingQuestion}
        onClose={() => {
          setIsAddingQuestion(false);
          setEditingQuestion(null);
        }}
        title={editingQuestion ? "Edit Question" : "Add New Question"}
        subtitle={editingQuestion ? `Editing Question #${editingQuestion.id}` : "Create a new question for approval"}
        fields={questionFields}
        initialData={editingQuestion || { subject: "Viscom & VFX", type: "MCQ", difficulty: "Medium", marks: 5, status: "Verified" }}
        submitLabel={editingQuestion ? "Update Question" : "Create Question"}
        onSubmit={(data) => {
          if (editingQuestion) {
            examStore.saveQuestion({ ...editingQuestion, ...data });
            triggerToast("Question updated successfully!", "success");
          } else {
            examStore.saveQuestion({ ...data, status: data.status || "Verified" });
            triggerToast("New question created successfully!", "success");
          }
          setIsAddingQuestion(false);
          setEditingQuestion(null);
        }}
      />

      <DeleteModal
        isOpen={!!deletingQuestion}
        onClose={() => setDeletingQuestion(null)}
        title="Delete Question"
        message="Are you sure you want to permanently delete this question from approval? This action cannot be undone."
        itemName={deletingQuestion?.question ? `"${deletingQuestion.question.slice(0, 60)}..."` : undefined}
        onConfirm={() => {
          if (deletingQuestion) {
            examStore.deleteQuestion(deletingQuestion.id);
            triggerToast("Question deleted successfully.", "info");
            setDeletingQuestion(null);
          }
        }}
      />

      <ToastNotification
        message={toastMessage}
        type={toastType}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />

      <VerificationResultModal
        isOpen={verifyPopModal.isOpen}
        onClose={() => setVerifyPopModal((prev) => ({ ...prev, isOpen: false }))}
        title={verifyPopModal.title}
        itemName={verifyPopModal.itemName}
        qualityScore={98}
        verifiedCount={verifyPopModal.verifiedCount ?? 0}
        remarks={verifyPopModal.remarks}
      />
    </div>
    </RoleGuard>
  );
}

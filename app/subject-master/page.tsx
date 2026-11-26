"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import JSZip from "jszip";
import {
  Archive, BarChart2, Bell, BookOpen, Briefcase, CheckCircle2, CheckSquare, Download, Edit3, FileUp, Home, Layers, Plus,
  Printer, School, Search, Settings, Shield, Trash2, Upload, X,
} from "lucide-react";
import { examStore, SubjectMasterItem, SubjectMasterInput, ExistingSubject } from "../lib/examStore";
import { authStore, AuthUser, menuForUser } from "../lib/auth";
import { SCRUTINY_MENU_ITEMS } from "../lib/scrutinyMenu";
import RoleGuard from "../components/RoleGuard";
import PortalHeader from "../components/PortalHeader";
import PortalFooter from "../components/PortalFooter";
import NavIcon from "../components/NavIcon";
import { ToastNotification } from "../components/CrudModal";
import { confirmDialog } from "../components/ConfirmDialog";

const SEMESTERS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const EMPTY_FORM: SubjectMasterInput = { name: "", code: "", school: "", department: "", semester: "" };

// ---------- spreadsheet reading (CSV / Excel) ----------
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

async function parseXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const zip = await JSZip.loadAsync(buffer);
  const decode = (v: string) => v.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  const sharedFile = zip.file("xl/sharedStrings.xml");
  const shared = sharedFile
    ? [...(await sharedFile.async("string")).matchAll(/<si\b[\s\S]*?<\/si>/g)].map((m) => [...m[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decode(t[1])).join(""))
    : [];
  const sheet = zip.file("xl/worksheets/sheet1.xml") || zip.file(/xl\/worksheets\/sheet\d+\.xml/)[0];
  if (!sheet) return [];
  const xml = await sheet.async("string");
  const colIndex = (ref: string) => [...ref.replace(/\d/g, "").toUpperCase()].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
  return [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)]
    .map((r) => {
      const values: string[] = [];
      for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1];
        const body = c[2] || "";
        const ref = /\br="([A-Z]+\d+)"/i.exec(attrs)?.[1];
        const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
        const raw = /<v[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? /<t[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1] ?? "";
        values[ref ? colIndex(ref) : values.length] = (type === "s" ? shared[Number(raw)] || "" : decode(raw)).trim();
      }
      return Array.from(values, (v) => v || "");
    })
    .filter((r) => r.some(Boolean));
}

/** Spreadsheet rows -> subject inputs, using the header row to find columns. */
function rowsToSubjects(rows: string[][]): Partial<SubjectMasterInput>[] {
  if (!rows.length) return [];
  const norm = (v: string) => (v || "").toLowerCase().replace(/[^a-z]/g, "");
  const header = rows[0].map(norm);
  const find = (names: string[]) => header.findIndex((h) => names.includes(h));
  const idx = {
    name: find(["subject", "subjectname", "name", "coursename", "course", "title"]),
    code: find(["code", "subjectcode", "coursecode"]),
    department: find(["department", "dept", "departmentname"]),
    school: find(["school", "schoolname", "faculty"]),
    semester: find(["semester", "sem"]),
  };
  const hasHeader = idx.name >= 0 || idx.code >= 0;
  // Without a header: Subject name, Code, Department, School, Semester.
  const col = hasHeader ? idx : { name: 0, code: 1, department: 2, school: 3, semester: 4 };
  return (hasHeader ? rows.slice(1) : rows).map((r) => ({
    name: col.name >= 0 ? r[col.name] || "" : "",
    code: col.code >= 0 ? r[col.code] || "" : "",
    department: col.department >= 0 ? r[col.department] || "" : "",
    school: col.school >= 0 ? r[col.school] || "" : "",
    semester: (col.semester >= 0 ? r[col.semester] || "" : "").replace(/^sem(ester)?\s*/i, "").trim(),
  }));
}

export default function SubjectMasterPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser>(() => authStore.getCurrentUser());
  const [subjects, setSubjects] = useState<SubjectMasterItem[]>([]);
  // Subjects already used in the app (built-in list, uploads) that are not in the master yet.
  const [existingSubjects, setExistingSubjects] = useState<ExistingSubject[]>([]);
  // Name of the existing subject being edited (saving adds it to the master).
  const [editingExisting, setEditingExisting] = useState<string | null>(null);
  const [form, setForm] = useState<SubjectMasterInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [bulkName, setBulkName] = useState<string | null>(null);
  const [bulkRows, setBulkRows] = useState<Partial<SubjectMasterInput>[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ message: string; isVisible: boolean; type?: "success" | "danger" }>({ message: "", isVisible: false });
  const showToast = (message: string, type: "success" | "danger" = "success") => {
    setToast({ message, isVisible: true, type });
    window.setTimeout(() => setToast((t) => ({ ...t, isVisible: false })), 3200);
  };

  useEffect(() => {
    const load = () => {
      setSubjects(examStore.getSubjectMaster());
      setExistingSubjects(examStore.getExistingSubjects());
    };
    const auth = () => setCurrentUser(authStore.getCurrentUser());
    load();
    window.addEventListener("exam-cell-store-update", load);
    window.addEventListener("exam-cell-auth-update", auth);
    return () => {
      window.removeEventListener("exam-cell-store-update", load);
      window.removeEventListener("exam-cell-auth-update", auth);
    };
  }, []);

  const hierarchy = examStore.getInstitutionalHierarchy();
  const formSchool = hierarchy.find((s) => s.name === form.school);
  const filterSchool = hierarchy.find((s) => s.name === schoolFilter);

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

  // ---------- add / edit ----------
  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const result = examStore.saveSubjectMaster({ ...form, id: editingId || undefined }, currentUser.name);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    // Editing a built-in / uploaded subject with a new name and code: hide the old entry too.
    if (editingExisting) {
      const old = examStore.getExistingSubjects().find((x) => x.name === editingExisting);
      if (old) examStore.retireExistingSubject(old, currentUser.name);
    }
    showToast(editingId || editingExisting ? `Updated ${result.item!.name} (${result.item!.code}).` : `Added ${result.item!.name} (${result.item!.code}).`);
    setForm({ ...EMPTY_FORM, school: form.school, department: form.department });
    setEditingId(null);
    setEditingExisting(null);
    setFormError(null);
  };
  const startEditExisting = (s: ExistingSubject) => {
    setEditingId(null);
    setEditingExisting(s.name);
    setForm({ name: s.name, code: s.code, school: s.school, department: s.department, semester: s.semester || "" });
    setFormError(null);
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
  };
  const removeExisting = async (s: ExistingSubject) => {
    const ok = await confirmDialog(`Delete ${s.name}${s.code ? ` (${s.code})` : ""} from the subject lists? It will no longer be offered for uploads or question papers. Uploaded questions and syllabi are not deleted.`, { title: "Delete subject", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    examStore.retireExistingSubject(s, currentUser.name);
    if (editingExisting === s.name) { setEditingExisting(null); setForm(EMPTY_FORM); }
    showToast(`Deleted ${s.name}.`, "danger");
  };
  const importAllExisting = async () => {
    const ok = await confirmDialog(`Add the ${existingSubjects.length} existing subject(s) to the subject master? Subjects without a code or a known department are skipped; you can edit them one by one.`, { title: "Add existing subjects", confirmLabel: "Add to master" });
    if (!ok) return;
    const result = examStore.importExistingSubjects(currentUser.name);
    showToast(`${result.added} added to the master${result.skipped ? `, ${result.skipped} need a code or department (edit them below)` : ""}.`, result.skipped ? "danger" : "success");
  };
  const startEdit = (s: SubjectMasterItem) => {
    setEditingExisting(null);
    setEditingId(s.id);
    setForm({ name: s.name, code: s.code, school: s.school, department: s.department, semester: s.semester || "" });
    setFormError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
  };
  const removeSubject = async (s: SubjectMasterItem) => {
    const ok = await confirmDialog(`Delete ${s.name} (${s.code}) from the subject list? Uploaded questions and syllabi are not deleted.`, { title: "Delete subject", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    examStore.deleteSubjectMaster(s.id);
    if (editingId === s.id) { setEditingId(null); setForm(EMPTY_FORM); }
    showToast(`Deleted ${s.name}.`, "danger");
  };

  // ---------- bulk upload ----------
  const readBulkFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    try {
      const rows = ext === "csv" || ext === "txt" ? parseCsv(await file.text()) : ext === "xlsx" ? await parseXlsx(await file.arrayBuffer()) : null;
      if (!rows) {
        showToast("Please upload a .csv or .xlsx file (save .xls files as .xlsx).", "danger");
        return;
      }
      const parsed = rowsToSubjects(rows).filter((r) => r.name || r.code);
      if (!parsed.length) {
        showToast(`No subject rows found in ${file.name}. Use the template columns.`, "danger");
        return;
      }
      setBulkName(file.name);
      setBulkRows(parsed);
    } catch (err) {
      console.error(err);
      showToast(`Could not read ${file.name}.`, "danger");
    }
  };
  // Preview status of each row: New / Update / problem.
  const bulkPreview = useMemo(
    () =>
      bulkRows.map((row) => {
        const code = (row.code || "").trim();
        const existing = code ? subjects.find((s) => s.code.toLowerCase() === code.toLowerCase()) : undefined;
        const resolved = row.department ? examStore.resolveSchoolDepartment(row.school || "", row.department) : null;
        const candidate = { name: row.name || "", code, school: resolved?.school || row.school || "", department: resolved?.department || row.department || "" };
        const error = examStore.validateSubjectMaster(candidate, existing?.id);
        // A code repeated inside the same file
        const dupInFile = code && bulkRows.filter((r) => (r.code || "").trim().toLowerCase() === code.toLowerCase()).length > 1;
        return { row, candidate, status: error ? "error" : existing ? "update" : "new", message: dupInFile ? `Code ${code} appears more than once in this file.` : error || "" };
      }),
    [bulkRows, subjects],
  );
  const importable = bulkPreview.filter((p) => p.status !== "error" && !p.message).length;
  const importBulk = () => {
    const rows = bulkPreview.filter((p) => p.status !== "error" && !p.message).map((p) => ({ ...p.row, school: p.candidate.school, department: p.candidate.department }));
    const result = examStore.importSubjectMaster(rows, currentUser.name);
    showToast(`${result.added} added, ${result.updated} updated${result.errors.length ? `, ${result.errors.length} skipped` : ""}.`, result.errors.length ? "danger" : "success");
    setBulkRows([]);
    setBulkName(null);
    if (fileRef.current) fileRef.current.value = "";
  };
  const downloadTemplate = () => {
    const sample = [
      ["Subject Name", "Subject Code", "Department", "School", "Semester"],
      ["Material Animation", "MATC-101", "Department of Visual Communication", "School of Fashion Design, Media and Performing Arts", "V"],
      ["Data Structures", "CS-201", "Department of Computer Science", "School of Quantum Science, Computing & AI", "III"],
    ];
    const csv = sample.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "subject-master-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- list ----------
  type ListRow = { kind: "master"; item: SubjectMasterItem } | { kind: "existing"; item: ExistingSubject };
  const allRows: ListRow[] = [
    ...subjects.map((item) => ({ kind: "master" as const, item })),
    ...existingSubjects.map((item) => ({ kind: "existing" as const, item })),
  ].sort((a, b) => a.item.name.localeCompare(b.item.name));
  const visible = allRows.filter(({ item: s }) => {
    const term = search.trim().toLowerCase();
    if (schoolFilter && s.school !== schoolFilter) return false;
    if (deptFilter && s.department !== deptFilter) return false;
    return !term || [s.name, s.code, s.department, s.school].some((v) => (v || "").toLowerCase().includes(term));
  });
  const deptCount = new Set(allRows.map((r) => r.item.department).filter(Boolean)).size;
  const schoolCount = new Set(allRows.map((r) => r.item.school).filter(Boolean)).size;

  const card: React.CSSProperties = { background: "#fffdf9", border: "1px solid #ecdfcc", borderRadius: "16px", padding: "18px 20px", boxShadow: "0 4px 16px rgba(74,47,29,0.05)" };
  const label: React.CSSProperties = { display: "block", fontSize: "12px", fontWeight: 700, color: "#5b3a22", marginBottom: "5px" };
  const input: React.CSSProperties = { width: "100%", padding: "9px 11px", borderRadius: "10px", border: "1px solid #e2cfb8", background: "#fffaf3", fontSize: "13px", color: "#2b1a10", boxSizing: "border-box" };
  const btn = (bg: string, color = "#fff", border = bg): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: "6px", padding: "9px 14px", borderRadius: "10px", border: `1px solid ${border}`, background: bg, color, fontSize: "12.5px", fontWeight: 800, cursor: "pointer" });

  return (
    <RoleGuard route="/subject-master">
      <div style={{ display: "flex", height: "100vh", maxHeight: "100vh", background: "#f4f6fb", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#0f172a", width: "100%", overflow: "hidden" }}>
        <aside className="digital-vfx-sidebar" style={{ width: "260px", background: "linear-gradient(180deg, #1c120c 0%, #120c08 100%)", color: "#94a3b8", display: "flex", flexDirection: "column", flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.06)", padding: "20px 14px", justifyContent: "space-between", height: "100vh", overflowY: "auto" }}>
          <div>
            <div style={{ padding: "6px 10px 24px 10px" }}>
              <div className="brand-orbit-logo" aria-label="Rathinam Global (Deemed to be University)"><span className="brand-orbit-mark">RG</span><span className="brand-orbit-name">Rathinam Global</span></div>
            </div>
            <nav style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {menuItems.map((item) => (
                <button key={item.id} type="button" onClick={() => item.route && router.push(item.route)} data-route={item.route} className={`sidebar-btn-3d ${item.route === "/subject-master" ? "sidebar-btn-active" : "sidebar-btn-inactive"}`}>
                  <span className="nav-icon-3d" style={{ display: "flex", alignItems: "center" }}><NavIcon route={item.route} fallback={item.icon} /></span>
                  <span style={{ flex: 1, letterSpacing: "0.2px" }}>{item.label}</span>
                  {item.badge && <span className="badge-neon-3d">{item.badge}</span>}
                </button>
              ))}
            </nav>
          </div>
          <div className="support-card-3d">
            <div className="shield-icon-3d"><Shield size={19} /></div>
            <strong style={{ display: "block", color: "#ffffff", fontSize: "13.5px", marginBottom: "4px", fontWeight: 700 }}>Subject Master</strong>
            <p style={{ fontSize: "11.5px", color: "#94a3b8", lineHeight: 1.4, margin: 0 }}>Staff uploads and question papers take the code, department and school from here.</p>
          </div>
        </aside>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
          <PortalHeader activeRoute="/subject-master" />
          <main style={{ flex: 1, padding: "24px 28px", overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* Header */}
            <div style={{ ...card, display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.12em", color: "#a0663a", textTransform: "uppercase" }}>COE · Subject master</div>
                <h1 style={{ margin: "4px 0 4px", fontSize: "24px", fontWeight: 800, color: "#2b1a10" }}>Subjects</h1>
                <p style={{ margin: 0, fontSize: "13px", color: "#7a6250", maxWidth: "640px" }}>Register each subject with its code, department and school. When staff upload a syllabus or question bank, these details are filled in automatically, and the question paper uses them.</p>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                {[["Subjects", allRows.length], ["Departments", deptCount], ["Schools", schoolCount]].map(([k, v]) => (
                  <div key={k} style={{ minWidth: "92px", textAlign: "center", padding: "10px 12px", borderRadius: "12px", background: "#fdf4ec", border: "1px solid #ecdfcc" }}>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "#5b3a22" }}>{v}</div>
                    <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#a0663a", letterSpacing: "0.06em", textTransform: "uppercase" }}>{k}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "18px", alignItems: "start" }}>
              {/* Add / edit */}
              <form onSubmit={submitForm} style={card} aria-label="Add subject">
                <h2 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 800, color: "#2b1a10", display: "flex", alignItems: "center", gap: "8px" }}>
                  {editingId || editingExisting ? <Edit3 size={16} /> : <Plus size={16} />} {editingId || editingExisting ? "Edit subject" : "Add subject"}
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <label style={{ gridColumn: "1 / -1" }}>
                    <span style={label}>Subject name *</span>
                    <input style={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Material Animation" />
                  </label>
                  <label>
                    <span style={label}>Subject code *</span>
                    <input style={{ ...input, textTransform: "uppercase" }} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. MATC-101" />
                  </label>
                  <label>
                    <span style={label}>Semester</span>
                    <select style={input} value={form.semester || ""} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
                      {SEMESTERS.map((s) => <option key={s} value={s}>{s || "Not set"}</option>)}
                    </select>
                  </label>
                  <label style={{ gridColumn: "1 / -1" }}>
                    <span style={label}>School *</span>
                    <select style={input} value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value, department: "" })} aria-label="School">
                      <option value="">Select school</option>
                      {hierarchy.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </label>
                  <label style={{ gridColumn: "1 / -1" }}>
                    <span style={label}>Department *</span>
                    <select style={input} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} disabled={!formSchool} aria-label="Department">
                      <option value="">{formSchool ? "Select department" : "Select the school first"}</option>
                      {(formSchool?.departments || []).map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                  </label>
                </div>
                {formError && <div role="alert" style={{ marginTop: "10px", padding: "8px 11px", borderRadius: "9px", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: "12.5px", fontWeight: 600 }}>{formError}</div>}
                <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
                  <button type="submit" style={btn("#5b3a22")}>{editingId || editingExisting ? <CheckCircle2 size={14} /> : <Plus size={14} />} {editingId || editingExisting ? "Save changes" : "Add subject"}</button>
                  {(editingId || editingExisting) && <button type="button" style={btn("#ffffff", "#5b3a22", "#deba9b")} onClick={() => { setEditingId(null); setEditingExisting(null); setForm(EMPTY_FORM); setFormError(null); }}><X size={14} /> Cancel</button>}
                </div>
              </form>

              {/* Bulk upload */}
              <div style={card}>
                <h2 style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 800, color: "#2b1a10", display: "flex", alignItems: "center", gap: "8px" }}><Layers size={16} /> Bulk upload</h2>
                <p style={{ margin: "0 0 12px", fontSize: "12.5px", color: "#7a6250" }}>Columns: Subject Name, Subject Code, Department, School, Semester. School can be left blank; it is taken from the department. A code that already exists updates that subject.</p>
                <button type="button" onClick={downloadTemplate} style={{ ...btn("#ffffff", "#5b3a22", "#deba9b"), marginBottom: "12px" }}><Download size={14} /> Download template (.csv)</button>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) void readBulkFile(f); }}
                  style={{ border: `2px dashed ${isDragOver ? "#a0663a" : "#deba9b"}`, borderRadius: "12px", padding: "22px", textAlign: "center", background: isDragOver ? "#fdf4ec" : "#fffaf3", cursor: "pointer" }}
                >
                  <input ref={fileRef} type="file" accept=".csv,.xlsx" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void readBulkFile(f); }} />
                  <FileUp size={24} color="#a0663a" />
                  <div style={{ marginTop: "6px", fontSize: "13px", fontWeight: 800, color: "#5b3a22" }}>{bulkName || "Click or drop a CSV / Excel (.xlsx) file"}</div>
                </div>
                {bulkPreview.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <div style={{ maxHeight: "240px", overflowY: "auto", border: "1px solid #ecdfcc", borderRadius: "10px" }}>
                      {bulkPreview.map((p, i) => (
                        <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start", padding: "7px 10px", borderTop: i ? "1px solid #f1e6d7" : "none", fontSize: "12px", background: "white" }}>
                          <span style={{ flexShrink: 0, padding: "1px 7px", borderRadius: "999px", fontWeight: 800, fontSize: "10.5px", background: p.status === "error" || p.message ? "#fef2f2" : p.status === "update" ? "#eff6ff" : "#ecfdf5", color: p.status === "error" || p.message ? "#b91c1c" : p.status === "update" ? "#1d4ed8" : "#047857" }}>
                            {p.status === "error" || p.message ? "Skip" : p.status === "update" ? "Update" : "New"}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <strong style={{ color: "#2b1a10" }}>{p.row.name || "(no name)"}</strong> <span style={{ color: "#7a6250" }}>({p.row.code || "no code"}) · {p.candidate.department || "no department"}</span>
                            {(p.message || p.status === "error") && <div style={{ color: "#b91c1c", marginTop: "2px" }}>{p.message}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: "8px", marginTop: "10px", alignItems: "center", flexWrap: "wrap" }}>
                      <button type="button" disabled={!importable} onClick={importBulk} style={{ ...btn(importable ? "#5b3a22" : "#cbb8a3"), cursor: importable ? "pointer" : "not-allowed" }}><Upload size={14} /> Import {importable} subject{importable === 1 ? "" : "s"}</button>
                      <button type="button" onClick={() => { setBulkRows([]); setBulkName(null); if (fileRef.current) fileRef.current.value = ""; }} style={btn("#ffffff", "#5b3a22", "#deba9b")}><X size={14} /> Clear</button>
                      <span style={{ fontSize: "12px", color: "#7a6250" }}>{bulkPreview.length - importable} row(s) will be skipped</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* List */}
            <div style={card}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#2b1a10", display: "flex", alignItems: "center", gap: "8px" }}><BookOpen size={16} /> Subject list ({visible.length})</h2>
                  {existingSubjects.length > 0 && (
                    <button type="button" onClick={() => void importAllExisting()} style={{ ...btn("#ffffff", "#5b3a22", "#deba9b"), padding: "6px 11px" }} title="Copy the built-in and uploaded subjects into the master so they can be managed here">
                      <Upload size={13} /> Add all existing to master ({existingSubjects.length})
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ position: "relative" }}>
                    <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#a0663a" }} />
                    <input style={{ ...input, width: "220px", paddingLeft: "30px" }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, code, department" />
                  </div>
                  <select style={{ ...input, width: "auto" }} value={schoolFilter} onChange={(e) => { setSchoolFilter(e.target.value); setDeptFilter(""); }} aria-label="Filter by school">
                    <option value="">All schools</option>
                    {hierarchy.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                  <select style={{ ...input, width: "auto" }} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} aria-label="Filter by department">
                    <option value="">All departments</option>
                    {(filterSchool ? filterSchool.departments : hierarchy.flatMap((s) => s.departments)).map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              {visible.length === 0 ? (
                <div style={{ padding: "26px", textAlign: "center", color: "#7a6250", fontSize: "13px" }}>{allRows.length ? "No subjects match the filters." : "No subjects yet. Add one above or upload a spreadsheet."}</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "760px" }}>
                    <thead>
                      <tr>
                        {["Subject", "Code", "Department", "School", "Sem.", "Source", ""].map((h) => <th key={h} style={{ textAlign: "left", padding: "9px 10px", fontSize: "11px", fontWeight: 800, color: "#a0663a", letterSpacing: "0.05em", textTransform: "uppercase", borderBottom: "1px solid #ecdfcc" }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((row) => {
                        const s = row.item;
                        const td: React.CSSProperties = { padding: "10px", borderBottom: "1px solid #f3e9dc" };
                        const badge = row.kind === "master" ? { label: "Master", bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" } : row.item.source === "Built-in" ? { label: "Built-in", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" } : { label: "From uploads", bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" };
                        return (
                          <tr key={row.kind === "master" ? row.item.id : `existing-${s.name}`}>
                            <td style={{ ...td, fontWeight: 700, color: "#2b1a10" }}>{s.name}</td>
                            <td style={td}>{s.code ? <span style={{ padding: "2px 8px", borderRadius: "6px", background: "#fdf4ec", border: "1px solid #ecdfcc", fontWeight: 800, color: "#5b3a22", fontSize: "12px" }}>{s.code}</span> : <span style={{ color: "#b91c1c", fontSize: "12px", fontWeight: 700 }}>No code</span>}</td>
                            <td style={{ ...td, color: "#5b3a22" }}>{s.department || "—"}</td>
                            <td style={{ ...td, color: "#7a6250" }}>{s.school || "—"}</td>
                            <td style={{ ...td, color: "#7a6250" }}>{s.semester || "—"}</td>
                            <td style={td}><span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 800, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, whiteSpace: "nowrap" }}>{badge.label}</span></td>
                            <td style={{ ...td, whiteSpace: "nowrap", textAlign: "right" }}>
                              <button type="button" onClick={() => (row.kind === "master" ? startEdit(row.item) : startEditExisting(row.item))} style={{ ...btn("#ffffff", "#5b3a22", "#deba9b"), padding: "6px 10px", marginRight: "6px" }} aria-label={`Edit ${s.name}`}><Edit3 size={13} /> Edit</button>
                              <button type="button" onClick={() => void (row.kind === "master" ? removeSubject(row.item) : removeExisting(row.item))} style={{ ...btn("#fff1f2", "#be123c", "#fecaca"), padding: "6px 10px" }} aria-label={`Delete ${s.name}`}><Trash2 size={13} /> Delete</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </main>
          <PortalFooter />
        </div>
        <ToastNotification message={toast.message} type={toast.type || "success"} isVisible={toast.isVisible} onClose={() => setToast((t) => ({ ...t, isVisible: false }))} />
      </div>
    </RoleGuard>
  );
}

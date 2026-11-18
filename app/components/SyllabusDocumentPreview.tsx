"use client";

import React from "react";
import { Download, FileText } from "lucide-react";

type SyllabusDocumentPreviewProps = {
  text: string;
  fileName: string;
  subject?: string;
  code?: string;
  semester?: string;
  department?: string;
  fileUrl?: string | null;
};

type DocumentSection = { title: string; lines: string[] };

function splitDocument(text: string): { overview: string[]; units: DocumentSection[] } {
  const overview: string[] = [];
  const units: DocumentSection[] = [];
  let current: DocumentSection | null = null;
  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    // A unit heading needs a unit number ("Unit 1", "UNIT III: Algebra"), so a
    // table header such as "Unit  Topic  MCQ Marks" is not mistaken for one.
    const unitHeading = /^(unit|module|chapter)\b\s*(\d+|[ivx]+)\b\s*[:.)-]?\s*(.*)$/i.exec(line.replace(/\t/g, " "));
    if (unitHeading) {
      current = { title: line.includes("\t") ? line.split("\t").map((c) => c.trim()).filter(Boolean).join(" · ") : line, lines: [] };
      units.push(current);
      return;
    }
    if (current) current.lines.push(rawLine);
    else overview.push(rawLine);
  });
  return { overview, units };
}

const isTableRow = (line: string) => line.includes("\t");

// ---- Space-aligned tables (e.g. "I  Algebra  4  16  20") ----
// Rows that end in two or more numbers are split into cells: an optional unit
// number (roman / digit), the label text, then one cell per number.
const NUMBER = /^\d+(?:\.\d+)?$/;
const UNIT_TOKEN = /^(?:[ivxlc]+|\d{1,2})[.)]?$/i;

function spacedRowCells(line: string): string[] | null {
  const tokens = line.trim().split(/\s+/);
  let firstNumber = tokens.length;
  while (firstNumber > 0 && NUMBER.test(tokens[firstNumber - 1])) firstNumber -= 1;
  const numbers = tokens.slice(firstNumber);
  const label = tokens.slice(0, firstNumber);
  if (numbers.length < 2 || label.length === 0 || label.join(" ").length > 70) return null;
  if (label.length > 1 && UNIT_TOKEN.test(label[0])) return [label[0], label.slice(1).join(" "), ...numbers];
  if (/^(grand\s+)?total$/i.test(label.join(" "))) return [label.join(" "), "", ...numbers];
  return ["", label.join(" "), ...numbers];
}

// Header cells such as "Unit | Topic | MCQ Marks | Descriptive Marks".
function headerCells(line: string): string[] | null {
  const value = line.trim();
  if (!value || /\d/.test(value) || value.length > 90) return null;
  if (!/\b(marks?|total|topics?|units?|hours?|weightage|credits?|s\.?\s?no)\b/i.test(value)) return null;
  const cells = value.match(/(?:s\.?\s?no\.?|[a-z]+\s+(?:marks?|hours?|weightage)|total(?:\s+marks)?|[a-z]+)/gi);
  return cells && cells.length >= 2 ? cells.map((cell) => cell.trim()) : null;
}

/** Turns runs of space-aligned numeric rows (with an optional header) into tab rows. */
function normaliseSpacedTables(lines: string[]): string[] {
  const out = [...lines];
  for (let i = 0; i < out.length; i += 1) {
    if (isTableRow(out[i]) || !spacedRowCells(out[i])) continue;
    let end = i;
    while (end + 1 < out.length && !isTableRow(out[end + 1]) && spacedRowCells(out[end + 1])) end += 1;
    if (end === i) continue; // a single numeric line is not a table
    const rows = out.slice(i, end + 1).map((line) => spacedRowCells(line) as string[]);
    const hasUnitColumn = rows.some((row) => row[0]);
    let start = i;
    let header = i > 0 ? headerCells(out[i - 1]) : null;
    if (header) {
      start = i - 1;
      if (!hasUnitColumn && /^units?$/i.test(header[0])) header = header.slice(1);
    }
    const tableRows = rows.map((row) => (hasUnitColumn ? row : row.slice(1)));
    const block = [...(header ? [header.join("\t")] : []), ...tableRows.map((row) => row.join("\t"))];
    out.splice(start, end - start + 1, ...block);
    i = start + block.length - 1;
  }
  return out;
}

function DocumentTable({ rows, tableKey }: { rows: string[]; tableKey: string }) {
  const cells = rows.map((row) => row.split("\t").map((cell) => cell.trim()));
  const columnCount = Math.max(...cells.map((row) => row.length));
  // A header one column short of numeric data rows (e.g. "Unit | Topic | MCQ
  // Marks | Descriptive Marks" over rows ending "4 | 16 | 20") gets "Total".
  const headerLooksLabelled = cells[0] && cells[0].every((cell) => !/^\d+(?:\.\d+)?$/.test(cell));
  if (headerLooksLabelled && cells.length > 1 && cells[0].length === columnCount - 1 && cells.slice(1).every((row) => row.length < columnCount || /^\d+(?:\.\d+)?$/.test(row[columnCount - 1]))) {
    cells[0] = [...cells[0], "Total"];
  }
  const isMarkCell = (value: string) => /^(H|M|L|[1-3]|-|–)$/i.test(value);
  const isNumber = (value: string) => /^\d+(?:\.\d+)?$/.test(value);
  return (
    <div className="syllabus-preview-table-wrap" style={{ margin: "8px 0 18px", overflowX: "auto", border: "1px solid #e3cba8", borderRadius: "10px", background: "#fffcf7", boxShadow: "0 2px 8px rgba(74, 47, 29, 0.06)" }}>
      <table className="syllabus-preview-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px", color: "#3b2a1e", fontVariantNumeric: "tabular-nums" }}>
        <tbody>
          {cells.map((row, rowIndex) => {
            const isHeader = rowIndex === 0;
            const isTotal = !isHeader && row.some((cell) => /^(grand\s+)?total$/i.test(cell));
            // Short rows that end in numbers (e.g. "TOTAL | 20 | 80 | 100") keep
            // their numbers under the right-hand columns.
            const short = row.length < columnCount;
            let padded = short && !isHeader && isNumber(row[row.length - 1] || "")
              ? [row[0], ...Array(columnCount - row.length).fill(""), ...row.slice(1)]
              : [...row, ...Array(columnCount - row.length).fill("")];
            // "TOTAL" spans the label columns (Unit + Topic).
            const spanTotal = isTotal && columnCount >= 3 && /^(grand\s+)?total$/i.test(padded[0]) && padded[1] === "";
            if (spanTotal) padded = [padded[0], ...padded.slice(2)];
            const rowBackground = isHeader ? "linear-gradient(135deg, #6b4226 0%, #8b5a2b 100%)" : isTotal ? "#f3e3cc" : rowIndex % 2 === 0 ? "#fbf6ee" : "#fffcf7";
            return (
              <tr key={`${tableKey}-r${rowIndex}`} style={{ background: rowBackground }}>
                {padded.map((cell, cellIndex) => {
                  const Tag = isHeader ? "th" : "td";
                  const isSpanCell = spanTotal && cellIndex === 0;
                  const centered = isSpanCell || (isHeader ? cellIndex !== 1 || columnCount < 3 : isNumber(cell) || isMarkCell(cell) || (cell.length <= 4 && cellIndex > 0));
                  return (
                    <Tag
                      key={`${tableKey}-r${rowIndex}-c${cellIndex}`}
                      colSpan={isSpanCell ? 2 : undefined}
                      style={{
                        padding: isHeader ? "9px 12px" : "8px 12px",
                        borderBottom: "1px solid #ecdfcc",
                        borderRight: cellIndex < padded.length - 1 ? "1px solid #ecdfcc" : "none",
                        borderTop: isTotal ? "2px solid #c9a27a" : undefined,
                        textAlign: centered ? "center" : "left",
                        verticalAlign: "middle",
                        fontWeight: isHeader ? 800 : isTotal ? 800 : cellIndex === 0 ? 700 : 500,
                        color: isHeader ? "#fff8ec" : isTotal ? "#4a2f1d" : cellIndex === 0 ? "#6b4226" : "#3b2a1e",
                        fontSize: isHeader ? "11px" : "12.5px",
                        letterSpacing: isHeader ? "0.06em" : "normal",
                        textTransform: isHeader ? "uppercase" : "none",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        lineHeight: 1.5,
                      }}
                    >
                      {cell}
                    </Tag>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DocumentLines({ lines: rawLines, startIndex = 0 }: { lines: string[]; startIndex?: number }) {
  const lines = normaliseSpacedTables(rawLines);
  let topicNumber = 0;
  let outcomeNumber = 0;
  return (
    <div>
      {lines.map((rawLine, index) => {
        if (isTableRow(rawLine)) {
          if (index > 0 && isTableRow(lines[index - 1])) return null;
          let end = index;
          while (end + 1 < lines.length && isTableRow(lines[end + 1])) end += 1;
          return <DocumentTable key={`table-${startIndex}-${index}`} rows={lines.slice(index, end + 1)} tableKey={`t-${startIndex}-${index}`} />;
        }
        const value = rawLine.trim();
        if (!value) return <div key={`space-${startIndex}-${index}`} style={{ height: "8px" }} />;
        const isOutcome = /^CO\s*\d+\s*[:.)-]?/i.test(value);
        // All-caps lines such as "UNIT-WISE MARK DISTRIBUTION" are section headings.
        const isCapsHeading = value.length <= 70 && /[A-Z]{3}/.test(value) && value === value.toUpperCase() && !/^CO\s*\d/i.test(value);
        const isLabel = isCapsHeading || /^(subject code|programme|level|course type|suggested credits|suggested contact hours|semester|department|course objectives?|course outcomes?|topics?|references?|prerequisites?|assessment|textbooks?)\s*:?$/i.test(value);
        const isNote = /^(prepared from|note\s*[:.)-]?|source\s*[:.)-]?|document\s*[:.)-]?|academic year|version\s*[:.)-]?|remarks?\s*[:.)-]?)/i.test(value);
        const isTopic = !isLabel && !isNote && !isOutcome && value.length > 25;
        if (isOutcome) outcomeNumber += 1;
        if (isTopic) topicNumber += 1;
        const displayValue = isOutcome ? value.replace(/^CO\s*\d+\s*[:.)-]?\s*/i, "") : value;
        return (
          <div key={`${startIndex}-${index}-${value}`} className={`syllabus-preview-line${isTopic ? " is-topic" : ""}${isOutcome ? " is-outcome" : ""}${isLabel ? " is-label" : ""}`} style={{ display: "flex", alignItems: "flex-start", gap: isTopic || isOutcome ? "10px" : 0, marginBottom: isLabel ? "6px" : "10px", padding: isLabel ? "7px 10px" : isTopic || isOutcome ? "6px 9px" : 0, borderLeft: isLabel ? "3px solid #deba9b" : isTopic || isOutcome ? "3px solid #c7d2fe" : "none", borderBottom: isLabel ? "1px solid #dbe3ee" : "none", borderRadius: isTopic || isOutcome ? "6px" : 0, background: isLabel ? "#f8faff" : isTopic || isOutcome ? "#fbfdff" : "transparent", color: isLabel ? "#c07d42" : "#334155", fontSize: isLabel ? "11px" : "13px", fontWeight: isLabel ? 800 : 500, letterSpacing: isLabel ? "0.05em" : "normal", textTransform: isLabel ? "uppercase" : "none", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {(isTopic || isOutcome) && <span style={{ flex: "0 0 28px", display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: "22px", borderRadius: "6px", background: isOutcome ? "#dcfce7" : "#e0e7ff", color: isOutcome ? "#166534" : "#c07d42", fontSize: "10px", fontWeight: 800 }}>{isOutcome ? `CO${outcomeNumber}` : topicNumber}</span>}
            <span style={{ flex: 1 }}>{displayValue}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function SyllabusDocumentPreview({ text, fileName, subject, code, semester, department, fileUrl }: SyllabusDocumentPreviewProps) {
  const { overview, units } = splitDocument(text);
  return (
    <div className="syllabus-preview-stage" style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "28px 20px 48px", background: "linear-gradient(135deg, #e8edf5 0%, #f8fafc 55%, #e9eef8 100%)" }}>
      <div className="syllabus-preview-document" style={{ maxWidth: "900px", margin: "0 auto", background: "#ffffff", border: "1px solid #dbe3ee", borderRadius: "8px", boxShadow: "0 12px 30px rgba(40, 26, 17, 0.12)", overflow: "hidden" }}>
        <div style={{ padding: "30px 38px 24px", borderBottom: "1px solid #dbe3ee", background: "linear-gradient(135deg, #f8fafc, #eef2ff)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#d4a780", fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}><FileText size={15} /> Official Academic Document</div>
            <div style={{ padding: "5px 9px", borderRadius: "999px", background: "#e0e7ff", color: "#c07d42", fontSize: "10px", fontWeight: 800 }}>FULL PREVIEW</div>
          </div>
          <div style={{ fontSize: "24px", fontWeight: 850, lineHeight: 1.25, color: "#4c311f" }}>{subject || "Syllabus Document"}</div>
          <div style={{ marginTop: "7px", fontSize: "12px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginTop: "20px" }}>
            {[["COURSE CODE", code || "—"], ["SEMESTER", semester || "—"], ["DEPARTMENT", department || "—"], ["UNITS", String(units.length || 1)]].map(([label, value]) => <div key={label} style={{ padding: "9px 10px", borderRadius: "9px", background: "rgba(255,255,255,0.72)", border: "1px solid #dbe3ee" }}><div style={{ fontSize: "9px", color: "#94a3b8", fontWeight: 800, letterSpacing: "0.07em" }}>{label}</div><div style={{ marginTop: "3px", color: "#334155", fontSize: "11px", fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div></div>)}
          </div>
          {fileUrl && <a href={fileUrl} download={fileName} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "14px", color: "#c07d42", fontSize: "11px", fontWeight: 800, textDecoration: "none" }}><Download size={14} /> Open / download original Word document</a>}
        </div>
        <div style={{ padding: "28px 38px 44px", fontFamily: "Arial, sans-serif" }}>
          {units.length > 0 && <div className="syllabus-preview-unit-nav" style={{ position: "sticky", top: 0, zIndex: 5, display: "grid", gridTemplateColumns: `repeat(${Math.min(units.length, 5)}, minmax(0, 1fr))`, gap: "7px", marginBottom: "20px", padding: "9px", border: "1px solid #c7d2fe", borderRadius: "11px", background: "rgba(252, 250, 248,0.94)", backdropFilter: "blur(8px)" }}>
            {units.slice(0, 5).map((unit, index) => <a className="syllabus-preview-unit-link" key={`unit-link-${index}`} href={`#syllabus-unit-${index + 1}`} style={{ padding: "8px 5px", borderRadius: "8px", background: "#eef2ff", color: "#c07d42", fontSize: "10px", fontWeight: 850, textAlign: "center", textDecoration: "none", border: "1px solid #c7d2fe" }}>UNIT {index + 1}</a>)}
          </div>}
          {overview.some((line) => line.trim()) && <section style={{ padding: "16px", marginBottom: "18px", border: "1px solid #dbe3ee", borderRadius: "10px", background: "#ffffff" }}><div style={{ marginBottom: "12px", color: "#7e512a", fontSize: "13px", fontWeight: 850, letterSpacing: "0.08em", textTransform: "uppercase" }}>Course Overview</div><DocumentLines lines={overview} startIndex={0} /></section>}
          {units.map((unit, index) => <section className="syllabus-preview-unit-card" id={`syllabus-unit-${index + 1}`} key={`${unit.title}-${index}`} style={{ scrollMarginTop: "70px", marginTop: "18px", padding: "18px", border: "1px solid #c7d2fe", borderRadius: "12px", background: "linear-gradient(180deg, #ffffff 0%, #f8faff 100%)", boxShadow: "0 4px 14px rgba(202, 146, 97, 0.07)" }}><div className="syllabus-preview-unit-heading" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", padding: "12px 14px", borderLeft: "5px solid #ca9261", borderRadius: "8px", background: "linear-gradient(135deg, #eef2ff, #f8fafc)", color: "#81552e" }}><span style={{ display: "grid", placeItems: "center", width: "28px", height: "28px", borderRadius: "8px", background: "#ca9261", color: "#ffffff", fontSize: "12px", fontWeight: 850 }}>{String(index + 1).padStart(2, "0")}</span><span style={{ fontSize: "15px", fontWeight: 850, letterSpacing: "0.04em", textTransform: "uppercase" }}>{unit.title}</span></div><DocumentLines lines={unit.lines} startIndex={index + 1} /></section>)}
          {!overview.some((line) => line.trim()) && units.length === 0 && <DocumentLines lines={text.split(/\r?\n/)} />}
        </div>
      </div>
    </div>
  );
}

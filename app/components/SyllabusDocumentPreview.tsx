"use client";

import React, { useEffect, useRef, useState } from "react";
import { BookOpen, Download, FileText, Layers, ListChecks } from "lucide-react";

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

/** Splits the document text into an overview and one section per unit. */
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

/** "UNIT III: Mass Media Advertising" -> { label: "Unit 3", title: "Mass Media Advertising" } */
function unitParts(title: string, index: number): { label: string; title: string } {
  const match = /^(?:unit|module|chapter)\b\s*(?:\d+|[ivx]+)\b\s*[:.)\-–—·]*\s*(.*)$/i.exec(title.replace(/\t/g, " "));
  const rest = (match?.[1] || "").replace(/^[·\s]+/, "").trim();
  return { label: `Unit ${index + 1}`, title: rest || title };
}

const isTableRow = (line: string) => line.includes("\t");

// ---- Space-aligned tables (e.g. "I  Algebra  4  16  20") ----
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
    if (end === i) continue;
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
  const headerLooksLabelled = cells[0] && cells[0].every((cell) => !/^\d+(?:\.\d+)?$/.test(cell));
  if (headerLooksLabelled && cells.length > 1 && cells[0].length === columnCount - 1 && cells.slice(1).every((row) => row.length < columnCount || /^\d+(?:\.\d+)?$/.test(row[columnCount - 1]))) {
    cells[0] = [...cells[0], "Total"];
  }
  const isNumber = (value: string) => /^\d+(?:\.\d+)?$/.test(value);
  const isShort = (value: string) => value.length <= 4;
  return (
    <div className="spv-table-wrap">
      <table className="spv-table">
        <tbody>
          {cells.map((row, rowIndex) => {
            const isHeader = rowIndex === 0 && headerLooksLabelled;
            const isTotal = !isHeader && row.some((cell) => /^(grand\s+)?total$/i.test(cell));
            const short = row.length < columnCount;
            let padded = short && !isHeader && isNumber(row[row.length - 1] || "")
              ? [row[0], ...Array(columnCount - row.length).fill(""), ...row.slice(1)]
              : [...row, ...Array(columnCount - row.length).fill("")];
            const spanTotal = isTotal && columnCount >= 3 && /^(grand\s+)?total$/i.test(padded[0]) && padded[1] === "";
            if (spanTotal) padded = [padded[0], ...padded.slice(2)];
            return (
              <tr key={`${tableKey}-r${rowIndex}`} className={isHeader ? "is-head" : isTotal ? "is-total" : undefined}>
                {padded.map((cell, cellIndex) => {
                  const Tag = isHeader ? "th" : "td";
                  const isSpanCell = spanTotal && cellIndex === 0;
                  const centered = isSpanCell || (isHeader ? columnCount < 3 || cellIndex !== 1 : isNumber(cell) || (isShort(cell) && cellIndex > 0));
                  return (
                    <Tag key={`${tableKey}-r${rowIndex}-c${cellIndex}`} colSpan={isSpanCell ? 2 : undefined} style={{ textAlign: centered ? "center" : "left" }}>
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

/** Renders a run of document lines as headings, numbered topics, outcomes and tables. */
function DocumentLines({ lines: rawLines, startIndex = 0 }: { lines: string[]; startIndex?: number }) {
  const lines = normaliseSpacedTables(rawLines);
  let topicNumber = 0;
  return (
    <div className="spv-lines">
      {lines.map((rawLine, index) => {
        if (isTableRow(rawLine)) {
          if (index > 0 && isTableRow(lines[index - 1])) return null;
          let end = index;
          while (end + 1 < lines.length && isTableRow(lines[end + 1])) end += 1;
          return <DocumentTable key={`table-${startIndex}-${index}`} rows={lines.slice(index, end + 1)} tableKey={`t-${startIndex}-${index}`} />;
        }
        const value = rawLine.trim();
        if (!value) return null;
        const outcome = /^(CO\s*\d+)\s*[:.)\-–—]?\s*(.*)$/i.exec(value);
        const isCapsHeading = value.length <= 70 && /[A-Z]{3}/.test(value) && value === value.toUpperCase() && !outcome;
        const isLabel = isCapsHeading || /^(subject code|programme|level|course type|suggested credits|suggested contact hours|semester|department|course objectives?|course outcomes?|topics?|references?|reference books?|text\s*books?|prerequisites?|assessment|learning outcomes?|objectives?)\s*:?$/i.test(value);
        const isNote = /^(prepared from|note\s*[:.)-]?|source\s*[:.)-]?|document\s*[:.)-]?|academic year|version\s*[:.)-]?|remarks?\s*[:.)-]?)/i.test(value);
        const isTopic = !isLabel && !isNote && !outcome && value.length > 25;
        const key = `${startIndex}-${index}`;
        if (outcome) {
          return (
            <div key={key} className="spv-outcome">
              <span className="spv-co">{outcome[1].replace(/\s+/g, "").toUpperCase()}</span>
              <span>{outcome[2] || value}</span>
            </div>
          );
        }
        if (isLabel) return <h4 key={key} className="spv-label">{value.replace(/:\s*$/, "")}</h4>;
        if (isTopic) {
          topicNumber += 1;
          return (
            <div key={key} className="spv-topic">
              <span className="spv-topic-no">{topicNumber}</span>
              <span>{value}</span>
            </div>
          );
        }
        return <p key={key} className={isNote ? "spv-note" : "spv-text"}>{value}</p>;
      })}
    </div>
  );
}

export default function SyllabusDocumentPreview({ text, fileName, subject, code, semester, department, fileUrl }: SyllabusDocumentPreviewProps) {
  const { overview, units } = splitDocument(text || "");
  const hasOverview = overview.some((line) => line.trim());
  const stageRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState(hasOverview ? "spv-overview" : "spv-unit-1");

  // Highlight the section currently in view in the contents list.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const sections = Array.from(stage.querySelectorAll<HTMLElement>("[data-spv-section]"));
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { root: stage, rootMargin: "0px 0px -60% 0px", threshold: 0 },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [text]);

  const jumpTo = (id: string) => {
    const stage = stageRef.current;
    const target = stage?.querySelector<HTMLElement>(`#${id}`);
    if (stage && target) stage.scrollTo({ top: target.offsetTop - 16, behavior: "smooth" });
    setActiveId(id);
  };

  const contents = [
    ...(hasOverview ? [{ id: "spv-overview", label: "Overview", title: "Course details" }] : []),
    ...units.map((unit, index) => ({ id: `spv-unit-${index + 1}`, ...unitParts(unit.title, index) })),
  ];
  const meta = [
    ["Course code", code || "—"],
    ["Semester", semester || "—"],
    ["Department", department || "—"],
    ["Units", String(units.length || "—")],
  ];

  return (
    <div ref={stageRef} className="spv-stage">
      <article className="spv-doc">
        {/* ---------- Header ---------- */}
        <header className="spv-header">
          <div className="spv-header-top">
            <span className="spv-kicker">
              <FileText size={14} /> Syllabus
            </span>
            {fileUrl && (
              <a className="spv-download" href={fileUrl} download={fileName} target="_blank" rel="noreferrer">
                <Download size={15} /> Download original
              </a>
            )}
          </div>
          <h2 className="spv-title">{subject || "Syllabus Document"}</h2>
          <div className="spv-file" title={fileName}>{fileName}</div>
          <dl className="spv-meta">
            {meta.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <div className={`spv-body${contents.length > 1 ? " has-nav" : ""}`}>
          {/* ---------- Contents ---------- */}
          {contents.length > 1 && (
            <nav className="spv-nav" aria-label="Syllabus contents">
              <div className="spv-nav-title">
                <ListChecks size={14} /> Contents
              </div>
              {contents.map((item) => (
                <button key={item.id} type="button" className={`spv-nav-item${activeId === item.id ? " is-active" : ""}`} onClick={() => jumpTo(item.id)}>
                  <span className="spv-nav-label">{item.label}</span>
                  <span className="spv-nav-sub">{item.title}</span>
                </button>
              ))}
            </nav>
          )}

          {/* ---------- Content ---------- */}
          <div className="spv-content">
            {hasOverview && (
              <section id="spv-overview" data-spv-section className="spv-section">
                <div className="spv-section-head">
                  <span className="spv-section-icon"><BookOpen size={15} /></span>
                  <div>
                    <div className="spv-section-label">Overview</div>
                    <div className="spv-section-title">Course details</div>
                  </div>
                </div>
                <DocumentLines lines={overview} startIndex={0} />
              </section>
            )}
            {units.map((unit, index) => {
              const parts = unitParts(unit.title, index);
              return (
                <section key={`${unit.title}-${index}`} id={`spv-unit-${index + 1}`} data-spv-section className="spv-section">
                  <div className="spv-section-head">
                    <span className="spv-section-icon is-unit">{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <div className="spv-section-label">{parts.label}</div>
                      <div className="spv-section-title">{parts.title}</div>
                    </div>
                  </div>
                  <DocumentLines lines={unit.lines} startIndex={index + 1} />
                </section>
              );
            })}
            {!hasOverview && units.length === 0 && (
              <section className="spv-section">
                <div className="spv-section-head">
                  <span className="spv-section-icon"><Layers size={15} /></span>
                  <div>
                    <div className="spv-section-label">Document</div>
                    <div className="spv-section-title">Full text</div>
                  </div>
                </div>
                {text.trim() ? <DocumentLines lines={text.split(/\r?\n/)} /> : <p className="spv-text">No readable text was found in this document.</p>}
              </section>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}

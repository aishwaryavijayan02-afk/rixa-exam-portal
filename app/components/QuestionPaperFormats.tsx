"use client";

import React from "react";

export type PaperFormat = "table" | "plain";

export const PAPER_FORMATS: { id: PaperFormat; name: string; description: string }[] = [
  { id: "table", name: "Format 1 · Table", description: "Q.No, Question, Course Outcome and Knowledge Level in a ruled table, with (OR) rows." },
  { id: "plain", name: "Format 2 · Plain", description: "Questions as running text with (CO) [K] at the end and (OR) on the right." },
];

export type PaperRow =
  | { kind: "q"; key: string; no: string; text: string; options: string[]; image?: string; caption?: string; co: string; k: string }
  | { kind: "or"; key: string };

export interface PaperSection {
  letter: string;
  heading: string; // e.g. "SECTION A - (10 x 10 = 100)"
  rows: PaperRow[];
}

export interface PaperHeaderInfo {
  qpCode: string;
  examTitle: string; // "END SEMESTER EXAMINATIONS, NOVEMBER - 2026"
  semester: string; // "III"
  degree: string;
  subject: string;
  subjectCode: string;
  duration: string;
  maxMarks: number;
}

const FONT = "'Bookman Old Style', 'Times New Roman', Times, serif";

/**
 * Point sizes of the official Word question paper (Bookman Old Style).
 * pt is used on screen and in print, so the live preview matches the paper.
 */
const PT = {
  qpCode: "9pt",
  regNo: "11pt",
  university: "13pt",
  headerLine: "12pt",
  meta: "12pt",
  section: "12pt",
  answerAll: "11pt",
  tableHead: "11pt",
  tableBody: "11pt",
  plainBody: "12pt",
  or: "11pt",
  caption: "9pt",
} as const;

function PaperHeader({ info }: { info: PaperHeaderInfo }) {
  const line: React.CSSProperties = { fontWeight: 700, fontSize: PT.headerLine, lineHeight: 1.35, textTransform: "uppercase" };
  return (
    <div style={{ fontFamily: FONT, color: "#000" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "2px" }}>
        <span style={{ border: "1px dashed #000", padding: "1px 8px", fontSize: PT.qpCode, fontWeight: 700 }}>QP CODE{info.qpCode ? `: ${info.qpCode}` : ""}</span>
      </div>
      <div style={{ textAlign: "right", fontSize: PT.regNo, fontWeight: 700, margin: "4pt 0 6pt" }}>Reg. No.: ........................</div>
      <div style={{ textAlign: "center" }}>
        <div style={{ ...line, fontSize: PT.university }}>RATHINAM GLOBAL (DEEMED TO BE UNIVERSITY)</div>
        <div style={{ ...line, textTransform: "none" }}>Eachanari, Coimbatore - 21</div>
        <div style={line}>{info.examTitle}</div>
        <div style={line}>SEMESTER- {info.semester || "—"}</div>
        <div style={line}>DEGREE: {info.degree || "—"}</div>
        <div style={line}>SUBJECT: {info.subject || "—"}</div>
        <div style={line}>SUBJECT CODE: {info.subjectCode || "—"}</div>
      </div>
      <div className="paper-meta-row" style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: PT.meta, margin: "8pt 0 4pt" }}>
        <span>Time: {info.duration}</span>
        <span>Maximum: {info.maxMarks} Marks</span>
      </div>
    </div>
  );
}

function SectionHeading({ heading }: { heading: string }) {
  return (
    <div className="part-header" style={{ textAlign: "center", fontFamily: FONT, color: "#000", margin: "8pt 0 6pt", lineHeight: 1.35 }}>
      <div style={{ fontWeight: 700, fontSize: PT.section, textDecoration: "underline" }}>{heading}</div>
      <div style={{ fontWeight: 700, fontSize: PT.answerAll }}>(ANSWER ALL QUESTIONS)</div>
    </div>
  );
}

function QuestionBody({ row }: { row: Extract<PaperRow, { kind: "q" }> }) {
  return (
    <>
      <div style={{ whiteSpace: "pre-wrap", textAlign: "justify" }}>{row.text}</div>
      {row.options.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 16px", marginTop: "4px" }}>
          {row.options.map((opt, i) => (
            <div key={i}>({String.fromCharCode(97 + i)}) {opt}</div>
          ))}
        </div>
      )}
      {row.image && (
        <figure style={{ margin: "6px 0 0", textAlign: "center" }}>
          <img src={row.image} alt={row.caption || "Figure"} style={{ maxWidth: "100%", maxHeight: "170px", objectFit: "contain" }} />
          {row.caption && <figcaption style={{ fontSize: PT.caption, fontStyle: "italic" }}>{row.caption}</figcaption>}
        </figure>
      )}
    </>
  );
}

/** Groups rows into "A (OR) B" pairs (single questions stay alone). */
function groupPairs(rows: PaperRow[]): PaperRow[][] {
  const groups: PaperRow[][] = [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].kind === "q" && rows[i + 1]?.kind === "or" && rows[i + 2]) {
      groups.push([rows[i], rows[i + 1], rows[i + 2]]);
      i += 2;
    } else groups.push([rows[i]]);
  }
  return groups;
}

/** Format 1: ruled table with Q.No / Question / Course Outcome / Knowledge Level. */
function TableSection({ section }: { section: PaperSection }) {
  const cell: React.CSSProperties = { border: "1px solid #000", padding: "3pt 5pt", verticalAlign: "top", background: "white", color: "#000", fontSize: PT.tableBody, lineHeight: 1.3 };
  // Plain ruled lines: override the app theme (beige header cells, rounded tables).
  // "white" (not #ffffff): the theme repaints inline rgb(255, 255, 255) backgrounds cream.
  const head: React.CSSProperties = { ...cell, fontWeight: 700, fontSize: PT.tableHead, textAlign: "center", verticalAlign: "middle", background: "white", color: "#000" };
  return (
    <section style={{ marginBottom: "10px" }}>
      <SectionHeading heading={section.heading} />
      <table style={{ width: "100%", maxWidth: "100%", minWidth: 0, borderCollapse: "collapse", borderRadius: 0, overflow: "visible", background: "white", fontFamily: FONT, fontSize: PT.tableBody, color: "#000" }}>
        <thead style={{ background: "white" }}>
          <tr style={{ background: "white" }}>
            <th style={{ ...head, width: "10%" }}>Q. No.</th>
            <th style={head}>Question</th>
            <th style={{ ...head, width: "12%" }}>Course Outcome</th>
            <th style={{ ...head, width: "12%" }}>Knowledge Level</th>
          </tr>
        </thead>
        {groupPairs(section.rows).map((group) => (
          // One tbody per either/or pair so "1.A (OR) 1.B" is never split across pages.
          <tbody key={group[0].key} style={{ breakInside: "avoid", pageBreakInside: "avoid", background: "white" }}>
            {group.map((row) =>
              row.kind === "or" ? (
                <tr key={row.key} className="question-block" style={{ background: "white" }}>
                  <td colSpan={4} style={{ ...cell, textAlign: "center", fontWeight: 700, fontSize: PT.or, padding: "1pt 3pt" }}>(OR)</td>
                </tr>
              ) : (
                <tr key={row.key} className="question-block" style={{ background: "white" }}>
                  <td style={{ ...cell, textAlign: "center" }}>{row.no}</td>
                  <td style={cell}><QuestionBody row={row} /></td>
                  <td style={{ ...cell, textAlign: "center" }}>{row.co}</td>
                  <td style={{ ...cell, textAlign: "center" }}>{row.k}</td>
                </tr>
              ),
            )}
          </tbody>
        ))}
      </table>
    </section>
  );
}

/** Format 2: running text, "(CO1) [K2]" after each question, (OR) on the right. */
function PlainSection({ section }: { section: PaperSection }) {
  return (
    <section style={{ marginBottom: "10px", fontFamily: FONT, fontSize: PT.plainBody, color: "#000" }}>
      <SectionHeading heading={section.heading} />
      {groupPairs(section.rows).map((group) => (
        // Keep "1.A (OR) 1.B" together on one page.
        <div key={group[0].key} style={{ breakInside: "avoid", pageBreakInside: "avoid", paddingBottom: "10pt" }}>
          {group.map((row) =>
            row.kind === "or" ? (
              <div key={row.key} style={{ textAlign: "right", fontWeight: 700, fontSize: PT.or, margin: "0 0 4pt" }}>(OR)</div>
            ) : (
              <div key={row.key} className="question-block" style={{ display: "flex", gap: "6pt", paddingBottom: "2pt", lineHeight: 1.35 }}>
                <span style={{ flex: "0 0 auto", minWidth: "30pt" }}>{row.no}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ textAlign: "justify" }}>
                    {row.text} ({row.co}) [{row.k}]
                  </div>
                  {(row.options.length > 0 || row.image) && <QuestionBody row={{ ...row, text: "" }} />}
                </div>
              </div>
            ),
          )}
        </div>
      ))}
    </section>
  );
}

/** The printable question paper in the chosen format. */
export default function QuestionPaperFormat({ format, header, sections }: { format: PaperFormat; header: PaperHeaderInfo; sections: PaperSection[] }) {
  return (
    <div style={{ fontFamily: FONT, color: "#000" }}>
      <PaperHeader info={header} />
      {sections.map((s) => (format === "table" ? <TableSection key={s.letter} section={s} /> : <PlainSection key={s.letter} section={s} />))}
    </div>
  );
}

/** Small picture of each format for the "which format?" chooser. */
export function FormatThumbnail({ format }: { format: PaperFormat }) {
  const bar = (w: string, h = 4, extra: React.CSSProperties = {}) => <div style={{ width: w, height: h, background: "#5b3a22", borderRadius: 2, opacity: 0.75, ...extra }} />;
  return (
    <div style={{ width: "100%", aspectRatio: "0.72", background: "#fff", border: "1.5px dotted #5b3a22", borderRadius: 6, padding: "10px 9px", display: "flex", flexDirection: "column", gap: 4, boxSizing: "border-box" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        {bar("70%", 5)}
        {bar("45%")}
        {bar("55%")}
        {bar("40%")}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", margin: "3px 0" }}>{bar("22%")}{bar("26%")}</div>
      <div style={{ alignSelf: "center" }}>{bar("38px", 4)}</div>
      {format === "table" ? (
        <div style={{ border: "1px solid #5b3a22", display: "flex", flexDirection: "column" }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "14% 1fr 14% 14%", borderTop: i ? "1px solid #5b3a22" : "none", minHeight: i % 2 ? 6 : 13 }}>
              {i % 2 ? <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center", alignItems: "center" }}>{bar("16%", 2)}</div> : [0, 1, 2, 3].map((c) => <div key={c} style={{ borderLeft: c ? "1px solid #5b3a22" : "none", padding: 2 }}>{c === 1 ? bar("85%", 3) : null}</div>)}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {[0, 1, 2, 3].map((i) => (
            <React.Fragment key={i}>
              {bar("96%", 3)}
              {bar("70%", 3)}
              <div style={{ alignSelf: "flex-end" }}>{bar("14px", 3)}</div>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Degree / programme names offered by the university (copied from the
 * School page's programme lists, app/subjects/page.tsx RATHINAM_SCHOOLS).
 * Used to fill "DEGREE:" on the printed question paper from a subject's
 * department. Keep in sync when programmes are added there.
 */
export const UNIVERSITY_PROGRAMMES: string[] = [
  "B.Sc Artificial Intelligence and Machine Learning",
  "B.Sc Computer Science",
  "B.Sc Computer Science (AI & Data Science)",
  "B.Sc Computer Science (Artificial Intelligence)",
  "B.Sc Computer Science (Cyber Security)",
  "B.Sc Computer Technology (Generative AI)",
  "B.Sc Digital and Cyber Forensics Science",
  "B.Sc Information Technology",
  "BCA",
  "BCA (Artificial Intelligence)",
  "M.Sc Artificial Intelligence and Data Science",
  "M.Sc Computer Science",
  "M.Sc Data Science and Business Analytics",
  "BBA General",
  "BBA Aviation Management",
  "BBA Computer Applications",
  "BBA Logistics",
  "B.Com Accounting & Finance",
  "B.Com Banking & Insurance",
  "B.Com Business Process Services",
  "B.Com Corporate Secretorship",
  "B.Com Financial Services",
  "B.Com Information Technology",
  "B.Com International Business",
  "B.Com Professional Accounting",
  "B.Com Professional Accounting (CA Training)",
  "B.Com Computer Applications (Business Intelligence & AI)",
  "B.Com Computer Applications (AI-Ready Accountant)",
  "B.Com Financial Services (AI-Ready Account Analyst)",
  "B.Com Financial Services (Public Accountant)",
  "B.Com IT (Accounting Analytics)",
  "B.Com International Business (AI-Ready Business Analyst)",
  "B.Com Professional Accounting (Chartered Accountant)",
  "B.Com (AI-Ready Accountant)",
  "B.Com (ACCA)",
  "M.Com Computer Applications (AI-Ready Accountant)",
  "M.Com General (Guaranteed Internship)",
  "B.Sc Psychology",
  "B.Sc MicroBiology with GIP",
  "M.Sc Applied Psychology",
  "M.Sc Clinical Psychology",
  "B.Sc Visual Communication",
  "B.Sc Animation & VFX",
  "B.Sc Digital Media Production",
  "B.Sc Fashion Apparel Design",
  "B.Sc Costume Design & Fashion",
  "B.Sc Textile Science",
  "M.Sc Visual Communication",
  "M.Sc Costume Design & Fashion",
  "M.Sc Fashion Technology",
  "B.Sc Mathematics",
  "B.Sc Physics",
  "B.A English Literature",
  "M.A English Literature",
  "M.A Public Administration",
  "M.Sc Mathematics",
  "M.Sc Counselling Psychology",
  "Post Graduate Diploma in Counselling",
  "B.Tech BioTechnology",
  "B.Sc Biotechnology",
  "B.Sc Microbiology",
  "M.Sc Microbiology",
  "M.Sc BioTechnology",
  "B.Sc Environmental Science & Sustainability",
  "M.Sc Climate Change & Policy"
];

// Degree abbreviation at the start of a programme name: "B.Sc ", "M.A. ", "MBA ", "B.Tech " ...
const DEGREE_PREFIX = /^(?:b\.?\s?sc|m\.?\s?sc|b\.?\s?a|m\.?\s?a|b\.?\s?com|m\.?\s?com|b\.?\s?b\.?\s?a|m\.?\s?b\.?\s?a|b\.?\s?c\.?\s?a|m\.?\s?c\.?\s?a|b\.?\s?des|m\.?\s?des|b\.?\s?tech|m\.?\s?tech|b\.?\s?e|m\.?\s?e|b\.?\s?voc|ph\.?\s?d)\.?\s+/i;
const norm = (value: string) => value.toLowerCase().replace(/^(?:department|dept\.?)\s+of\s+/, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Best programme for a department, e.g. "Visual Communication" ->
 * "B.Sc Visual Communication". Exact subject-area match first, then a
 * programme whose name contains the department (or the other way round).
 * Undergraduate programmes come first in the list, so they win ties.
 */
export function degreeForDepartment(department: string): string {
  const dept = norm(department || "");
  if (dept.length < 3) return "";
  const withCore = UNIVERSITY_PROGRAMMES.map((name) => ({ name, core: norm(name.replace(DEGREE_PREFIX, "")) }));
  return (
    withCore.find((p) => p.core === dept)?.name ||
    withCore.find((p) => p.core.includes(dept) || (p.core.length > 5 && dept.includes(p.core)))?.name ||
    ""
  );
}

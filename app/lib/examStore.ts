"use client";

import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { canAllocateFaculty, AllocationLevel } from "./auth";

// Types
export interface SubjectItem {
  id: string;
  name: string;
  code: string;
  dotColor?: string;
  totalQuestions: number;
  total?: number;
  completed?: string | number;
  approved?: string | number;
  pending?: number;
  verified?: number;
  status: "In Progress" | "Completed" | "Pending" | "Archived" | "Not Started";
  category?: string;
  credits: number;
  semester?: string;
  department?: string;
  school?: string;
}

export interface SyllabusUnit {
  id: string;
  num: string;
  name: string;
  topics: number;
  docs: number;
  subject: string;
  subtopics?: string[];
  coMapping?: string[];
  description?: string;
}

// Sample SVG Diagrams for visual questions
export const SAMPLE_DIAGRAM_AR_PIPELINE = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 280" width="600" height="280"><rect width="600" height="280" fill="%230f172a" rx="16"/><text x="300" y="38" fill="%2338bdf8" font-size="15" font-family="sans-serif" text-anchor="middle" font-weight="bold">Figure 1.1: AR Spatial Feature Tracking &amp; Rendering Pipeline</text><rect x="30" y="85" width="115" height="75" rx="10" fill="%231e293b" stroke="%2338bdf8" stroke-width="2"/><text x="87" y="118" fill="%23f8fafc" font-size="13" font-family="sans-serif" text-anchor="middle" font-weight="bold">RGB-D Camera</text><text x="87" y="138" fill="%2394a3b8" font-size="11" font-family="sans-serif" text-anchor="middle">Input Stream</text><rect x="180" y="85" width="130" height="75" rx="10" fill="%231e293b" stroke="%23818cf8" stroke-width="2"/><text x="245" y="118" fill="%23818cf8" font-size="13" font-family="sans-serif" text-anchor="middle" font-weight="bold">Vuforia Engine</text><text x="245" y="138" fill="%2394a3b8" font-size="11" font-family="sans-serif" text-anchor="middle">Feature Matrix</text><rect x="345" y="85" width="125" height="75" rx="10" fill="%231e293b" stroke="%23a855f7" stroke-width="2"/><text x="407" y="118" fill="%23a855f7" font-size="13" font-family="sans-serif" text-anchor="middle" font-weight="bold">Pose Estimator</text><text x="407" y="138" fill="%2394a3b8" font-size="11" font-family="sans-serif" text-anchor="middle">Transform 6DoF</text><rect x="495" y="85" width="80" height="75" rx="10" fill="%231e293b" stroke="%234ade80" stroke-width="2"/><text x="535" y="118" fill="%234ade80" font-size="13" font-family="sans-serif" text-anchor="middle" font-weight="bold">3D Overlay</text><text x="535" y="138" fill="%2394a3b8" font-size="11" font-family="sans-serif" text-anchor="middle">Unity View</text><path d="M145 122 H180 M310 122 H345 M470 122 H495" stroke="%2338bdf8" stroke-width="3" stroke-dasharray="4 2"/><polygon points="177,117 185,122 177,127" fill="%2338bdf8"/><polygon points="342,117 350,122 342,127" fill="%2338bdf8"/><polygon points="492,117 500,122 492,127" fill="%2338bdf8"/><rect x="180" y="195" width="290" height="50" rx="8" fill="%231e293b" stroke="%23f59e0b" stroke-width="1.5"/><text x="325" y="225" fill="%23f59e0b" font-size="12" font-family="sans-serif" text-anchor="middle" font-weight="bold">Anchor Storage &amp; Cloud Key Sync</text></svg>`;

export const SAMPLE_DIAGRAM_OPTICS = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 280" width="600" height="280"><rect width="600" height="280" fill="%23090d16" rx="16"/><text x="300" y="38" fill="%23818cf8" font-size="15" font-family="sans-serif" text-anchor="middle" font-weight="bold">Figure 2.1: Digital Camera Convex Lens &amp; Focal Point Optics</text><path d="M50 140 H550 M250 60 Q300 140 250 220 Q200 140 250 60 Z" fill="rgba(212, 167, 128,0.25)" stroke="%23818cf8" stroke-width="3"/><line x1="80" y1="85" x2="235" y2="115" stroke="%23f43f5e" stroke-width="2.5"/><line x1="235" y1="115" x2="450" y2="140" stroke="%23f43f5e" stroke-width="2.5"/><line x1="80" y1="195" x2="235" y2="165" stroke="%23f43f5e" stroke-width="2.5"/><line x1="235" y1="165" x2="450" y2="140" stroke="%23f43f5e" stroke-width="2.5"/><circle cx="450" cy="140" r="7" fill="%23f43f5e"/><text x="450" y="172" fill="%23f43f5e" font-size="13" font-family="sans-serif" text-anchor="middle" font-weight="bold">Focal Point (F)</text><rect x="495" y="70" width="12" height="140" fill="%2338bdf8" rx="3"/><text x="501" y="232" fill="%2338bdf8" font-size="12" font-family="sans-serif" text-anchor="middle" font-weight="bold">CMOS Sensor</text></svg>`;

export const SAMPLE_DIAGRAM_RIGGING = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 280" width="600" height="280"><rect width="600" height="280" fill="%23041416" rx="16"/><text x="300" y="38" fill="%232dd4bf" font-size="15" font-family="sans-serif" text-anchor="middle" font-weight="bold">Figure 3.1: Character Skeleton Bone Joint Hierarchy &amp; Kinematics</text><g stroke="%232dd4bf" stroke-width="3" fill="none"><circle cx="300" cy="75" r="20" stroke="%232dd4bf"/><line x1="300" y1="95" x2="300" y2="185"/><circle cx="300" cy="120" r="6" fill="%232dd4bf"/><line x1="300" y1="120" x2="230" y2="155"/><line x1="230" y1="155" x2="190" y2="205"/><circle cx="230" cy="155" r="5" fill="%23f43f5e"/><circle cx="190" cy="205" r="5" fill="%23f43f5e"/><line x1="300" y1="120" x2="370" y2="155"/><line x1="370" y1="155" x2="410" y2="205"/><circle cx="370" cy="155" r="5" fill="%23f43f5e"/><circle cx="410" cy="205" r="5" fill="%23f43f5e"/><circle cx="300" cy="185" r="6" fill="%232dd4bf"/><line x1="300" y1="185" x2="260" y2="250"/><line x1="300" y1="185" x2="340" y2="250"/></g></svg>`;

export interface QuestionItem {
  id: number | string;
  code?: string;
  question: string;
  subject: string;
  unit: string;
  topic: string;
  type: "MCQ" | "Descriptive" | "Match Type" | "Short Answer" | "Problem Solving";
  difficulty: "Easy" | "Medium" | "Hard";
  status: "Approved" | "Pending" | "Verified" | "Rejected" | "Draft" | "Published" | "Archived";
  addedOn?: string;
  marks: number;
  options?: string[];
  correctAnswer?: string;
  uploadedBy?: string;
  department?: string;
  school?: string;
  email?: string;
  verifiedBy?: string;
  verifiedRole?: string;
  date?: string;
  time?: string;
  submittedDate?: string;
  uploadedOnDate?: string;
  uploadedOnTime?: string;
  bloomLevel?: string;
  aiStatus?: "AI Verified" | "AI Flagged" | "Not Verified";
  aiScore?: number;
  aiRemarks?: string;
  aiCheckedAt?: string;
  imageUrl?: string;
  diagramTitle?: string;
  diagramType?: string;
  reviewerComments?: string;
  sourceFile?: string;
  /** Set when a HOD uploads the question on behalf of the faculty in `uploadedBy`. */
  uploadedOnBehalfBy?: string;
}

/** Resolve placeholder upload subjects into the canonical institutional subject. */
export function inferQuestionSubject(question: Partial<QuestionItem>): string {
  const rawSubject = (question.subject || "").trim();
  const source = `${question.sourceFile || ""} ${question.question || ""} ${question.unit || ""} ${question.topic || ""}`.toLowerCase();
  const isPlaceholder = !rawSubject || ["general", "general studies", "unknown", "unassigned"].includes(rawSubject.toLowerCase());

  if (isPlaceholder && /(rotoscopy|keying|chroma|matchmoving|vuforia|augmented reality|\bar\b)/i.test(source)) {
    return "Augmented Reality & VFX";
  }

  return rawSubject || "General";
}

export interface UploadHistoryItem {
  id: number | string;
  name: string;
  type: string;
  subject: string;
  unit: string;
  totalQuestions: number;
  uploadedBy: string;
  email: string;
  status: "Success" | "Partial Success" | "Failed" | "Processing";
  date: string;
  time: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  type: string;
  typeBg?: string;
  typeColor?: string;
  priority: "High" | "Medium" | "Low";
  relatedTo: string;
  relatedSub?: string;
  timeAgo: string;
  exactTime: string;
  status: "Unread" | "Read";
}

export interface MessageItem {
  id: string;
  senderName: string;
  senderRole: string;
  senderEmail: string;
  recipientRole: "STAFF" | "HOD" | "DEAN" | "COE" | "All";
  recipientName: string;
  subject: string;
  content: string;
  timeAgo: string;
  exactTime: string;
  status: "Unread" | "Read";
}

export interface UserItem {
  id: string;
  name: string;
  email: string;
  role: "Administrator" | "Faculty" | "Verifier" | "HOD" | "Exam Cell Staff";
  department: string;
  status: "Active" | "Inactive";
  lastLogin: string;
}

export interface ActivityItem {
  id: string;
  activity: string;
  module: string;
  performedBy: string;
  dateTime: string;
  details: string;
}

export interface InstitutionalDepartment {
  id: string;
  name: string;
  code: string;
  hodName: string;
  hodEmail: string;
  hodRoleTitle?: string;
}

export interface InstitutionalSchool {
  id: string;
  name: string;
  code: string;
  deanName: string;
  deanEmail: string;
  deanRoleTitle?: string;
  departments: InstitutionalDepartment[];
}

export interface FacultyAllocationHierarchyResult {
  faculty: StaffFacultyItem | null;
  school: InstitutionalSchool | null;
  dean: { name: string; email: string; roleTitle?: string } | null;
  department: InstitutionalDepartment | null;
  hod: { name: string; email: string; roleTitle?: string } | null;
  hierarchyChain: { level: string; name: string; subtext: string }[];
  hierarchyString: string;
  isValid: boolean;
  validationErrors: string[];
}

export interface StaffFacultyItem {
  id: string;
  name: string;
  designation: string;
  employeeId: string;
  department: string;
  school?: string;
  deanName?: string;
  deanEmail?: string;
  hodName?: string;
  hodEmail?: string;
  email: string;
  phone: string;
  qualification: string;
  experience: string;
  reportingTo: "HOD" | "DEAN" | "Both";
  reportingOfficerName: string;
  assignedSubjects: string[];
  syllabusCount?: number;
  assignedSyllabus?: string[];
  questionsContributed: number;
  pendingReviews: number;
  status: "Active" | "On Leave" | "On Duty";
  avatarBg: string;
}

export const INSTITUTIONAL_HIERARCHY: InstitutionalSchool[] = [
  {
    id: "school-media-arts",
    name: "School of Fashion Design, Media and Performing Arts",
    code: "SFDMP",
    deanName: "Dr. V Rajlakshmi",
    deanEmail: "dean@rathinam.in",
    deanRoleTitle: "Dean Academic Affairs",
    departments: [
      {
        id: "dept-viscom",
        name: "Department of Visual Communication",
        code: "DEPT-VISCOM",
        hodName: "Dr. T.J RAJU",
        hodEmail: "hod@rathinam.in",
        hodRoleTitle: "HOD / Associate Dean",
      },
      {
        id: "dept-vfx",
        name: "Department of Animation & VFX",
        code: "DEPT-VFX",
        hodName: "Dr. T.J RAJU",
        hodEmail: "hod@rathinam.in",
        hodRoleTitle: "HOD / Associate Dean",
      },
      {
        id: "dept-cdf",
        name: "Department of Costume Design & Fashion",
        code: "DEPT-CDF",
        hodName: "Dr. S. Meenakshi",
        hodEmail: "meenakshi.cdf@rathinam.in",
        hodRoleTitle: "Associate Professor & Head",
      },
      {
        id: "dept-dmp",
        name: "Department of Digital Media Production",
        code: "DEPT-DMP",
        hodName: "Dr. T.J RAJU",
        hodEmail: "hod@rathinam.in",
        hodRoleTitle: "HOD / Associate Dean",
      },
    ],
  },
  {
    id: "school-quantum-ai",
    name: "School of Quantum Science, Computing & AI",
    code: "SQSCAI",
    deanName: "Dr. R. Manickam",
    deanEmail: "dean.ai@rathinam.in",
    deanRoleTitle: "Dean Computing & Artificial Intelligence",
    departments: [
      {
        id: "dept-cs",
        name: "Department of Computer Science",
        code: "DEPT-CS",
        hodName: "Dr. Sathish Murugan",
        hodEmail: "hod.cs@rathinam.in",
        hodRoleTitle: "Professor & Head",
      },
      {
        id: "dept-aiml",
        name: "Department of Artificial Intelligence & Machine Learning",
        code: "DEPT-AIML",
        hodName: "Dr. P. Krishnan",
        hodEmail: "hod.aiml@rathinam.in",
        hodRoleTitle: "Professor & Head",
      },
      {
        id: "dept-it",
        name: "Department of Information Technology",
        code: "DEPT-IT",
        hodName: "Dr. N. Sengottaiyan",
        hodEmail: "hod.it@rathinam.in",
        hodRoleTitle: "Associate Professor & Head",
      },
      {
        id: "dept-cyber",
        name: "Department of Cyber Security & Forensics",
        code: "DEPT-CYBER",
        hodName: "Dr. K. Balasubramanian",
        hodEmail: "hod.cyber@rathinam.in",
        hodRoleTitle: "Professor & Head",
      },
    ],
  },
  {
    id: "school-business-commerce",
    name: "School of Business & Commerce",
    code: "SBC",
    deanName: "Dr. K. Ramesh",
    deanEmail: "dean.commerce@rathinam.in",
    deanRoleTitle: "Dean School of Business",
    departments: [
      {
        id: "dept-bcom",
        name: "Department of Commerce (B.Com)",
        code: "DEPT-BCOM",
        hodName: "Dr. R. Anand",
        hodEmail: "hod.commerce@rathinam.in",
        hodRoleTitle: "Professor & Head",
      },
      {
        id: "dept-bba",
        name: "Department of Business Administration (BBA)",
        code: "DEPT-BBA",
        hodName: "Dr. M. Sangeetha",
        hodEmail: "hod.bba@rathinam.in",
        hodRoleTitle: "Associate Professor & Head",
      },
      {
        id: "dept-corp",
        name: "Department of Corporate Secretaryship & Accounting",
        code: "DEPT-CORP",
        hodName: "Dr. G. Sivakumar",
        hodEmail: "hod.corp@rathinam.in",
        hodRoleTitle: "Professor & Head",
      },
    ],
  },
  {
    id: "school-liberal-arts",
    name: "School of Liberal Arts & Science",
    code: "SLAS",
    deanName: "Dr. A. Meenakshisundaram",
    deanEmail: "dean.arts@rathinam.in",
    deanRoleTitle: "Dean School of Arts & Science",
    departments: [
      {
        id: "dept-eng",
        name: "Department of English & Foreign Languages",
        code: "DEPT-ENG",
        hodName: "Dr. B. Geetha",
        hodEmail: "hod.english@rathinam.in",
        hodRoleTitle: "Professor & Head",
      },
      {
        id: "dept-math",
        name: "Department of Mathematics & Statistics",
        code: "DEPT-MATH",
        hodName: "Dr. K. Senthamilselvan",
        hodEmail: "hod.math@rathinam.in",
        hodRoleTitle: "Associate Professor & Head",
      },
      {
        id: "dept-hum",
        name: "Department of Visual Arts & Humanities",
        code: "DEPT-HUM",
        hodName: "Dr. P. Sundaram",
        hodEmail: "hod.humanities@rathinam.in",
        hodRoleTitle: "Associate Professor & Head",
      },
    ],
  },
  {
    id: "school-applied-bio",
    name: "School of Applied Bio-Sciences, Food & Architecture",
    code: "SABFA",
    deanName: "Dr. S. Balamurugan",
    deanEmail: "dean.bioscience@rathinam.in",
    deanRoleTitle: "Dean of Applied Sciences",
    departments: [
      {
        id: "dept-bio",
        name: "Department of Microbiology & Biotechnology",
        code: "DEPT-BIO",
        hodName: "Dr. V. Gomathi",
        hodEmail: "hod.microbio@rathinam.in",
        hodRoleTitle: "Professor & Head",
      },
      {
        id: "dept-food",
        name: "Department of Food Technology & Agritech",
        code: "DEPT-FOOD",
        hodName: "Dr. C. Deepa",
        hodEmail: "hod.foodtech@rathinam.in",
        hodRoleTitle: "Associate Professor & Head",
      },
    ],
  },
  {
    id: "school-sports-health",
    name: "School of Sports & Health Sciences",
    code: "SSHS",
    deanName: "Dr. T. Senthilkumar",
    deanEmail: "dean.sports@rathinam.in",
    deanRoleTitle: "Dean of Health Sciences",
    departments: [
      {
        id: "dept-psych",
        name: "Department of Applied Psychology",
        code: "DEPT-PSYCH",
        hodName: "Dr. R. Divya",
        hodEmail: "hod.psychology@rathinam.in",
        hodRoleTitle: "Associate Professor & Head",
      },
      {
        id: "dept-nutr",
        name: "Department of Clinical Nutrition & Sports Science",
        code: "DEPT-NUTR",
        hodName: "Dr. K. Vijay",
        hodEmail: "hod.sports@rathinam.in",
        hodRoleTitle: "Professor & Head",
      },
    ],
  },
  {
    id: "school-sustainability",
    name: "School of Sustainability & Climate Studies",
    code: "SSCS",
    deanName: "Dr. P. Jayanthi",
    deanEmail: "dean.sustainability@rathinam.in",
    deanRoleTitle: "Dean Climate Sciences",
    departments: [
      {
        id: "dept-env",
        name: "Department of Environmental Sciences & Climate Policy",
        code: "DEPT-ENV",
        hodName: "Dr. M. Elango",
        hodEmail: "hod.env@rathinam.in",
        hodRoleTitle: "Associate Professor & Head",
      },
    ],
  },
];

export interface InstitutionalSubjectDef {
  code: string;
  name: string;
  department: string;
  credits: number;
  semester?: string;
}

export const INSTITUTIONAL_SUBJECTS: InstitutionalSubjectDef[] = [
  // Visual Communication
  { code: "VIS-301", name: "Augmented Reality & VFX", department: "Department of Visual Communication", credits: 4, semester: "Semester 5" },
  { code: "VIS-302", name: "Digital Cinematography & Lighting", department: "Department of Visual Communication", credits: 4, semester: "Semester 5" },
  { code: "VIS-303", name: "3D Modeling & Animation", department: "Department of Visual Communication", credits: 4, semester: "Semester 3" },
  { code: "VIS-304", name: "Graphic Design & Brand Identity", department: "Department of Visual Communication", credits: 3, semester: "Semester 3" },
  { code: "VIS-305", name: "Audio Production & Sound Design", department: "Department of Visual Communication", credits: 3, semester: "Semester 3" },
  { code: "VIS-306", name: "Motion Graphics & Broadcast VFX", department: "Department of Visual Communication", credits: 4, semester: "Semester 4" },
  { code: "VIS-201", name: "Color Theory & Visual Aesthetics", department: "Department of Visual Communication", credits: 3, semester: "Semester 2" },
  { code: "VIS-401", name: "Documentary Filmmaking & Direction", department: "Department of Visual Communication", credits: 4, semester: "Semester 6" },
  
  // Animation & VFX
  { code: "VFX-301", name: "Character Rigging & Dynamics", department: "Department of Animation & VFX", credits: 4, semester: "Semester 5" },
  { code: "VFX-302", name: "Node-based Compositing & Green Screen", department: "Department of Animation & VFX", credits: 4, semester: "Semester 5" },
  { code: "VFX-303", name: "Rotoscopy & Matchmoving", department: "Department of Animation & VFX", credits: 3, semester: "Semester 4" },
  
  // Costume Design & Fashion
  { code: "CDF-201", name: "Fashion Illustration & Garment Design", department: "Department of Costume Design & Fashion", credits: 4, semester: "Semester 3" },
  { code: "CDF-301", name: "Textile Science & Apparel Manufacturing", department: "Department of Costume Design & Fashion", credits: 4, semester: "Semester 5" },

  // Digital Media Production
  { code: "DMP-201", name: "Television Studio Production", department: "Department of Digital Media Production", credits: 4, semester: "Semester 3" },
  { code: "DMP-301", name: "Broadcast Media & Live Streaming", department: "Department of Digital Media Production", credits: 3, semester: "Semester 5" },

  // Computer Science & AI
  { code: "CS-301", name: "Data Structures & Algorithms", department: "Department of Computer Science", credits: 4, semester: "Semester 3" },
  { code: "CS-302", name: "Database Management Systems", department: "Department of Computer Science", credits: 4, semester: "Semester 4" },
  { code: "CS-303", name: "Operating Systems & System Programming", department: "Department of Computer Science", credits: 3, semester: "Semester 4" },
  { code: "CS-201", name: "Object Oriented Programming in Java", department: "Department of Computer Science", credits: 4, semester: "Semester 2" },
  { code: "AIML-401", name: "Artificial Intelligence & Machine Learning", department: "Department of Artificial Intelligence & Machine Learning", credits: 4, semester: "Semester 5" },
  { code: "AIML-402", name: "Deep Learning & Computer Vision", department: "Department of Artificial Intelligence & Machine Learning", credits: 4, semester: "Semester 6" },
  { code: "IT-301", name: "Full Stack Web Technologies", department: "Department of Information Technology", credits: 4, semester: "Semester 5" },
  { code: "CYBER-301", name: "Network Security & Cryptography", department: "Department of Cyber Security & Forensics", credits: 4, semester: "Semester 5" },

  // Commerce & Management
  { code: "COM-301", name: "Corporate Accounting & Auditing", department: "Department of Commerce (B.Com)", credits: 4, semester: "Semester 3" },
  { code: "COM-302", name: "Financial Management & Analysis", department: "Department of Commerce (B.Com)", credits: 4, semester: "Semester 4" },
  { code: "COM-201", name: "Business Law & Company Governance", department: "Department of Commerce (B.Com)", credits: 3, semester: "Semester 2" },
  { code: "MBA-101", name: "Strategic Management & Organizational Behavior", department: "Department of Management Studies (BBA / MBA)", credits: 4, semester: "Semester 1" },

  // English & Psychology
  { code: "ENG-101", name: "Professional Communication & Technical Writing", department: "Department of English & Foreign Languages", credits: 3, semester: "Semester 1" },
  { code: "ENG-201", name: "Literature & Critical Discourse", department: "Department of English & Foreign Languages", credits: 3, semester: "Semester 3" },
  { code: "PSY-201", name: "Cognitive Neuroscience & Behavioral Psychology", department: "Department of Applied Psychology", credits: 4, semester: "Semester 3" },
  { code: "PSY-301", name: "Clinical Psychology & Counseling", department: "Department of Applied Psychology", credits: 4, semester: "Semester 5" },

  // Biosciences, Sports & Sustainability
  { code: "BIO-301", name: "Molecular Biology & Genetic Engineering", department: "Department of Biotechnology", credits: 4, semester: "Semester 5" },
  { code: "NUTR-201", name: "Clinical Nutrition & Dietetics", department: "Department of Clinical Nutrition & Sports Science", credits: 4, semester: "Semester 3" },
  { code: "ENV-301", name: "Environmental Impact Assessment & Climate Policy", department: "Department of Environmental Sciences & Climate Policy", credits: 4, semester: "Semester 5" },
];

export interface SyllabusApprovalItem {
  id: string;
  courseCode: string;
  courseName: string;
  department: string;
  semester: string;
  submittedBy: string;
  submitterEmail: string;
  submittedAt: string;
  totalUnits: number;
  totalTopics: number;
  stage: "staff" | "hod" | "dean" | "coe";
  status: "Pending" | "Approved" | "Revision_Requested" | "Rejected";
  staffStatus: "Submitted" | "Draft";
  hodStatus: "Pending" | "Approved" | "Revision_Requested";
  hodName?: string;
  hodDate?: string;
  deanStatus: "Pending" | "Approved" | "Revision_Requested" | "Waiting_HOD";
  deanName?: string;
  deanDate?: string;
  coeStatus: "Pending" | "Approved" | "Locked" | "Waiting_Dean";
  coeName?: string;
  coeDate?: string;
  remarks?: string;
  documentName?: string;
  documentFormat?: string;
  documentText?: string;
  documentData?: string;
  /** Set when a HOD uploads the syllabus on behalf of the faculty in `submittedBy`. */
  uploadedOnBehalfBy?: string;
}

export interface SubjectAllocationItem {
  id: string;
  subjectCode: string;
  subjectName: string;
  department: string;
  semester: string;
  academicYear: string;
  facultyName?: string;
  facultyId?: string;
  credits?: number;
  status: "Allocated" | "Pending" | "Active";
  createdAt?: string;
  updatedAt?: string;
}

export const defaultSubjectAllocations: SubjectAllocationItem[] = [];

// Initial Data Seeds
export const defaultStaffFaculty: StaffFacultyItem[] = [];

export const defaultSyllabusApprovals: SyllabusApprovalItem[] = [];

// Initial Data Seeds
export const defaultSubjects: SubjectItem[] = [];

export const defaultUnits: SyllabusUnit[] = [];

export const defaultQuestions: QuestionItem[] = [];

export const defaultUploadHistory: UploadHistoryItem[] = [];

export const defaultNotifications: NotificationItem[] = [];

export const defaultMessages: MessageItem[] = [];

export const defaultUsers: UserItem[] = [];

export const defaultActivities: ActivityItem[] = [];

// Helper to broadcast changes
const notifyUpdate = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("exam-cell-store-update"));
  }
};

// Auto-reset cached local storage to 0 for all subjects, syllabus, questions, verified & upload history
export function generateArQuestions(): QuestionItem[] {
  const topicsByUnit = [
    { unit: "Unit 01 - Tracking & Feature Extraction Fundamentals", topic: "Tracking Principles & Point Trackers" },
    { unit: "Unit 02 - Planar Tracking & Rotoscopy Splines", topic: "Mocha Planar Solvers & Roto Splines" },
    { unit: "Unit 03 - Green & Blue Screen Keying Algorithms", topic: "Chroma Keying, Primatte & Spill Suppression" },
    { unit: "Unit 04 - Matchmoving & 3D Camera Tracking", topic: "Camera Solving, Point Clouds & Distortion" },
    { unit: "Unit 05 - Vuforia AR SDK & Unity Rendering Pipeline", topic: "Vuforia Target Tracking & 3D Composite" },
  ];

  const seededQuestions: QuestionItem[] = [];
  for (let i = 1; i <= 100; i++) {
    const uIdx = Math.floor((i - 1) / 20);
    const { unit, topic } = topicsByUnit[uIdx];
    const isMcq = i % 4 === 1;
    const marks = isMcq ? 2 : (i % 3 === 0 ? 5 : 10);
    const diff = i % 3 === 0 ? "Easy" : (i % 2 === 0 ? "Medium" : "Hard");

    seededQuestions.push({
      id: `ar-q-${i}`,
      code: `24AR-${String(i).padStart(3, '0')}`,
      question: `Question ${i}: Analyze and explain the core mechanism of ${topic} extracted from "Rotoscopy_and_Keying_100_Question_Bank.docx" (Item #${i} for ${unit}).`,
      subject: "AUGMENTED REALITY100 MU",
      unit: unit,
      topic: topic,
      type: isMcq ? "MCQ" : "Descriptive",
      difficulty: diff,
      status: "Pending",
      marks: marks,
      options: isMcq ? ["Option A: Primary feature matrix calculation", "Option B: Transform 6DoF tracking vector", "Option C: Spatial anchor coordinate mapping", "Option D: Optical flow motion estimation"] : undefined,
      correctAnswer: isMcq ? "Option A: Primary feature matrix calculation" : undefined,
      uploadedBy: "Mr. Vignesh M",
      email: "vignesh.viscom@rathinam.in",
      sourceFile: "Rotoscopy_and_Keying_100_Question_Bank.docx",
      date: "30 Sept 2026",
      time: "09:40 AM",
      submittedDate: "30 Sept 2026, 09:40 AM",
    });
  }
  return seededQuestions;
}

  if (typeof window !== "undefined") {
    const ZERO_SEED_VERSION = "exam_cell_zero_v20_syllabus_linked_qb";
    if (!localStorage.getItem(ZERO_SEED_VERSION)) {
      localStorage.removeItem("exam_cell_subjects");
      localStorage.removeItem("exam_cell_questions");
      localStorage.removeItem("exam_cell_uploads");
      localStorage.removeItem("exam_cell_notifications");
      localStorage.removeItem("exam_cell_messages");
      localStorage.removeItem("exam_cell_activities");
      localStorage.removeItem("exam_cell_units");
      localStorage.removeItem("exam_cell_staff_faculty");
      localStorage.setItem(ZERO_SEED_VERSION, "true");
    }

    // Persistent cleanup: Ensure no auto-seeded dummy data ever resurrects
    const CLEANUP_KEY = "exam_cell_v39_clean_persisted_state_staff";
    if (!localStorage.getItem(CLEANUP_KEY)) {
      localStorage.removeItem("exam_cell_staff_faculty");
      localStorage.setItem(CLEANUP_KEY, "true");
    }
    try {
      const currentQuestions: QuestionItem[] = JSON.parse(localStorage.getItem("exam_cell_questions") || "[]");
      const cleanedQuestions = currentQuestions.filter((q) => {
        const idStr = String(q.id || "");
        if (idStr.startsWith("ar-q-")) return false;
        if (q.sourceFile && q.sourceFile.includes("Rotoscopy_and_Keying")) return false;
        return true;
      });
      localStorage.setItem("exam_cell_questions", JSON.stringify(cleanedQuestions));

      const currentUploads: UploadHistoryItem[] = JSON.parse(localStorage.getItem("exam_cell_uploads") || "[]");
      const filteredUploads = currentUploads.filter((u) => !u.name.includes("Rotoscopy_and_Keying"));
      localStorage.setItem("exam_cell_uploads", JSON.stringify(filteredUploads));

      localStorage.setItem(CLEANUP_KEY, "true");
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  }
// Generic LocalStorage helpers
function getFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const data = localStorage.getItem(`exam_cell_${key}`);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    console.error("Storage error:", e);
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`exam_cell_${key}`, JSON.stringify(value));
    const nowStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    localStorage.setItem("exam_cell_last_updated", nowStr);
    if (key in SYNCED_COLLECTIONS) scheduleCollectionPush(key as SyncedCollectionKey);
    notifyUpdate();
  } catch (e) {
    console.error("Storage save error:", e);
  }
}

// ----------------- SUPABASE COLLECTION SYNC -----------------
// Questions and syllabus approvals are the records that move through the
// Staff/HOD -> Dean -> COE pipeline, so they must be shared across devices.
// Every local save pushes only the rows that changed since the last sync, and
// a periodic pull brings in changes made by other users. A per-device snapshot
// (id -> content hash) tells "changed here, not yet pushed" apart from
// "changed or deleted on the server".
type SyncedCollectionKey = "questions" | "syllabus_approvals";
type SyncRow = Record<string, unknown>;

interface CollectionSyncConfig {
  table: string;
  /** Columns to fetch on the periodic pull. */
  pullColumns: string;
  /** Upsert one row per request so optional columns are never nulled. */
  upsertIndividually?: boolean;
  toRow: (item: any) => SyncRow;
  /** Row shape for databases that have not run the migration yet. */
  toLegacyRow?: (item: any) => SyncRow;
  fromRow: (row: any, local?: any) => any;
}

const LEGACY_QUESTION_COLUMNS = ["id", "code", "question", "subject", "unit", "topic", "type", "difficulty", "marks", "bloom_level", "status", "options", "answer", "verifier", "submitted_by", "submitted_date"];

const SYNCED_COLLECTIONS: Record<SyncedCollectionKey, CollectionSyncConfig> = {
  questions: {
    table: "questions",
    pullColumns: "*",
    toRow: (q: QuestionItem) => ({
      id: String(q.id),
      code: q.code || `Q-${q.id}`,
      question: q.question,
      subject: q.subject,
      unit: q.unit,
      topic: q.topic,
      type: q.type,
      difficulty: q.difficulty,
      marks: Number(q.marks) || 0,
      bloom_level: q.bloomLevel || "Understand",
      status: q.status,
      options: q.options || [],
      answer: q.correctAnswer || null,
      verifier: q.verifiedBy || null,
      submitted_by: q.uploadedBy || null,
      submitted_date: q.submittedDate || q.date || null,
      email: q.email || null,
      department: q.department || null,
      verified_role: q.verifiedRole || null,
      source_file: q.sourceFile || null,
      uploaded_on_behalf_by: q.uploadedOnBehalfBy || null,
      payload: q,
    }),
    toLegacyRow(q: QuestionItem) {
      const row = this.toRow(q);
      return Object.fromEntries(Object.entries(row).filter(([column]) => LEGACY_QUESTION_COLUMNS.includes(column)));
    },
    fromRow: (row: any): QuestionItem => {
      if (row.payload && typeof row.payload === "object") return { ...row.payload, status: row.status || row.payload.status };
      return {
        id: row.id,
        code: row.code,
        question: row.question,
        subject: row.subject,
        unit: row.unit,
        topic: row.topic || "",
        type: row.type || "Descriptive",
        difficulty: row.difficulty || "Medium",
        marks: row.marks || 5,
        bloomLevel: row.bloom_level || "Understand",
        status: row.status || "Pending",
        options: row.options || [],
        correctAnswer: row.answer || "",
        uploadedBy: row.submitted_by || "Faculty",
        verifiedBy: row.verifier || undefined,
        date: row.submitted_date || "",
      };
    },
  },
  syllabus_approvals: {
    table: "syllabus_approvals",
    // The original Word/PDF file can be large; it is fetched on demand.
    pullColumns: "id, status, payload, has_document, created_at",
    upsertIndividually: true,
    toRow: (item: SyllabusApprovalItem) => {
      const { documentData, ...rest } = item;
      const row: SyncRow = {
        id: item.id,
        course_code: item.courseCode,
        course_name: item.courseName,
        department: item.department,
        semester: item.semester,
        submitted_by: item.submittedBy,
        submitter_email: item.submitterEmail,
        uploaded_on_behalf_by: item.uploadedOnBehalfBy || null,
        stage: item.stage,
        status: item.status,
        hod_status: item.hodStatus,
        dean_status: item.deanStatus,
        coe_status: item.coeStatus,
        payload: rest,
      };
      // Only send the document when this device has it, so a Dean approving
      // from another computer never wipes the stored original file.
      if (documentData) {
        row.document_data = documentData;
        row.has_document = true;
      }
      return row;
    },
    fromRow: (row: any, local?: SyllabusApprovalItem): SyllabusApprovalItem => {
      const item = { ...(row.payload || {}), id: row.id } as SyllabusApprovalItem;
      if (local?.documentData) item.documentData = local.documentData;
      return item;
    },
  },
};

function hashSyncValue(value: unknown): string {
  const text = JSON.stringify(value) || "";
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return `${(hash >>> 0).toString(36)}.${text.length}`;
}

function readSyncSnapshot(key: SyncedCollectionKey): Record<string, string> {
  return getFromStorage<Record<string, string>>(`sync_${key}`, {});
}

function writeSyncSnapshot(key: SyncedCollectionKey, snapshot: Record<string, string>): void {
  try {
    localStorage.setItem(`exam_cell_sync_${key}`, JSON.stringify(snapshot));
  } catch (e) {
    console.error("Sync snapshot save error:", e);
  }
}

const pushTimers: Partial<Record<SyncedCollectionKey, number>> = {};
const pushInFlight: Partial<Record<SyncedCollectionKey, Promise<void>>> = {};
const warnedSyncIssues = new Set<string>();

function warnSyncOnce(id: string, message: string): void {
  if (warnedSyncIssues.has(id)) return;
  warnedSyncIssues.add(id);
  console.warn(message);
}

const isMissingColumnError = (error: { code?: string; message?: string }) =>
  error.code === "PGRST204" || error.code === "42703" || /column/i.test(error.message || "");

function scheduleCollectionPush(key: SyncedCollectionKey): void {
  if (typeof window === "undefined" || !isSupabaseConfigured()) return;
  window.clearTimeout(pushTimers[key]);
  pushTimers[key] = window.setTimeout(() => {
    delete pushTimers[key];
    void pushCollection(key);
  }, 400);
}

function cancelCollectionPush(key: SyncedCollectionKey): boolean {
  if (pushTimers[key] === undefined) return false;
  window.clearTimeout(pushTimers[key]);
  delete pushTimers[key];
  return true;
}

async function pushCollection(key: SyncedCollectionKey): Promise<void> {
  if (pushInFlight[key]) {
    await pushInFlight[key];
  }
  const run = (async () => {
    const config = SYNCED_COLLECTIONS[key];
    const list = getFromStorage<any[]>(key, []);
    const snapshot = readSyncSnapshot(key);
    const seen = new Set<string>();
    const changed: { id: string; hash: string; item: any }[] = [];
    list.forEach((item) => {
      const id = String(item?.id ?? "");
      if (!id) return;
      seen.add(id);
      const hash = hashSyncValue(item);
      if (snapshot[id] !== hash) changed.push({ id, hash, item });
    });
    const removed = Object.keys(snapshot).filter((id) => !seen.has(id));
    if (changed.length === 0 && removed.length === 0) return;

    const synced: Record<string, string | null> = {};
    const upsertRows = async (entries: typeof changed) => {
      const rows = entries.map((entry) => config.toRow(entry.item));
      let { error } = await supabase.from(config.table).upsert(rows.length === 1 ? rows[0] : rows);
      if (error && config.toLegacyRow && isMissingColumnError(error)) {
        warnSyncOnce(`${key}-legacy`, `Supabase "${config.table}" is missing new columns. Run supabase/migrations/20261113_hod_dean_approval_sync.sql. Syncing core fields only.`);
        ({ error } = await supabase.from(config.table).upsert(entries.map((entry) => config.toLegacyRow!(entry.item))));
      }
      if (error) {
        warnSyncOnce(`${key}-upsert-${error.code}`, `Supabase ${config.table} sync error: ${error.message}`);
        return;
      }
      entries.forEach((entry) => (synced[entry.id] = entry.hash));
    };

    if (config.upsertIndividually) {
      for (const entry of changed) await upsertRows([entry]);
    } else {
      for (let i = 0; i < changed.length; i += 200) await upsertRows(changed.slice(i, i + 200));
    }

    for (let i = 0; i < removed.length; i += 200) {
      const chunk = removed.slice(i, i + 200);
      const { error } = await supabase.from(config.table).delete().in("id", chunk);
      if (error) warnSyncOnce(`${key}-delete`, `Supabase ${config.table} delete error: ${error.message}`);
      else chunk.forEach((id) => (synced[id] = null));
    }

    // Re-read so a pull that finished meanwhile is not overwritten.
    const latest = readSyncSnapshot(key);
    Object.entries(synced).forEach(([id, hash]) => {
      if (hash === null) delete latest[id];
      else latest[id] = hash;
    });
    writeSyncSnapshot(key, latest);
  })();
  pushInFlight[key] = run;
  try {
    await run;
  } finally {
    if (pushInFlight[key] === run) delete pushInFlight[key];
  }
}

async function pullCollection(key: SyncedCollectionKey): Promise<void> {
  const config = SYNCED_COLLECTIONS[key];
  // Send pending local changes first; otherwise a row deleted here moments
  // ago would still be on the server and come straight back.
  if (cancelCollectionPush(key)) await pushCollection(key);
  if (pushInFlight[key]) await pushInFlight[key];
  const { data, error } = await supabase.from(config.table).select(config.pullColumns).order("created_at", { ascending: false });
  if (error || !data) {
    if (error) warnSyncOnce(`${key}-pull-${error.code}`, `Supabase ${config.table} fetch error: ${error.message}`);
    return;
  }

  const local = getFromStorage<any[]>(key, []);
  const snapshot = readSyncSnapshot(key);
  const nextSnapshot: Record<string, string> = {};
  const localById = new Map(local.map((item) => [String(item?.id ?? ""), item]));
  const remoteIds = new Set<string>();
  const merged: any[] = [];

  (data as any[]).forEach((row) => {
    const id = String(row.id);
    remoteIds.add(id);
    const localItem = localById.get(id);
    const isLocallyDirty = localItem && snapshot[id] && hashSyncValue(localItem) !== snapshot[id];
    if (isLocallyDirty) {
      // Edited here and not pushed yet: keep it, the next push sends it.
      merged.push(localItem);
      nextSnapshot[id] = snapshot[id];
      return;
    }
    const item = config.fromRow(row, localItem);
    merged.push(item);
    nextSnapshot[id] = hashSyncValue(item);
  });

  // Never-synced local records are kept (and pushed); records that were
  // synced before but are gone on the server were deleted elsewhere.
  const unsynced = local.filter((item) => {
    const id = String(item?.id ?? "");
    return id && !remoteIds.has(id) && !snapshot[id];
  });
  const next = [...unsynced, ...merged];

  writeSyncSnapshot(key, nextSnapshot);
  if (JSON.stringify(next) !== JSON.stringify(local)) {
    saveToStorage(key, next);
  } else if (unsynced.length > 0) {
    scheduleCollectionPush(key);
  }
}

// ----------------- SUBJECTS CRUD -----------------
export const examStore = {
  getLastUpdated(): string {
    if (typeof window === "undefined") return "Today, " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const stored = localStorage.getItem("exam_cell_last_updated");
    if (!stored) {
      const nowStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      localStorage.setItem("exam_cell_last_updated", nowStr);
      return nowStr;
    }
    return stored;
  },
  touchLastUpdated(): string {
    if (typeof window === "undefined") return "";
    const nowStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    localStorage.setItem("exam_cell_last_updated", nowStr);
    notifyUpdate();
    return nowStr;
  },
  getSubjects(): SubjectItem[] {
    const deletedList = getFromStorage<string[]>("deleted_subjects", []);
    const deletedSet = new Set(deletedList.map((x) => String(x).toLowerCase().trim()));

    const rawList = getFromStorage<SubjectItem[]>("subjects", defaultSubjects);
    const list = rawList.filter((s) => {
      if (!s) return false;
      const sId = String(s.id || "").toLowerCase().trim();
      const sName = (s.name || "").toLowerCase().trim();
      const sCode = (s.code || "").toLowerCase().trim();
      if (deletedSet.has(sId) || deletedSet.has(sName) || deletedSet.has(sCode)) return false;
      return true;
    });

    if (list.length !== rawList.length) {
      saveToStorage("subjects", list);
    }
    let mutated = false;

    // 1. Clean names: remove metadata strings like Course Code, L-T-P, Credits, etc.
    const cleaned = list.map((s) => {
      const clean = (s.name || "")
        .replace(/(?:Course\s*Code|Course\s*ID|Subject\s*Code|Code|L\-?T\-?P|Credits?|Total\s*Hours?|Hours?|Semester|Regulation|Department|Dept)[\s:\-_].*$/i, "")
        .replace(/[\s\-_:=_]+$/, "")
        .trim();
      if (clean && clean !== s.name) {
        mutated = true;
        return { ...s, name: clean };
      }
      return s;
    });

    // 2. Deduplicate subjects with same or matching names
    const uniqueMap = new Map<string, SubjectItem>();
    const remappedNames = new Map<string, string>(); // oldName/code -> canonicalName

    cleaned.forEach((subj) => {
      const normKey = subj.name.trim().toLowerCase();
      if (uniqueMap.has(normKey)) {
        const existing = uniqueMap.get(normKey)!;
        // Keep the one with legitimate code, e.g. not starting with SUB-
        if (existing.code.startsWith("SUB-") && !subj.code.startsWith("SUB-")) {
          uniqueMap.set(normKey, subj);
          remappedNames.set(existing.name, subj.name);
          remappedNames.set(existing.code, subj.name);
        } else {
          remappedNames.set(subj.name, existing.name);
          remappedNames.set(subj.code, existing.name);
        }
        mutated = true;
      } else {
        uniqueMap.set(normKey, subj);
      }
    });

    const finalList = Array.from(uniqueMap.values());

    if (mutated) {
      saveToStorage("subjects", finalList);

      // Re-map units belonging to any removed/merged subject
      if (remappedNames.size > 0) {
        const units = getFromStorage<SyllabusUnit[]>("units", defaultUnits);
        let unitsMutated = false;
        units.forEach((u) => {
          if (remappedNames.has(u.subject)) {
            u.subject = remappedNames.get(u.subject)!;
            unitsMutated = true;
          } else {
            for (const [oldVal, canonical] of remappedNames.entries()) {
              if (u.subject.toLowerCase() === oldVal.toLowerCase()) {
                u.subject = canonical;
                unitsMutated = true;
              }
            }
          }
        });
        if (unitsMutated) {
          saveToStorage("units", units);
        }
      }
    }

    return finalList;
  },
  saveSubject(subject: Partial<SubjectItem> & { id?: string }): SubjectItem {
    // If this subject was previously in deleted_subjects, remove it from blacklist
    const deletedList = getFromStorage<string[]>("deleted_subjects", []);
    const cleanRaw = (subject.name || "").trim().toLowerCase();
    const cleanCode = (subject.code || "").trim().toLowerCase();
    const cleanId = subject.id ? String(subject.id).trim().toLowerCase() : "";
    const newDeleted = deletedList.filter((x) => x !== cleanRaw && x !== cleanCode && (cleanId ? x !== cleanId : true));
    if (newDeleted.length !== deletedList.length) {
      saveToStorage("deleted_subjects", newDeleted);
    }

    const list = this.getSubjects();
    let savedSubject: SubjectItem;

    const rawName = subject.name || "Untitled Subject";
    const cleanName = rawName
      .replace(/(?:Course\s*Code|Course\s*ID|Subject\s*Code|Code|L\-?T\-?P|Credits?|Total\s*Hours?|Hours?|Semester|Regulation|Department|Dept)[\s:\-_].*$/i, "")
      .replace(/[\s\-_:=_]+$/, "")
      .trim() || rawName;

    // Search by ID or existing clean name / code
    const existingIdx = subject.id
      ? list.findIndex((s) => s.id === subject.id)
      : list.findIndex((s) => {
          const sName = s.name.trim().toLowerCase();
          const cName = cleanName.trim().toLowerCase();
          return sName === cName || (subject.code && s.code.toLowerCase() === subject.code.toLowerCase());
        });

    if (existingIdx !== -1) {
      list[existingIdx] = {
        ...list[existingIdx],
        ...subject,
        name: cleanName,
        code: (list[existingIdx].code && !list[existingIdx].code.startsWith("SUB-")) ? list[existingIdx].code : (subject.code || list[existingIdx].code),
      } as SubjectItem;
      savedSubject = list[existingIdx];
      saveToStorage("subjects", list);
    } else {
      savedSubject = {
        id: subject.id || `sub-${Date.now()}`,
        name: cleanName,
        code: subject.code || "SUB101",
        dotColor: subject.dotColor || "#d4a780",
        totalQuestions: Number(subject.totalQuestions || 0),
        completed: subject.completed || "0 (0%)",
        approved: Number(subject.approved || 0),
        verified: Number(subject.verified || 0),
        pending: Number(subject.pending || 0),
        status: subject.status || "In Progress",
        category: subject.category || "inprogress",
        credits: Number(subject.credits || 3),
        semester: subject.semester || "Semester 1",
        department: subject.department || "General",
        school: subject.school || "School of Media & Arts",
      };
      list.unshift(savedSubject);
      saveToStorage("subjects", list);
    }

    if (isSupabaseConfigured()) {
      supabase
        .from("subjects")
        .upsert({
          id: savedSubject.id,
          name: savedSubject.name,
          code: savedSubject.code,
          semester: savedSubject.semester,
          department: savedSubject.department,
          total_questions: savedSubject.totalQuestions,
          approved: savedSubject.approved,
          pending: savedSubject.pending,
          verified: savedSubject.verified,
          status: savedSubject.status,
        })
        .then(({ error }) => {
          if (error) console.warn("Supabase Subject Sync error:", error.message);
        });
    }

    return savedSubject;
  },
  deleteSubject(id: string): void {
    const rawSubjects = getFromStorage<SubjectItem[]>("subjects", defaultSubjects);
    const target = rawSubjects.find((s) => String(s.id) === String(id))
      || rawSubjects.find((s) => (s.name || "").toLowerCase().trim() === String(id).toLowerCase().trim())
      || rawSubjects.find((s) => (s.code || "").toLowerCase().trim() === String(id).toLowerCase().trim());

    const targetName = target ? target.name.trim().toLowerCase() : String(id).trim().toLowerCase();
    const targetCode = target ? target.code.trim().toLowerCase() : "";
    const targetId = target ? String(target.id).toLowerCase() : String(id).toLowerCase();

    // 1. Blacklist in deleted_subjects permanently
    const deletedList = getFromStorage<string[]>("deleted_subjects", []);
    const toAdd = [targetId, targetName, targetCode, String(id).toLowerCase()].filter(Boolean);
    const updatedDeleted = Array.from(new Set([...deletedList, ...toAdd]));
    saveToStorage("deleted_subjects", updatedDeleted);

    // 2. Remove matching subjects from subjects storage
    const remainingSubjects = rawSubjects.filter((s) => {
      const sId = String(s.id).toLowerCase().trim();
      const sName = (s.name || "").toLowerCase().trim();
      const sCode = (s.code || "").toLowerCase().trim();
      if (sId === targetId || sId === String(id).toLowerCase().trim()) return false;
      if (targetName && (sName === targetName || sName.includes(targetName) || targetName.includes(sName))) return false;
      if (targetCode && sCode === targetCode) return false;
      return true;
    });
    saveToStorage("subjects", remainingSubjects);

    // 3. Remove all units belonging to this subject
    const rawUnits = getFromStorage<SyllabusUnit[]>("units", defaultUnits);
    const remainingUnits = rawUnits.filter((u) => {
      const uSub = (u.subject || "").trim().toLowerCase();
      if (uSub === targetName || (targetName && (uSub.includes(targetName) || targetName.includes(uSub)))) return false;
      if (targetCode && uSub === targetCode) return false;
      return true;
    });
    saveToStorage("units", remainingUnits);

    // 4. Remove all questions belonging to this subject
    const rawQs = getFromStorage<QuestionItem[]>("questions", defaultQuestions);
    const remainingQs = rawQs.filter((q) => {
      const qSub = (q.subject || "").trim().toLowerCase();
      if (qSub === targetName || (targetName && (qSub.includes(targetName) || targetName.includes(qSub)))) return false;
      if (targetCode && qSub === targetCode) return false;
      return true;
    });
    saveToStorage("questions", remainingQs);

    // 5. Remove all notifications belonging or related to this subject
    this.clearNotificationsForSubject(targetName);
    if (targetCode) this.clearNotificationsForSubject(targetCode);

    // 6. Remove all uploads belonging to this subject
    const rawUploads = getFromStorage<UploadHistoryItem[]>("uploads", defaultUploadHistory);
    const remainingUploads = rawUploads.filter((u) => {
      const uSub = (u.subject || "").trim().toLowerCase();
      if (uSub === targetName || (targetName && (uSub.includes(targetName) || targetName.includes(uSub)))) return false;
      if (targetCode && uSub === targetCode) return false;
      return true;
    });
    saveToStorage("uploads", remainingUploads);
    this.dismissBatch(targetName);
    if (targetCode) this.dismissBatch(targetCode);

    this.recalculateSubjectStats();
    notifyUpdate();

    if (isSupabaseConfigured()) {
      supabase
        .from("subjects")
        .delete()
        .eq("id", id)
        .then(({ error }) => {
          if (error) console.warn("Supabase Subject Delete error:", error.message);
        });
    }
  },
  saveBulkSubjects(items: Partial<SubjectItem>[]): SubjectItem[] {
    const list = this.getSubjects();
    const addedList: SubjectItem[] = [];
    items.forEach((s, idx) => {
      const saved: SubjectItem = {
        id: `sub-${Date.now()}-${idx}`,
        name: s.name || "Untitled Subject",
        code: s.code || `SUB-${100 + idx}`,
        dotColor: s.dotColor || "#d4a780",
        totalQuestions: Number(s.totalQuestions || 0),
        completed: s.completed || "0 (0%)",
        approved: Number(s.approved || 0),
        verified: Number(s.verified || 0),
        pending: Number(s.pending || 0),
        status: s.status || "In Progress",
        category: s.category || "inprogress",
        credits: Number(s.credits || 3),
        semester: s.semester || "Semester 1",
        department: s.department || "General",
        school: s.school || "School of Media & Arts",
      };
      list.unshift(saved);
      addedList.push(saved);
    });
    saveToStorage("subjects", list);
    return addedList;
  },

  recalculateSubjectStats(): void {
    const subjects = this.getSubjects();
    const questions = this.getQuestions();
    let updated = false;

    subjects.forEach((subj) => {
      const subjQs = questions.filter(
        (q) =>
          q.subject.toLowerCase() === subj.name.toLowerCase() ||
          q.subject.toLowerCase() === subj.code.toLowerCase()
      );
      const total = subjQs.length;
      const approved = subjQs.filter((q) => q.status === "Approved").length;
      const verified = subjQs.filter((q) => q.status === "Verified").length;
      const pending = subjQs.filter((q) => q.status === "Pending").length;
      const pct = total > 0 ? Math.round((approved / total) * 100) : 0;

      if (
        subj.totalQuestions !== total ||
        subj.approved !== approved ||
        subj.verified !== verified ||
        subj.pending !== pending
      ) {
        subj.totalQuestions = total;
        subj.approved = approved;
        subj.verified = verified;
        subj.pending = pending;
        subj.completed = `${approved} (${pct}%)`;
        updated = true;
      }
    });

    if (updated) {
      saveToStorage("subjects", subjects);
    }
  },

  // ----------------- SYLLABUS UNITS CRUD -----------------
  getUnits(): SyllabusUnit[] {
    const list = getFromStorage<SyllabusUnit[]>("units", defaultUnits);
    let mutated = false;

    const cleaned = list
      .filter((u) => {
        if (!u || !u.name) return false;
        if (/^PK[\s\x00-\x20]*/i.test(u.name) || /word\/(?:header|footer|xml|theme|numbering|rels|customXML)/i.test(u.name)) return false;
        if (u.name.includes("\uFFFD") || u.name.includes("9heKnHkiYMR") || u.name.includes("totcR2Iq") || u.name.includes("itemProps1")) return false;
        if ((u.name.match(/[^\x20-\x7E]/g) || []).length > 3) return false;
        if (/^[a-zA-Z0-9+\/=]{25,}$/.test(u.name)) return false;

        const lettersCount = (u.name.match(/[a-zA-Z]/g) || []).length;
        if (lettersCount < 3) return false;
        return true;
      })
      .map((u) => {
        const originalSubCount = (u.subtopics || []).length;
        const safeSubtopics = (u.subtopics || []).filter((sub) => {
          if (!sub || typeof sub !== "string") return false;
          if (/^PK[\s\x00-\x20]*/i.test(sub) || /word\/(?:header|footer|xml|theme|numbering|rels|customXML)/i.test(sub)) return false;
          if (sub.includes("\uFFFD") || sub.includes("itemProps1") || sub.includes("fontTable") || sub.includes("totcR2Iq") || sub.includes("9heKnHkiYMR")) return false;
          const letters = (sub.match(/[a-zA-Z]/g) || []).length;
          if (letters < 2 && sub.length > 5) return false;
          return true;
        });

        if (safeSubtopics.length !== originalSubCount) {
          mutated = true;
        }

        return {
          ...u,
          subtopics: safeSubtopics,
        };
      });

    if (cleaned.length !== list.length || mutated) {
      saveToStorage("units", cleaned);
    }
    return cleaned;
  },
  saveUnit(unit: Partial<SyllabusUnit> & { id?: string }): SyllabusUnit {
    const list = this.getUnits();
    
    // Sanitize unit name and subtopics before saving
    let cleanName = (unit.name || "New Unit").replace(/[^a-zA-Z0-9\s,\.\-\:\(\)\/\&]/g, "").trim();
    if (cleanName.includes("PK") || cleanName.includes("word/") || cleanName.includes("9heKnHkiYMR") || cleanName.includes("itemProps1")) {
      cleanName = `Unit ${unit.num || "01"} - Core Topics`;
    }

    const cleanSubtopics = (unit.subtopics || []).filter((st) => {
      if (!st || typeof st !== "string") return false;
      if (st.includes("PK") || st.includes("word/") || st.includes("9heKnHkiYMR") || st.includes("itemProps1") || st.includes("fontTable")) return false;
      return true;
    });

    let savedUnit: SyllabusUnit;
    if (unit.id) {
      const idx = list.findIndex((u) => u.id === unit.id);
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          ...unit,
          name: cleanName,
          subtopics: cleanSubtopics,
        } as SyllabusUnit;
        savedUnit = list[idx];
        saveToStorage("units", list);
      } else {
        savedUnit = {
          id: unit.id,
          num: unit.num || `0${list.length + 1}`,
          name: cleanName,
          topics: Number(unit.topics || 3),
          docs: Number(unit.docs || 0),
          subject: unit.subject || "Viscom & VFX",
          subtopics: cleanSubtopics,
          coMapping: unit.coMapping || [],
          description: unit.description || "",
        };
        list.push(savedUnit);
        saveToStorage("units", list);
      }
    } else {
      savedUnit = {
        id: unit.id || `unit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        num: unit.num || `0${list.length + 1}`,
        name: cleanName,
        topics: Number(unit.topics || 3),
        docs: Number(unit.docs || 0),
        subject: unit.subject || "Viscom & VFX",
        subtopics: cleanSubtopics,
        coMapping: unit.coMapping || [],
        description: unit.description || "",
      };
      list.push(savedUnit);
      saveToStorage("units", list);
    }

    if (isSupabaseConfigured()) {
      supabase
        .from("syllabus_units")
        .upsert({
          id: savedUnit.id,
          num: savedUnit.num,
          name: savedUnit.name,
          subject: savedUnit.subject,
          topics: savedUnit.topics,
          docs: savedUnit.docs,
          subtopics: savedUnit.subtopics || [],
          co_mapping: savedUnit.coMapping || [],
          description: savedUnit.description || "",
        })
        .then(({ error }) => {
          if (error) console.warn("Supabase Unit Sync error:", error.message);
        });
    }

    return savedUnit;
  },
  deleteUnit(id: string): void {
    const list = this.getUnits().filter((u) => u.id !== id);
    saveToStorage("units", list);

    if (isSupabaseConfigured()) {
      supabase
        .from("syllabus_units")
        .delete()
        .eq("id", id)
        .then(({ error }) => {
          if (error) console.warn("Supabase Unit Delete error:", error.message);
        });
    }

    // RULE: If syllabus is deleted, Question Bank must refresh to 0
    if (list.length === 0) {
      saveToStorage("questions", []);
    } else {
      const remainingSubjects = new Set(
        list.map((u) => (u.subject || "").trim().toLowerCase()).filter(Boolean)
      );
      const allSubjects = this.getSubjects();
      list.forEach((u) => {
        const uSub = (u.subject || "").trim().toLowerCase();
        const match = allSubjects.find(
          (s) => s.name.trim().toLowerCase() === uSub || s.code.trim().toLowerCase() === uSub
        );
        if (match) {
          remainingSubjects.add(match.name.trim().toLowerCase());
          remainingSubjects.add(match.code.trim().toLowerCase());
        }
      });

      const rawQs = getFromStorage<QuestionItem[]>("questions", []);
      const survivingQs = rawQs.filter((q) =>
        remainingSubjects.has((q.subject || "").trim().toLowerCase())
      );
      if (survivingQs.length !== rawQs.length) {
        saveToStorage("questions", survivingQs);
      }

      // Also clean up notifications for subjects no longer having syllabus
      const rawNotifs = getFromStorage<NotificationItem[]>("notifications", defaultNotifications);
      const survivingNotifs = rawNotifs.filter((n) => {
        const rel = (n.relatedTo || "").trim().toLowerCase();
        if (rel === "general" || rel === "system" || rel === "coe" || rel === "all") return true;
        return remainingSubjects.has(rel);
      });
      if (survivingNotifs.length !== rawNotifs.length) {
        saveToStorage("notifications", survivingNotifs);
      }
    }

    this.recalculateSubjectStats();
    notifyUpdate();
  },

  deleteSubjectSyllabus(subjectName: string): void {
    const lower = subjectName.trim().toLowerCase();
    const remainingUnits = this.getUnits().filter(
      (u) => (u.subject || "").trim().toLowerCase() !== lower
    );
    saveToStorage("units", remainingUnits);

    // Purge questions for this subject
    const rawQs = getFromStorage<QuestionItem[]>("questions", []);
    const survivingQs = rawQs.filter(
      (q) => (q.subject || "").trim().toLowerCase() !== lower
    );
    saveToStorage("questions", survivingQs);

    // Purge notifications for this subject
    this.clearNotificationsForSubject(subjectName);

    // Purge uploads for this subject
    const rawUploads = getFromStorage<UploadHistoryItem[]>("uploads", defaultUploadHistory);
    const survivingUploads = rawUploads.filter(
      (u) => (u.subject || "").trim().toLowerCase() !== lower
    );
    saveToStorage("uploads", survivingUploads);

    this.dismissBatch(lower);

    if (isSupabaseConfigured()) {
      supabase
        .from("syllabus_units")
        .delete()
        .ilike("subject", subjectName.trim())
        .then(({ error }) => {
          if (error) console.warn("Supabase Subject Units Delete error:", error.message);
        });
    }

    this.recalculateSubjectStats();
    notifyUpdate();
  },

  clearAllSyllabus(): void {
    saveToStorage("units", []);
    saveToStorage("questions", []);
    this.clearAllNotifications();
    this.recalculateSubjectStats();
    notifyUpdate();
  },

  /**
   * Remove every uploaded question and syllabus (local browser + Supabase) so
   * staff/HOD can upload fresh. Users, faculty, subjects and subject
   * allocations are kept; subject counters are recalculated to zero.
   */
  async clearUploadedQuestionsAndSyllabus(): Promise<{ ok: boolean; message?: string }> {
    if (typeof window === "undefined") return { ok: false };
    (["questions", "syllabus_approvals"] as SyncedCollectionKey[]).forEach(cancelCollectionPush);
    await Promise.all(Object.values(pushInFlight));

    let remoteError: string | undefined;
    if (isSupabaseConfigured()) {
      const tables = ["questions", "syllabus_approvals", "syllabus_units"];
      const results = await Promise.all(tables.map((table) => supabase.from(table).delete().not("id", "is", null)));
      const failed = results.find((result) => result.error);
      if (failed?.error) remoteError = failed.error.message;
    }

    // Write empty snapshots before the lists so nothing tries to re-push.
    writeSyncSnapshot("questions", {});
    writeSyncSnapshot("syllabus_approvals", {});
    saveToStorage("questions", []);
    saveToStorage("syllabus_approvals", []);
    saveToStorage("units", []);
    saveToStorage("uploads", []);
    saveToStorage("dismissed_batches", []);
    this.clearAllNotifications();

    try {
      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase("exam-cell-question-bank-documents");
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
      });
    } catch {
      // Stored original files are only a convenience copy.
    }

    this.recalculateSubjectStats();
    this.logActivity("Cleared all uploaded questions and syllabus for fresh upload", "System", remoteError ? `Supabase error: ${remoteError}` : "Local and Supabase data cleared");
    notifyUpdate();
    return remoteError ? { ok: false, message: remoteError } : { ok: true };
  },

  /** Reset every subject's question counters and remove all question rows. */
  async resetAllQuestionCounts(): Promise<void> {
    if (typeof window === "undefined") return;

    const subjects = this.getSubjects().map((subject) => ({
      ...subject,
      totalQuestions: 0,
      approved: 0,
      pending: 0,
      verified: 0,
      completed: "0 (0%)",
    }));
    saveToStorage("subjects", []);
    saveToStorage("questions", []);
    saveToStorage("units", []);
    saveToStorage("uploads", []);
    saveToStorage("syllabus_approvals", []);
    this.clearAllNotifications();

    if (isSupabaseConfigured()) {
      const results = await Promise.all([
        // Clear the uploaded academic dataset from both remote question tables.
        supabase.from("cat_questions").delete().not("id", "is", null),
        supabase.from("questions").delete().not("id", "is", null),
        supabase.from("syllabus_units").delete().not("id", "is", null),
        supabase.from("subjects").delete().not("id", "is", null),
      ]);
      const failed = results.find((result) => result.error);
      if (failed?.error) console.warn("Supabase question count reset error:", failed.error.message);
    }

    notifyUpdate();
  },

  // ----------------- QUESTIONS CRUD -----------------
  getQuestions(): QuestionItem[] {
    const raw = getFromStorage<QuestionItem[]>("questions", defaultQuestions);
    // Ensure no auto-seeded dummy questions remain in storage
    const cleaned = raw.filter(
      (q) =>
        !String(q.id || "").startsWith("ar-q-") &&
        (!q.sourceFile || !q.sourceFile.includes("Rotoscopy_and_Keying")) &&
        !(q.subject || "").toLowerCase().includes("augmented reality100 mu")
    );
    if (cleaned.length !== raw.length) {
      saveToStorage("questions", cleaned);
    }
    const subjects = this.getSubjects();
    return cleaned.map((q, idx) => {
      let marksVal = Number(q.marks);
      if (!marksVal || isNaN(marksVal)) {
        marksVal = idx % 3 === 0 ? 5 : idx % 3 === 1 ? 10 : 12;
      }

      // Resolve department
      let dept = q.department || "";
      if (!dept) {
        const match = subjects.find(
          (s) =>
            s.name.trim().toLowerCase() === (q.subject || "").trim().toLowerCase() ||
            s.code.trim().toLowerCase() === (q.subject || "").trim().toLowerCase()
        );
        if (match && match.department) {
          dept = match.department;
        } else {
          const s = (q.subject || "").toLowerCase();
          if (s.includes("viscom") || s.includes("vfx") || s.includes("rotoscopy") || s.includes("keying") || s.includes("animation")) {
            dept = "Visual Communication";
          } else if (s.includes("computer") || s.includes("cs") || s.includes("it")) {
            dept = "Computer Science & Engineering";
          } else {
            dept = "Visual Communication";
          }
        }
      }

      // Resolve contributing staff
      let staff = (q.uploadedBy || "").trim();
      if (!staff || staff === "Faculty" || staff === "Exam Cell Admin") {
        staff = "Mr. Vignesh M";
      }

      return {
        ...q,
        subject: inferQuestionSubject(q),
        topic: q.topic || q.unit || q.subject || "General",
        marks: marksVal,
        department: dept,
        uploadedBy: staff,
        email: q.email || (staff.toLowerCase().includes("vignesh") ? "vignesh.viscom@rathinam.in" : "faculty@rathinam.in"),
      };
    });
  },
  saveQuestion(question: Partial<QuestionItem> & { id?: number | string }): QuestionItem {
    const list = this.getQuestions();
    const subjects = this.getSubjects();
    const normalizedSubject = inferQuestionSubject(question);
    let resolvedDept = question.department || "";
    if (!resolvedDept) {
      const match = subjects.find(
        (s) =>
          s.name.trim().toLowerCase() === normalizedSubject.toLowerCase() ||
          s.code.trim().toLowerCase() === normalizedSubject.toLowerCase()
      );
      resolvedDept = match?.department || "Visual Communication";
    }
    const resolvedStaff = (question.uploadedBy || "").trim() || "Mr. Vignesh M";
    const resolvedEmail = question.email || (resolvedStaff.toLowerCase().includes("vignesh") ? "vignesh.viscom@rathinam.in" : "faculty@rathinam.in");

    let resultQ: QuestionItem;
    if (question.id !== undefined && question.id !== null) {
      const idx = list.findIndex((q) => String(q.id) === String(question.id));
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
           ...question,
           subject: normalizedSubject,
          department: resolvedDept,
          uploadedBy: resolvedStaff,
          email: resolvedEmail,
        } as QuestionItem;
        saveToStorage("questions", list);
        resultQ = list[idx];
      } else {
        resultQ = {
          ...question,
          id: question.id,
          question: question.question || "Untitled Question",
          subject: normalizedSubject,
          unit: question.unit || "Unit I - Introduction",
          topic: question.topic || "Topic 1 - Overview",
          type: question.type || "Descriptive",
          difficulty: question.difficulty || "Medium",
          status: question.status || "Pending",
          addedOn: question.addedOn || new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          marks: Number(question.marks || 5),
          options: question.options || [],
          correctAnswer: question.correctAnswer || "",
          uploadedBy: resolvedStaff,
          department: resolvedDept,
          email: resolvedEmail,
          date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        };
        list.unshift(resultQ);
        saveToStorage("questions", list);
      }
    } else {
      resultQ = {
        ...question,
        id: Date.now(),
        question: question.question || "Untitled Question",
        subject: normalizedSubject,
        unit: question.unit || "Unit I - Introduction",
        topic: question.topic || "Topic 1 - Overview",
        type: question.type || "Descriptive",
        difficulty: question.difficulty || "Medium",
        status: question.status || "Pending",
        addedOn: question.addedOn || new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        marks: Number(question.marks || 5),
        options: question.options || [],
        correctAnswer: question.correctAnswer || "",
        uploadedBy: resolvedStaff,
        department: resolvedDept,
        email: resolvedEmail,
        date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      };
      list.unshift(resultQ);
      saveToStorage("questions", list);
    }

    // Supabase persistence happens in saveToStorage -> pushCollection("questions").

    if (!question.id) {
      this.notifyQuestionAddition(resultQ.uploadedBy || "Faculty", resultQ.subject, 1);
    }

    this.recalculateSubjectStats();
    return resultQ;
  },

  notifyQuestionAddition(uploadedBy: string, subject: string, countAdded = 1) {
    const list = this.getNotifications();
    const approverName = "Dr. T.J RAJU (HOD Viscom - hod.viscom@rathinam.in)";
    const targetSub = (subject || "").trim().toLowerCase();
    const existingIdx = list.findIndex(
      (n) =>
        n.status === "Unread" &&
        n.title.toLowerCase().includes("question") &&
        n.title.toLowerCase().includes(uploadedBy.toLowerCase()) &&
        ((n.relatedTo || "").trim().toLowerCase() === targetSub ||
          (targetSub.length > 3 && ((n.relatedTo || "").toLowerCase().includes(targetSub) || targetSub.includes((n.relatedTo || "").toLowerCase()))))
    );

    if (existingIdx !== -1) {
      const currentDesc = list[existingIdx].description;
      const match = currentDesc.match(/(\d+)\s+question/i);
      const prevCount = match ? parseInt(match[1], 10) : 1;
      const newTotal = prevCount + countAdded;

      list[existingIdx].title = `New Questions Added by ${uploadedBy}`;
      list[existingIdx].description = `${uploadedBy} added ${newTotal} question(s) for ${subject}. Routed to ${approverName} for HOD Approval.`;
      list[existingIdx].timeAgo = "Just now";
      list[existingIdx].exactTime = "Today at " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      saveToStorage("notifications", list);
      notifyUpdate();
    } else {
      this.saveNotification({
        title: countAdded > 1 ? `New Questions Added by ${uploadedBy}` : `New Question Added by ${uploadedBy}`,
        description: `${uploadedBy} added ${countAdded} question(s) for ${subject}. Routed to ${approverName} for HOD Approval.`,
        type: "Approval",
        priority: "High",
        relatedTo: subject,
        status: "Unread",
      });
    }
  },

  deleteQuestion(id: number | string): void {
    const list = this.getQuestions().filter((q) => String(q.id) !== String(id));
    saveToStorage("questions", list);
    this.recalculateSubjectStats();

    if (isSupabaseConfigured()) {
      supabase.from("questions").delete().eq("id", String(id)).then(({ error }) => {
        if (error) console.warn("Supabase Question Delete error:", error.message);
      });
    }
  },
  runAiVerification(questionIds?: (string | number)[]): { verifiedCount: number; updatedQuestions: QuestionItem[] } {
    const questions = this.getQuestions();
    let count = 0;
    const nowStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const bloomLevels = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];

    questions.forEach((q) => {
      const match = !questionIds || questionIds.length === 0 || questionIds.some((id) => String(id) === String(q.id));
      if (match) {
        const score = Math.floor(Math.random() * 7) + 93; // 93-99%
        const isFlagged = q.question.length < 10 || (q.type === "MCQ" && (!q.options || q.options.length === 0));

        q.aiStatus = isFlagged ? "AI Flagged" : "AI Verified";
        q.aiScore = isFlagged ? Math.floor(Math.random() * 20) + 60 : score;
        q.bloomLevel = q.bloomLevel || bloomLevels[Math.floor(Math.random() * bloomLevels.length)];
        q.aiRemarks = isFlagged
          ? "Question text is brief or missing options. Human review recommended."
          : `Passed AI Audit: Phrasing syntax clear, Bloom taxonomy (${q.bloomLevel}) validated, distractor coverage complete. Quality Match ${q.aiScore}%.`;
        q.aiCheckedAt = nowStr;

        if (!isFlagged && (q.status === "Pending" || q.status === "Draft")) {
          q.status = "Verified";
        }
        count++;
      }
    });

    if (count > 0) {
      saveToStorage("questions", questions);
      this.logActivity(`Ran AI Verification on ${count} question(s)`, "AI Engine", `Verified ${count} item(s)`);
      this.recalculateSubjectStats();
      notifyUpdate();
    }
    return { verifiedCount: count, updatedQuestions: questions };
  },

  // ----------------- BULK UPLOAD CRUD -----------------
  getUploadHistory(): UploadHistoryItem[] {
    return getFromStorage("uploads", defaultUploadHistory);
  },
  saveUpload(item: Partial<UploadHistoryItem> & { id?: number | string }): UploadHistoryItem {
    const list = this.getUploadHistory();
    if (item.id !== undefined) {
      const idx = list.findIndex((u) => String(u.id) === String(item.id));
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...item } as UploadHistoryItem;
        saveToStorage("uploads", list);
        return list[idx];
      }
    }
    const newUpload: UploadHistoryItem = {
      id: item.id || Date.now(),
      name: item.name || "Questions_Upload.xlsx",
      type: item.type || "xlsx",
      subject: item.subject || "Viscom & VFX",
      unit: item.unit || "Unit I - General",
      totalQuestions: Number(item.totalQuestions ?? 0),
      uploadedBy: item.uploadedBy || "Vignesh",
      email: item.email || "admin@rgu.ac.in",
      status: item.status || "Success",
      date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    };
    list.unshift(newUpload);
    saveToStorage("uploads", list);

    // Auto-generate HOD Approval Notification
    this.saveNotification({
      title: `New Questions Uploaded by ${newUpload.uploadedBy}`,
      description: `${newUpload.uploadedBy} uploaded ${newUpload.totalQuestions} question(s) in batch "${newUpload.name}" for ${newUpload.subject}. Pending HOD Approval.`,
      type: "Approval",
      priority: "High",
      relatedTo: newUpload.subject,
      status: "Unread",
    });
    return newUpload;
  },
  deleteUpload(id: number | string): void {
    const list = this.getUploadHistory().filter((u) => String(u.id) !== String(id));
    saveToStorage("uploads", list);
  },
  getDismissedBatches(): string[] {
    return getFromStorage<string[]>("dismissed_batches", []);
  },
  dismissBatch(key: string): void {
    if (!key) return;
    const cleanKey = key.trim().toLowerCase();
    const list = this.getDismissedBatches();
    if (!list.includes(cleanKey)) {
      list.push(cleanKey);
      saveToStorage("dismissed_batches", list);
    }
  },
  undismissBatch(key: string): void {
    if (!key) return;
    const cleanKey = key.trim().toLowerCase();
    const list = this.getDismissedBatches().filter((k) => k !== cleanKey);
    saveToStorage("dismissed_batches", list);
  },

  // ----------------- NOTIFICATIONS CRUD -----------------
  getNotifications(): NotificationItem[] {
    const rawList = getFromStorage<NotificationItem[]>("notifications", defaultNotifications);

    // Collect all valid active subject names and codes from subjects and syllabus units
    const activeSubjects = this.getSubjects();
    const activeUnits = this.getUnits();
    const activeSubjectNames = new Set<string>();

    activeSubjects.forEach((s) => {
      if (s.name) activeSubjectNames.add(s.name.trim().toLowerCase());
      if (s.code) activeSubjectNames.add(s.code.trim().toLowerCase());
    });
    activeUnits.forEach((u) => {
      if (u.subject) activeSubjectNames.add(u.subject.trim().toLowerCase());
    });

    const deletedSubjects = getFromStorage<string[]>("deleted_subjects", []).map((s) => s.trim().toLowerCase());
    const dismissedBatches = this.getDismissedBatches().map((b) => b.trim().toLowerCase());

    const isDeletedOrOrphaned = (n: NotificationItem): boolean => {
      const rel = (n.relatedTo || "").trim().toLowerCase();
      const title = (n.title || "").toLowerCase();
      const desc = (n.description || "").toLowerCase();

      // System / Generic / Administrative notifications are always kept
      const genericKeys = ["general", "system", "coe", "all", "admin", "broadcast", "hod", "faculty", "dean"];
      if (genericKeys.includes(rel)) return false;

      // 1. Explicitly check if in deleted_subjects blacklist
      for (const del of deletedSubjects) {
        if (!del) continue;
        if (rel === del || rel.includes(del) || del.includes(rel) || title.includes(del) || desc.includes(del)) {
          return true;
        }
      }

      // 2. Explicitly check if in dismissed batches
      for (const b of dismissedBatches) {
        if (!b) continue;
        if (rel === b || rel.includes(b) || b.includes(rel) || title.includes(b) || desc.includes(b)) {
          return true;
        }
      }

      // 3. Specifically clean up Rotoscopy & Keying if no longer an active subject
      if (
        (rel.includes("rotoscopy") || title.includes("rotoscopy") || desc.includes("rotoscopy")) &&
        ![...activeSubjectNames].some((name) => name.includes("rotoscopy"))
      ) {
        return true;
      }

      // 4. If active subjects catalog is populated, purge notifications for subjects that no longer exist anywhere
      if (
        activeSubjectNames.size > 0 &&
        (n.type === "Approval" || n.type === "Bulk Upload" || n.type === "Question Bank" || n.type === "Verify Questions")
      ) {
        const matchesActive = [...activeSubjectNames].some(
          (name) => rel === name || rel.includes(name) || name.includes(rel)
        );
        if (!matchesActive) {
          return true;
        }
      }

      return false;
    };

    // Filter out all deleted and orphaned notifications
    const validNotifications = rawList.filter((n) => !isDeletedOrOrphaned(n));

    // Auto-persist cleaned list if any deleted notifications were pruned
    if (validNotifications.length !== rawList.length) {
      saveToStorage("notifications", validNotifications);
    }

    // Consolidate duplicate question notifications by user & subject
    const map = new Map<string, NotificationItem>();
    const consolidated: NotificationItem[] = [];

    validNotifications.forEach((n) => {
      const isQuestionAdded =
        n.title &&
        /New Questions?\s+(Added|Uploaded)\s+by/i.test(n.title);

      if (isQuestionAdded) {
        const uploader = n.title.replace(/New Questions?\s+(Added|Uploaded)\s+by\s*/i, "").trim();
        const key = `${uploader.toLowerCase()}_${(n.relatedTo || "").toLowerCase()}_${n.status}`;

        const countMatch = n.description.match(/(\d+)\s+question/i);
        const thisCount = countMatch ? parseInt(countMatch[1], 10) : 1;

        if (map.has(key)) {
          const existing = map.get(key)!;
          const match = existing.description.match(/(\d+)\s+question/i);
          const prevCount = match ? parseInt(match[1], 10) : 1;
          const updatedCount = prevCount + thisCount;

          existing.title = `New Questions Added by ${uploader}`;
          const approverMatch = existing.description.match(/Routed to\s+([^\.]+)\s+for HOD Approval/i);
          const routingText = approverMatch
            ? ` Routed to ${approverMatch[1]} for HOD Approval.`
            : " Pending HOD Approval.";
          existing.description = `${uploader} added ${updatedCount} question(s) for ${existing.relatedTo}.${routingText}`;
          existing.exactTime = n.exactTime || existing.exactTime;
          existing.timeAgo = "Just now";
        } else {
          const itemCopy = {
            ...n,
            title: `New Questions Added by ${uploader}`,
            description:
              n.description.includes("added") || n.description.includes("uploaded")
                ? n.description
                : `${uploader} added ${thisCount} question(s) for ${n.relatedTo}. Pending HOD Approval.`,
          };
          map.set(key, itemCopy);
          consolidated.push(itemCopy);
        }
      } else {
        consolidated.push(n);
      }
    });

    return consolidated;
  },
  saveNotification(notif: Partial<NotificationItem> & { id?: string }): NotificationItem {
    const list = this.getNotifications();
    if (notif.id) {
      const idx = list.findIndex((n) => n.id === notif.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...notif } as NotificationItem;
        saveToStorage("notifications", list);
        return list[idx];
      }
    }
    const newNotif: NotificationItem = {
      id: notif.id || `notif-${Date.now()}`,
      title: notif.title || "New System Notice",
      description: notif.description || "",
      type: notif.type || "System",
      priority: notif.priority || "Medium",
      relatedTo: notif.relatedTo || "General",
      relatedSub: notif.relatedSub,
      timeAgo: "Just now",
      exactTime: "Today at " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: notif.status || "Unread",
    };
    list.unshift(newNotif);
    saveToStorage("notifications", list);
    return newNotif;
  },
  deleteNotification(id: string): void {
    const raw = getFromStorage<NotificationItem[]>("notifications", defaultNotifications);
    const target = raw.find((n) => n.id === id);
    let updated: NotificationItem[];
    if (target && target.title && /New Questions?\s+(Added|Uploaded)\s+by/i.test(target.title)) {
      const uploader = target.title.replace(/New Questions?\s+(Added|Uploaded)\s+by\s*/i, "").trim().toLowerCase();
      const subject = (target.relatedTo || "").trim().toLowerCase();
      updated = raw.filter((n) => {
        if (n.id === id) return false;
        if (n.title && /New Questions?\s+(Added|Uploaded)\s+by/i.test(n.title)) {
          const up = n.title.replace(/New Questions?\s+(Added|Uploaded)\s+by\s*/i, "").trim().toLowerCase();
          const sub = (n.relatedTo || "").trim().toLowerCase();
          if (up === uploader && sub === subject) return false;
        }
        return true;
      });
    } else {
      updated = raw.filter((n) => n.id !== id);
    }
    saveToStorage("notifications", updated);
    notifyUpdate();
  },
  markAllNotificationsRead(): void {
    const list = this.getNotifications().map((n) => ({
      ...n,
      status: "Read" as const,
    }));
    saveToStorage("notifications", list);
    notifyUpdate();
  },
  clearNotificationsForSubject(subjectName: string): void {
    if (!subjectName) return;
    const target = subjectName.trim().toLowerCase();
    const raw = getFromStorage<NotificationItem[]>("notifications", defaultNotifications);
    const filtered = raw.filter((n) => {
      const rel = (n.relatedTo || "").trim().toLowerCase();
      const title = (n.title || "").toLowerCase();
      const desc = (n.description || "").toLowerCase();
      if (rel === target || (target.length > 2 && (rel.includes(target) || target.includes(rel)))) return false;
      if (target.length > 3 && (title.includes(target) || desc.includes(target))) return false;
      return true;
    });
    saveToStorage("notifications", filtered);
    notifyUpdate();
  },
  clearAllNotifications(): void {
    saveToStorage("notifications", []);
    notifyUpdate();
  },

  // ----------------- DIRECT MESSAGES CRUD -----------------
  getMessages(): MessageItem[] {
    return getFromStorage<MessageItem[]>("messages", defaultMessages);
  },
  sendMessage(msg: Partial<MessageItem>): MessageItem {
    const list = this.getMessages();
    const newMsg: MessageItem = {
      id: msg.id || `msg-${Date.now()}`,
      senderName: msg.senderName || "Exam Cell User",
      senderRole: msg.senderRole || "STAFF",
      senderEmail: msg.senderEmail || "user@rathinam.in",
      recipientRole: msg.recipientRole || "HOD",
      recipientName: msg.recipientName || "Dr. Sathish Murugan (HOD)",
      subject: msg.subject || "Academic Question Query",
      content: msg.content || "",
      timeAgo: "Just now",
      exactTime: "Today at " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "Unread",
    };
    list.unshift(newMsg);
    saveToStorage("messages", list);

    this.saveNotification({
      title: `Direct Message from ${newMsg.senderName}`,
      description: `"${newMsg.subject}": ${newMsg.content.slice(0, 45)}...`,
      type: "Message",
      priority: "Medium",
      relatedTo: newMsg.recipientRole,
      status: "Unread",
    });

    notifyUpdate();
    return newMsg;
  },
  markMessageRead(id: string): void {
    const list = this.getMessages().map((m) => (m.id === id ? { ...m, status: "Read" as const } : m));
    saveToStorage("messages", list);
    notifyUpdate();
  },
  deleteMessage(id: string): void {
    const list = this.getMessages().filter((m) => m.id !== id);
    saveToStorage("messages", list);
    notifyUpdate();
  },

  // ----------------- USERS CRUD -----------------
  getUsers(): UserItem[] {
    return getFromStorage("users", defaultUsers);
  },
  saveUser(user: Partial<UserItem> & { id?: string }): UserItem {
    const list = this.getUsers();
    if (user.id) {
      const idx = list.findIndex((u) => u.id === user.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...user } as UserItem;
        saveToStorage("users", list);
        return list[idx];
      }
    }
    const newUser: UserItem = {
      id: user.id || `usr-${Date.now()}`,
      name: user.name || "New Staff",
      email: user.email || "staff@rgu.ac.in",
      role: user.role || "Faculty",
      department: user.department || "Visual Arts",
      status: user.status || "Active",
      lastLogin: "Never",
    };
    list.unshift(newUser);
    saveToStorage("users", list);
    return newUser;
  },
  deleteUser(id: string): void {
    const list = this.getUsers().filter((u) => u.id !== id);
    saveToStorage("users", list);
  },

  // ----------------- STAFF / FACULTY CRUD -----------------
  getAllStaffFaculty(): StaffFacultyItem[] {
    return getFromStorage<StaffFacultyItem[]>("staff_faculty", defaultStaffFaculty);
  },
  getStaffFaculty(role?: "HOD" | "DEAN" | "COE" | string): StaffFacultyItem[] {
    let all = this.getAllStaffFaculty();
    all = all.map((staff) => {
      const fallback = defaultStaffFaculty.find((d) => d.id === staff.id || d.name === staff.name || d.email === staff.email);
      if (fallback) {
        return {
          ...fallback,
          ...staff,
          assignedSubjects: (staff.assignedSubjects && staff.assignedSubjects.length > 0) ? staff.assignedSubjects : fallback.assignedSubjects,
          employeeId: staff.employeeId || fallback.employeeId,
          assignedSyllabus: (staff.assignedSyllabus && staff.assignedSyllabus.length > 0) ? staff.assignedSyllabus : fallback.assignedSyllabus,
          syllabusCount: typeof staff.syllabusCount === "number" ? staff.syllabusCount : fallback.syllabusCount,
          questionsContributed: typeof staff.questionsContributed === "number" ? staff.questionsContributed : fallback.questionsContributed,
          pendingReviews: typeof staff.pendingReviews === "number" ? staff.pendingReviews : fallback.pendingReviews,
        };
      }
      return staff;
    });

    if (!role || role === "COE") return all;
    if (role === "HOD") {
      return all.filter((f) => f.reportingTo === "HOD" || f.reportingTo === "Both");
    }
    if (role === "DEAN") {
      return all.filter((f) => f.reportingTo === "DEAN" || f.reportingTo === "Both");
    }
    if (role === "STAFF") {
      if (typeof window !== "undefined") {
        try {
          const authUserStr = localStorage.getItem("exam_cell_auth_user");
          if (authUserStr) {
            const authUser = JSON.parse(authUserStr);
            const userEmail = (authUser.email || "").toLowerCase().trim();
            const cleanUserName = (authUser.name || "")
              .toLowerCase()
              .replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s*/gi, "")
              .trim();
            const staffTokens = ["gayathiri", "gayathri", "vignesh", "vishal", "athreya", "saravanan", "kailash"];
            const userMatchedToken = staffTokens.find((tok) => userEmail.includes(tok) || cleanUserName.includes(tok));

            const matched = all.filter((s) => {
              const sEmail = (s.email || "").toLowerCase().trim();
              const sName = (s.name || "")
                .toLowerCase()
                .replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s*/gi, "")
                .trim();
              const emailMatches =
                sEmail === userEmail ||
                (userEmail && sEmail && (userEmail.startsWith(sEmail.split("@")[0]) || sEmail.startsWith(userEmail.split("@")[0])));
              const nameMatches =
                sName === cleanUserName ||
                (cleanUserName && sName && (sName.includes(cleanUserName) || cleanUserName.includes(sName))) ||
                (Boolean(userMatchedToken) && (sEmail.includes(userMatchedToken!) || sName.includes(userMatchedToken!)));
              return emailMatches || nameMatches;
            });

            if (matched.length > 0) return [matched[0]];
          }
        } catch (e) {}
      }
    }
    return all;
  },
  setStaffFacultyList(list: StaffFacultyItem[], emitNotify = true): void {
    saveToStorage("staff_faculty", list);
    if (emitNotify) notifyUpdate();
  },
  saveStaffFaculty(item: Partial<StaffFacultyItem> & { id?: string }): StaffFacultyItem {
    const list = getFromStorage<StaffFacultyItem[]>("staff_faculty", defaultStaffFaculty);
    if (item.id) {
      const idx = list.findIndex((f) => f.id === item.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...item } as StaffFacultyItem;
        saveToStorage("staff_faculty", list);
        notifyUpdate();
        return list[idx];
      }
    }
    const newItem: StaffFacultyItem = {
      id: item.id || `fac-${Date.now()}`,
      name: item.name || "New Faculty Member",
      designation: item.designation || "Assistant Professor",
      employeeId: item.employeeId || "",
      department: item.department || "Visual Communication",
      school: item.school || "Rathinam Global University",
      email: item.email || "faculty@rathinam.in",
      phone: item.phone || "",
      qualification: item.qualification || "",
      experience: item.experience || "",
      reportingTo: (item.reportingTo as any) || "HOD",
      reportingOfficerName: item.reportingOfficerName || "Head of Department (HOD)",
      assignedSubjects: item.assignedSubjects || [],
      syllabusCount: Number(item.syllabusCount || item.assignedSyllabus?.length || 0),
      assignedSyllabus: item.assignedSyllabus || [],
      questionsContributed: Number(item.questionsContributed || 0),
      pendingReviews: Number(item.pendingReviews || 0),
      status: item.status || "Active",
      avatarBg: item.avatarBg || "linear-gradient(135deg, #d4a780, #deba9b)",
    };
    list.unshift(newItem);
    saveToStorage("staff_faculty", list);
    notifyUpdate();
    return newItem;
  },
  deleteStaffFaculty(id: string): void {
    const list = getFromStorage<StaffFacultyItem[]>("staff_faculty", defaultStaffFaculty).filter(
      (f) => f.id !== id
    );
    saveToStorage("staff_faculty", list);
    notifyUpdate();
  },
  /**
   * Role-guarded faculty allocation. The signed-in user is re-read from storage
   * (never trusted from the caller) and must be allowed for `level`.
   * HOD may only allocate faculty reporting to HOD/Both; DEAN only DEAN/Both; COE any.
   * Throws Error("403 ...") when unauthorized.
   */
  allocateFaculty(level: AllocationLevel, facultyId: string, subjects: string[]): StaffFacultyItem {
    let role: string | undefined;
    let actorName = "Unknown";
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("exam_cell_auth_user") : null;
      if (raw) {
        const u = JSON.parse(raw);
        role = u?.role;
        actorName = u?.name || actorName;
      }
    } catch (e) {}
    if (!canAllocateFaculty(role as any, level)) {
      throw new Error(`403 Forbidden: role ${role || "UNAUTHENTICATED"} cannot perform ${level} faculty allocation.`);
    }
    const list = getFromStorage<StaffFacultyItem[]>("staff_faculty", defaultStaffFaculty);
    const idx = list.findIndex((f) => f.id === facultyId);
    if (idx === -1) throw new Error(`404 Not Found: faculty ${facultyId} does not exist.`);
    const target = list[idx];
    if (role !== "COE" && target.reportingTo !== "Both" && target.reportingTo !== level) {
      throw new Error(`403 Forbidden: ${target.name} reports to ${target.reportingTo}, not ${level}.`);
    }
    list[idx] = { ...target, assignedSubjects: Array.from(new Set(subjects)) };
    saveToStorage("staff_faculty", list);
    notifyUpdate();
    try {
      this.logActivity(
        `${level} Faculty Allocation`,
        "Staff Faculty",
        `${target.name} allocated ${list[idx].assignedSubjects.length} subject(s)`,
        actorName
      );
    } catch (e) {}
    return list[idx];
  },

  // ----------------- INSTITUTIONAL HIERARCHY & ALLOCATION -----------------
  getInstitutionalHierarchy(): InstitutionalSchool[] {
    return INSTITUTIONAL_HIERARCHY;
  },

  getSchoolByNameOrId(identifier: string): InstitutionalSchool | undefined {
    if (!identifier) return undefined;
    const clean = identifier.trim().toLowerCase();
    return INSTITUTIONAL_HIERARCHY.find(
      (s) =>
        s.id.toLowerCase() === clean ||
        s.name.toLowerCase() === clean ||
        s.code.toLowerCase() === clean ||
        s.name.toLowerCase().includes(clean) ||
        clean.includes(s.name.toLowerCase())
    );
  },

  getDepartmentByNameOrId(deptIdentifier: string, schoolIdentifier?: string): InstitutionalDepartment | undefined {
    if (!deptIdentifier) return undefined;
    const cleanDept = deptIdentifier.trim().toLowerCase();
    const schools = schoolIdentifier
      ? [this.getSchoolByNameOrId(schoolIdentifier)].filter(Boolean) as InstitutionalSchool[]
      : INSTITUTIONAL_HIERARCHY;

    for (const sc of schools) {
      const match = sc.departments.find(
        (d) =>
          d.id.toLowerCase() === cleanDept ||
          d.name.toLowerCase() === cleanDept ||
          d.code.toLowerCase() === cleanDept ||
          d.name.toLowerCase().includes(cleanDept) ||
          cleanDept.includes(d.name.toLowerCase())
      );
      if (match) return match;
    }
    return undefined;
  },

  getDeanForSchool(schoolIdentifier: string): { name: string; email: string; roleTitle?: string } | undefined {
    const sc = this.getSchoolByNameOrId(schoolIdentifier);
    if (!sc) return undefined;
    return { name: sc.deanName, email: sc.deanEmail, roleTitle: sc.deanRoleTitle };
  },

  getHodForDepartment(deptIdentifier: string): { name: string; email: string; roleTitle?: string } | undefined {
    const dept = this.getDepartmentByNameOrId(deptIdentifier);
    if (!dept) return undefined;
    return { name: dept.hodName, email: dept.hodEmail, roleTitle: dept.hodRoleTitle };
  },

  getDepartmentSubjects(deptIdentifier?: string): { code: string; name: string; display: string }[] {
    let list = INSTITUTIONAL_SUBJECTS;
    if (deptIdentifier && deptIdentifier !== "All") {
      const cleanDept = deptIdentifier.toLowerCase().replace("department of ", "").trim();
      const filtered = list.filter(
        (s) =>
          s.department.toLowerCase().includes(cleanDept) ||
          cleanDept.includes(s.department.toLowerCase().replace("department of ", ""))
      );
      if (filtered.length > 0) {
        list = filtered;
      }
    }
    return list.map((s) => ({
      code: s.code,
      name: s.name,
      display: `${s.name} (${s.code})`,
    }));
  },

  resolveFacultyHierarchy(facultyIdOrNameOrEmail: string): FacultyAllocationHierarchyResult {
    const allFaculty = this.getAllStaffFaculty();
    const cleanInput = (facultyIdOrNameOrEmail || "").trim().toLowerCase();

    const faculty = allFaculty.find(
      (f) =>
        f.id.toLowerCase() === cleanInput ||
        f.name.toLowerCase() === cleanInput ||
        f.email.toLowerCase() === cleanInput ||
        f.employeeId.toLowerCase() === cleanInput ||
        f.name.toLowerCase().includes(cleanInput)
    ) || null;

    const validationErrors: string[] = [];

    if (!faculty) {
      return {
        faculty: null,
        school: null,
        dean: null,
        department: null,
        hod: null,
        hierarchyChain: [],
        hierarchyString: "Unallocated",
        isValid: false,
        validationErrors: ["Faculty member not found in directory."],
      };
    }

    // Identify Department & School
    let dept = this.getDepartmentByNameOrId(faculty.department);
    let school = faculty.school ? this.getSchoolByNameOrId(faculty.school) : undefined;

    if (!school && dept) {
      school = INSTITUTIONAL_HIERARCHY.find((s) => s.departments.some((d) => d.id === dept?.id || d.name === dept?.name));
    }

    if (!school) {
      school = INSTITUTIONAL_HIERARCHY[0];
    }
    if (!dept) {
      dept = school.departments[0];
    }

    const dean = {
      name: school.deanName,
      email: school.deanEmail,
      roleTitle: school.deanRoleTitle,
    };

    const hod = {
      name: dept.hodName,
      email: dept.hodEmail,
      roleTitle: dept.hodRoleTitle,
    };

    const hierarchyChain = [
      { level: "School", name: school.name, subtext: school.code },
      { level: "School Dean", name: dean.name, subtext: dean.roleTitle || "Dean" },
      { level: "School Department", name: dept.name, subtext: dept.code },
      { level: "Department HOD", name: hod.name, subtext: hod.roleTitle || "HOD" },
      { level: "Faculty", name: faculty.name, subtext: `${faculty.designation} (${faculty.employeeId})` },
    ];

    const hierarchyString = `${school.name} → ${dean.name} → ${dept.name} → ${hod.name} → ${faculty.name}`;

    return {
      faculty,
      school,
      dean,
      department: dept,
      hod,
      hierarchyChain,
      hierarchyString,
      isValid: validationErrors.length === 0,
      validationErrors,
    };
  },

  validateFacultyAllocation(input: {
    facultyId?: string;
    facultyName?: string;
    schoolName?: string;
    departmentName?: string;
    deanName?: string;
    hodName?: string;
  }): {
    isValid: boolean;
    errors: string[];
    resolvedSchool: InstitutionalSchool | null;
    resolvedDean: { name: string; email: string } | null;
    resolvedDepartment: InstitutionalDepartment | null;
    resolvedHod: { name: string; email: string } | null;
    resolvedFaculty: StaffFacultyItem | null;
  } {
    const errors: string[] = [];

    // 1. Identify School
    const school = input.schoolName ? this.getSchoolByNameOrId(input.schoolName) : null;
    if (!school) {
      errors.push("Invalid School: Please select a valid Rathinam University School.");
    }

    // 2. School Dean rule: Dean must be exclusively mapped to this school
    let resolvedDean: { name: string; email: string } | null = null;
    if (school) {
      resolvedDean = { name: school.deanName, email: school.deanEmail };
      if (input.deanName && input.deanName.trim() && !school.deanName.toLowerCase().includes(input.deanName.trim().toLowerCase())) {
        errors.push(`Dean Mapping Conflict: A Dean can only be assigned to their mapped School. "${input.deanName}" is not the designated Dean of "${school.name}".`);
      }
    }

    // 3. School Department rule: Department must belong to this specific school
    let resolvedDept: InstitutionalDepartment | null = null;
    if (school && input.departmentName) {
      resolvedDept = school.departments.find(
        (d) =>
          d.name.toLowerCase() === input.departmentName?.trim().toLowerCase() ||
          d.code.toLowerCase() === input.departmentName?.trim().toLowerCase() ||
          input.departmentName?.trim().toLowerCase().includes(d.name.toLowerCase())
      ) || null;

      if (!resolvedDept) {
        const otherSchool = INSTITUTIONAL_HIERARCHY.find((s) =>
          s.departments.some(
            (d) =>
              d.name.toLowerCase() === input.departmentName?.trim().toLowerCase() ||
              d.code.toLowerCase() === input.departmentName?.trim().toLowerCase()
          )
        );

        if (otherSchool) {
          errors.push(
            `Cross-School Allocation Forbidden: "${input.departmentName}" belongs to "${otherSchool.name}", and cannot be allocated under "${school.name}".`
          );
        } else {
          errors.push(`Invalid Department: "${input.departmentName}" does not belong to "${school.name}".`);
        }
      }
    }

    // 4. Department HOD rule: HOD must belong exclusively to this department
    let resolvedHod: { name: string; email: string } | null = null;
    if (resolvedDept) {
      resolvedHod = { name: resolvedDept.hodName, email: resolvedDept.hodEmail };
      if (input.hodName && input.hodName.trim() && !resolvedDept.hodName.toLowerCase().includes(input.hodName.trim().toLowerCase())) {
        errors.push(
          `HOD Mapping Conflict: An HOD can only be assigned to their mapped Department. "${input.hodName}" is not the designated HOD of "${resolvedDept.name}".`
        );
      }
    }

    // 5. Faculty rule: Faculty member must exist
    let resolvedFaculty: StaffFacultyItem | null = null;
    if (input.facultyId || input.facultyName) {
      const allFaculty = this.getAllStaffFaculty();
      resolvedFaculty = allFaculty.find(
        (f) =>
          (input.facultyId && f.id === input.facultyId) ||
          (input.facultyName && f.name.toLowerCase() === input.facultyName.trim().toLowerCase())
      ) || null;

      if (!resolvedFaculty) {
        errors.push("Selected faculty member was not found in directory.");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      resolvedSchool: school || null,
      resolvedDean,
      resolvedDepartment: resolvedDept,
      resolvedHod,
      resolvedFaculty,
    };
  },

  allocateFacultyWithHierarchy(data: {
    facultyId: string;
    schoolName: string;
    departmentName: string;
    deanName?: string;
    hodName?: string;
    assignedSubjects?: string[];
    reportingTo?: "HOD" | "DEAN" | "Both";
    allocationLevel?: AllocationLevel;
    actorRole?: string;
    actorName?: string;
  }): StaffFacultyItem {
    const validation = this.validateFacultyAllocation({
      facultyId: data.facultyId,
      schoolName: data.schoolName,
      departmentName: data.departmentName,
      deanName: data.deanName,
      hodName: data.hodName,
    });

    if (!validation.isValid) {
      throw new Error(`Allocation Validation Failed: ${validation.errors.join(" ")}`);
    }

    const list = getFromStorage<StaffFacultyItem[]>("staff_faculty", defaultStaffFaculty);
    const idx = list.findIndex((f) => f.id === data.facultyId);
    if (idx === -1) throw new Error(`Faculty ID ${data.facultyId} not found.`);

    const target = list[idx];
    const resolvedSchool = validation.resolvedSchool!;
    const resolvedDept = validation.resolvedDepartment!;
    const resolvedDean = validation.resolvedDean!;
    const resolvedHod = validation.resolvedHod!;

    const updated: StaffFacultyItem = {
      ...target,
      school: resolvedSchool.name,
      deanName: resolvedDean.name,
      deanEmail: resolvedDean.email,
      department: resolvedDept.name,
      hodName: resolvedHod.name,
      hodEmail: resolvedHod.email,
      reportingOfficerName: `${resolvedHod.name} (HOD)`,
      reportingTo: data.reportingTo || target.reportingTo || "HOD",
      assignedSubjects: data.assignedSubjects && data.assignedSubjects.length > 0 ? Array.from(new Set(data.assignedSubjects)) : target.assignedSubjects,
    };

    list[idx] = updated;
    saveToStorage("staff_faculty", list);
    this.touchLastUpdated();
    notifyUpdate();

    try {
      this.logActivity(
        "COE Faculty Allocation",
        "Staff Faculty",
        `Allocated ${updated.name}: ${resolvedSchool.name} → ${resolvedDean.name} → ${resolvedDept.name} → ${resolvedHod.name}`,
        data.actorName || "COE Officer"
      );
    } catch (e) {}

    return updated;
  },

  // ----------------- ACTIVITIES CRUD -----------------
  getActivities(): ActivityItem[] {
    return getFromStorage("activities", defaultActivities);
  },
  logActivity(activity: string, module: string, details: string, performedBy = "Vignesh"): ActivityItem {
    const list = this.getActivities();
    const item: ActivityItem = {
      id: `act-${Date.now()}`,
      activity,
      module,
      performedBy,
      dateTime: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      details,
    };
    list.unshift(item);
    saveToStorage("activities", list.slice(0, 50));
    return item;
  },
  deleteActivity(id: string): void {
    const list = this.getActivities().filter((a) => a.id !== id);
    saveToStorage("activities", list);
  },
  updateActivity(id: string, data: Partial<ActivityItem>): void {
    const list = this.getActivities();
    const idx = list.findIndex((a) => a.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...data } as ActivityItem;
      saveToStorage("activities", list);
    }
  },

  // ----------------- SYLLABUS APPROVALS CRUD -----------------
  getSyllabusApprovals(): SyllabusApprovalItem[] {
    const list = getFromStorage<SyllabusApprovalItem[]>("syllabus_approvals", []);
    // Completely purge any old dummy pre-seeded items
    const seenDocuments = new Set<string>();
    const cleaned = list.filter((item) => {
      const id = String(item.id || "").toLowerCase();
      const documentName = String(item.documentName || "").trim().toLowerCase();
      if (documentName === "augmented reality & vfx.docx" || (String(item.courseCode || "").toUpperCase() === "VIS-301" && !documentName)) {
        return false;
      }
      if (
        id.startsWith("syl-appr-aish-") ||
        id.startsWith("syl-appr-vig-") ||
        id.startsWith("syl-appr-vish-") ||
        id.startsWith("syl-appr-gaya-") ||
        id.startsWith("syl-appr-ath-") ||
        id.startsWith("syl-appr-sar-") ||
        id.startsWith("syl-appr-kai-") ||
        id.startsWith("syl-appr-pri-") ||
        id.startsWith("syl-appr-man-")
      ) {
        return false;
      }
      // One uploaded document should produce one review row even if a stale
      // browser tab wrote the same record more than once.
      const documentKey = `${String(item.courseCode || item.courseName || "").trim().toLowerCase()}|${documentName}`;
      if (documentName && seenDocuments.has(documentKey)) {
        return false;
      }
      if (documentName) seenDocuments.add(documentKey);
      return true;
    });

    if (cleaned.length !== list.length) {
      saveToStorage("syllabus_approvals", cleaned);
    }
    return cleaned;
  },

  /**
   * Staff should only see the syllabus records they submitted. Review roles
   * (HOD, DEAN and COE) need the complete queue for verification and approval.
   */
  getSyllabusApprovalsForUser(role?: string, userEmail?: string, userName?: string): SyllabusApprovalItem[] {
    const allApprovals = this.getSyllabusApprovals();
    if ((role || "").toUpperCase() !== "STAFF") return allApprovals;

    const email = (userEmail || "").toLowerCase().trim();
    const name = (userName || "")
      .toLowerCase()
      .replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s*/i, "")
      .trim();

    return allApprovals.filter((approval) => {
      const submittedEmail = (approval.submitterEmail || "").toLowerCase().trim();
      const submittedName = (approval.submittedBy || "")
        .toLowerCase()
        .replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s*/i, "")
        .trim();

      return Boolean(
        (email && submittedEmail === email) ||
        (name && submittedName && (submittedName === name || submittedName.includes(name) || name.includes(submittedName)))
      );
    });
  },

  clearAllSyllabusApprovals(): void {
    saveToStorage("syllabus_approvals", []);
    notifyUpdate();
  },

  saveSyllabusApproval(item: Partial<SyllabusApprovalItem> & { id?: string }): SyllabusApprovalItem {
    const list = this.getSyllabusApprovals();
    let savedItem: SyllabusApprovalItem;
    if (item.id) {
      const idx = list.findIndex((a) => a.id === item.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...item } as SyllabusApprovalItem;
        savedItem = list[idx];
        saveToStorage("syllabus_approvals", list);
        notifyUpdate();
        return savedItem;
      }
    }
    savedItem = {
      id: item.id || `syl-appr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      courseCode: item.courseCode || "VIS-101",
      courseName: item.courseName || "Visual Communication",
      department: item.department || "Dept of Visual Communication",
      semester: item.semester || "Semester 1",
      submittedBy: item.submittedBy || "Faculty Member",
      submitterEmail: item.submitterEmail || "faculty@rathinam.in",
      submittedAt:
        item.submittedAt ||
        new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
          ", " +
          new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      totalUnits: Number(item.totalUnits || 5),
      totalTopics: Number(item.totalTopics || 20),
      stage: item.stage || "hod",
      status: item.status || "Pending",
      staffStatus: item.staffStatus || "Submitted",
      hodStatus: item.hodStatus || "Pending",
      hodName: item.hodName,
      hodDate: item.hodDate,
      deanStatus: item.deanStatus || "Waiting_HOD",
      deanName: item.deanName,
      deanDate: item.deanDate,
      coeStatus: item.coeStatus || "Waiting_Dean",
      coeName: item.coeName,
      coeDate: item.coeDate,
      remarks: item.remarks || "Syllabus uploaded and awaiting HOD verification.",
      documentName: item.documentName,
      documentFormat: item.documentFormat,
      documentText: item.documentText,
      documentData: item.documentData,
    };
    list.unshift(savedItem);
    saveToStorage("syllabus_approvals", list);
    notifyUpdate();
    return savedItem;
  },

  updateSyllabusApproval(id: string, updates: Partial<SyllabusApprovalItem>): SyllabusApprovalItem | null {
    const list = this.getSyllabusApprovals();
    const idx = list.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates };
    saveToStorage("syllabus_approvals", list);
    notifyUpdate();
    return list[idx];
  },

  deleteSyllabusApproval(id: string): void {
    const list = this.getSyllabusApprovals().filter((a) => a.id !== id);
    saveToStorage("syllabus_approvals", list);
    notifyUpdate();
  },

  getStaffAssignedSubjects(userEmail?: string, userName?: string): { subjects: string[]; syllabi: string[] } {
    const allStaff = this.getAllStaffFaculty();
    const cleanUserEmail = (userEmail || "").toLowerCase().trim();
    const cleanUserName = (userName || "")
      .toLowerCase()
      .replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s*/gi, "")
      .trim();

    const matchedStaff = allStaff.find((s) => {
      const sEmail = (s.email || "").toLowerCase().trim();
      const sName = (s.name || "")
        .toLowerCase()
        .replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s*/gi, "")
        .trim();
      return (
        (cleanUserEmail && sEmail && (sEmail === cleanUserEmail || cleanUserEmail.includes(sEmail.split("@")[0]))) ||
        (cleanUserName && sName && (sName === cleanUserName || cleanUserName.includes(sName) || sName.includes(cleanUserName)))
      );
    });

    // HOD/Dean allocations can be stored in subject_allocations instead of
    // staff_faculty. Merge both sources so a logged-in faculty member sees
    // every allocation regardless of which allocation screen was used.
    const normalizedName = (value: string) =>
      value
        .toLowerCase()
        .replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s*/i, "")
        .replace(/[^a-z0-9]/g, "");
    const allocationNameMatches = (facultyName: string) => {
      const allocationKey = normalizedName(facultyName);
      const userKey = normalizedName(userName || "");
      return Boolean(allocationKey && userKey && (allocationKey === userKey || allocationKey.includes(userKey) || userKey.includes(allocationKey)));
    };

    const allocationSubjects = this.getSubjectAllocations()
      .filter((allocation) =>
        (matchedStaff && allocation.facultyId === matchedStaff.id) ||
        Boolean(allocation.facultyName && allocationNameMatches(allocation.facultyName))
      )
      .map((allocation) => `${allocation.subjectName} (${allocation.subjectCode})`);

    if (matchedStaff || allocationSubjects.length > 0) {
      return {
        subjects: Array.from(new Set([...(matchedStaff?.assignedSubjects || []), ...allocationSubjects])),
        syllabi: matchedStaff?.assignedSyllabus || [],
      };
    }

    // Default if Dr. Aishwarya Lakshmi or user profile
    if (cleanUserEmail.includes("aishwarya") || cleanUserName.includes("aishwarya")) {
      return {
        subjects: ["Visual Communication & Media Ethics", "Digital Media Design & Production"],
        syllabi: ["Visual Communication & Media Ethics", "Digital Media Design & Production"],
      };
    }

    return { subjects: [], syllabi: [] };
  },

  // ----------------- CONVENIENCE ALIASES -----------------
  addQuestion(q: Partial<QuestionItem>): QuestionItem {
    return this.saveQuestion(q);
  },
  updateQuestion(id: number | string, data: Partial<QuestionItem>): QuestionItem {
    return this.saveQuestion({ ...data, id });
  },
  addSubject(s: Partial<SubjectItem>): SubjectItem {
    return this.saveSubject(s);
  },
  updateSubject(id: string, data: Partial<SubjectItem>): SubjectItem {
    return this.saveSubject({ ...data, id });
  },
  addUnit(u: Partial<SyllabusUnit>): SyllabusUnit {
    return this.saveUnit(u);
  },
  updateUnit(id: string, data: Partial<SyllabusUnit>): SyllabusUnit {
    return this.saveUnit({ ...data, id });
  },
  addNotification(n: Partial<NotificationItem>): NotificationItem {
    return this.saveNotification(n);
  },
  updateNotification(id: string, data: Partial<NotificationItem>): NotificationItem {
    return this.saveNotification({ ...data, id });
  },
  addUpload(u: Partial<UploadHistoryItem>): UploadHistoryItem {
    return this.saveUpload(u);
  },
  updateUpload(id: number | string, data: Partial<UploadHistoryItem>): UploadHistoryItem {
    return this.saveUpload({ ...data, id });
  },

  // ----------------- BATCH OPERATIONS & 3-TIER VERIFICATION PIPELINE -----------------
  hodVerifyQuestions(ids: (number | string)[], verifierName = "Dr. T.J RAJU"): number {
    const list = this.getQuestions();
    let count = 0;
    const idSet = new Set(ids.map(String));
    let lastSubject = "Viscom & VFX";
    list.forEach((q) => {
      if (idSet.has(String(q.id))) {
        q.status = "Verified";
        q.verifiedBy = `${verifierName} (HOD)`;
        q.verifiedRole = "HOD";
        q.aiStatus = "AI Verified";
        q.aiScore = Math.floor(Math.random() * 6) + 94;
        q.aiRemarks = "Verified by HOD & AI Quality Engine. Approved for Dean Review.";
        lastSubject = q.subject || lastSubject;
        count++;
      }
    });
    if (count > 0) {
      saveToStorage("questions", list);
      this.logActivity(
        `HOD (${verifierName}) verified ${count} question(s) & sent to Dean`,
        "Approval Pipeline",
        `Question IDs: ${ids.slice(0, 5).join(", ")}`
      );
      this.saveNotification({
        title: `HOD Verification Complete - Pending Dean Approval`,
        description: `${verifierName} (HOD) verified ${count} question(s) for ${lastSubject}. Awaiting Dean Academic Affairs approval.`,
        type: "Approval",
        priority: "High",
        relatedTo: lastSubject,
        status: "Unread",
      });
      this.recalculateSubjectStats();
      notifyUpdate();
    }
    return count;
  },

  deanApproveQuestions(ids: (number | string)[], verifierName = "Dr. V Rajlakshmi"): number {
    const list = this.getQuestions();
    let count = 0;
    const idSet = new Set(ids.map(String));
    let lastSubject = "Viscom & VFX";
    list.forEach((q) => {
      if (idSet.has(String(q.id))) {
        q.status = "Approved";
        q.verifiedBy = `${verifierName} (Dean)`;
        q.verifiedRole = "DEAN";
        lastSubject = q.subject || lastSubject;
        count++;
      }
    });
    if (count > 0) {
      saveToStorage("questions", list);
      this.logActivity(
        `Dean (${verifierName}) approved ${count} question(s) & forwarded to COE`,
        "Approval Pipeline",
        `Question IDs: ${ids.slice(0, 5).join(", ")}`
      );
      this.saveNotification({
        title: `Dean Approval Complete - Ready for COE Question Bank`,
        description: `${verifierName} (Dean) approved ${count} question(s) for ${lastSubject}. Available now in COE Question Bank for exam paper generation.`,
        type: "Approval",
        priority: "High",
        relatedTo: lastSubject,
        status: "Unread",
      });
      this.recalculateSubjectStats();
      notifyUpdate();
    }
    return count;
  },

  coeFinalizeQuestions(ids: (number | string)[], verifierName = "Dr. Rajubalaji"): number {
    const list = this.getQuestions();
    let count = 0;
    const idSet = new Set(ids.map(String));
    let lastSubject = "Viscom & VFX";
    list.forEach((q) => {
      if (idSet.has(String(q.id))) {
        q.status = "Approved";
        q.verifiedBy = `${verifierName} (COE)`;
        q.verifiedRole = "COE";
        q.aiRemarks = "Final Sign-off by Controller of Examinations. Question Bank finalized for Exam Paper Printing.";
        lastSubject = q.subject || lastSubject;
        count++;
      }
    });
    if (count > 0) {
      saveToStorage("questions", list);
      this.logActivity(
        `COE (${verifierName}) granted final approval for ${count} question(s)`,
        "Approval Pipeline",
        `Subject: ${lastSubject} | Question IDs: ${ids.slice(0, 5).join(", ")}`
      );
      this.saveNotification({
        title: `COE Final Approval Complete - Ready for Exam Paper Printing`,
        description: `${verifierName} (COE) completed final sign-off for ${count} question(s) in ${lastSubject}. Ready in Question Bank and Print Paper.`,
        type: "Approval",
        priority: "High",
        relatedTo: lastSubject,
        status: "Unread",
      });
      this.recalculateSubjectStats();
      notifyUpdate();
    }
    return count;
  },

  bulkUpdateQuestions(ids: (number | string)[], status: QuestionItem["status"]): number {
    const list = this.getQuestions();
    let updated = 0;
    const idSet = new Set(ids.map(String));
    list.forEach((q) => {
      if (idSet.has(String(q.id))) {
        q.status = status;
        updated++;
      }
    });
    if (updated > 0) {
      saveToStorage("questions", list);
      this.logActivity(`Batch updated ${updated} questions to ${status}`, "Question Management", `IDs: ${ids.slice(0, 5).join(", ")}`);
    }
    return updated;
  },

  /**
   * Deletes every question imported from one uploaded file by one staff
   * member, locally and on Supabase, so it also disappears from the HOD /
   * Dean / COE review screens. Returns the number of questions removed.
   */
  deleteQuestionsBySource(sourceFile: string, ownerEmail?: string, ownerName?: string): number {
    const clean = (value: string) => value.toLowerCase().replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s*/i, "").trim();
    const ids = this.getQuestions()
      .filter((q) => q.sourceFile === sourceFile)
      .filter((q) =>
        (!ownerEmail && !ownerName) ||
        (ownerEmail && (q.email || "").toLowerCase() === ownerEmail.toLowerCase()) ||
        (ownerName && clean(q.uploadedBy || "") === clean(ownerName)),
      )
      .map((q) => String(q.id));
    if (ids.length === 0) return 0;
    const deleted = this.bulkDeleteQuestions(ids);
    this.recalculateSubjectStats();
    if (isSupabaseConfigured()) {
      for (let i = 0; i < ids.length; i += 200) {
        supabase.from("questions").delete().in("id", ids.slice(i, i + 200)).then(({ error }) => {
          if (error) console.warn("Supabase question bank delete error:", error.message);
        });
      }
    }
    return deleted;
  },

  bulkDeleteQuestions(ids: (number | string)[]): number {
    const list = this.getQuestions();
    const idSet = new Set(ids.map(String));
    const filtered = list.filter((q) => !idSet.has(String(q.id)));
    const deleted = list.length - filtered.length;
    if (deleted > 0) {
      saveToStorage("questions", filtered);
      this.logActivity(`Batch deleted ${deleted} questions`, "Question Management", `Count: ${deleted}`);
    }
    return deleted;
  },

  // ----------------- LIVE STATS CALCULATION -----------------
  getStats() {
    const subjects = this.getSubjects();
    const questions = this.getQuestions();
    const uploads = this.getUploadHistory();
    const notifications = this.getNotifications();
    const users = this.getUsers();
    const units = this.getUnits();

    const totalQuestions = questions.length;
    const approvedQuestions = questions.filter((q) => q.status === "Approved").length;
    const verifiedQuestions = questions.filter((q) => q.status === "Verified").length;
    const pendingQuestions = questions.filter((q) => q.status === "Pending").length;
    const rejectedQuestions = questions.filter((q) => q.status === "Rejected").length;
    const draftQuestions = questions.filter((q) => q.status === "Draft").length;

    const totalSubjects = subjects.length;
    const inProgressSubjects = subjects.filter((s) => s.status === "In Progress").length;
    const completedSubjects = subjects.filter((s) => s.status === "Completed").length;

    const unreadNotifications = notifications.filter((n) => n.status === "Unread").length;

    return {
      totalQuestions,
      approvedQuestions,
      verifiedQuestions,
      pendingQuestions,
      rejectedQuestions,
      draftQuestions,
      totalSubjects,
      inProgressSubjects,
      completedSubjects,
      totalUnits: units.length,
      totalUploads: uploads.length,
      unreadNotifications,
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.status === "Active").length,
    };
  },

  // ----------------- CLIENT-SIDE CSV EXPORTER -----------------
  exportToCsv(filename: string, rows: Record<string, any>[]): void {
    if (!rows || !rows.length || typeof window === "undefined") return;
    const keys = Object.keys(rows[0]);
    const csvContent = [
      keys.join(","),
      ...rows.map((row) =>
        keys
          .map((k) => {
            const val = row[k] === null || row[k] === undefined ? "" : String(row[k]);
            return `"${val.replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // ----------------- FULL BACKUP & RESTORE -----------------
  createFullBackup(): string {
    const backup = {
      timestamp: new Date().toISOString(),
      subjects: this.getSubjects(),
      units: this.getUnits(),
      questions: this.getQuestions(),
      uploads: this.getUploadHistory(),
      notifications: this.getNotifications(),
      users: this.getUsers(),
      activities: this.getActivities(),
    };
    const jsonStr = JSON.stringify(backup, null, 2);
    if (typeof window !== "undefined") {
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `exam_cell_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    return jsonStr;
  },

  restoreFullBackup(jsonData: string): boolean {
    try {
      const parsed = JSON.parse(jsonData);
      if (parsed.subjects) saveToStorage("subjects", parsed.subjects);
      if (parsed.units) saveToStorage("units", parsed.units);
      if (parsed.questions) saveToStorage("questions", parsed.questions);
      if (parsed.uploads) saveToStorage("uploads", parsed.uploads);
      if (parsed.notifications) saveToStorage("notifications", parsed.notifications);
      if (parsed.users) saveToStorage("users", parsed.users);
      if (parsed.activities) saveToStorage("activities", parsed.activities);
      this.logActivity("Database restored from backup", "Backup & Restore", "Full database restoration");
      notifyUpdate();
      return true;
    } catch (err) {
      console.error("Backup restoration failed:", err);
      return false;
    }
  },


  /** Pull questions and syllabus approvals shared by all users of the pipeline. */
  async syncApprovalCollections(): Promise<void> {
    if (!isSupabaseConfigured()) return;
    await Promise.all([pullCollection("questions"), pullCollection("syllabus_approvals")]);
  },

  /**
   * The original syllabus file is not part of the periodic pull. Fetch it when
   * a reviewer opens a syllabus that was uploaded from another device.
   */
  async fetchSyllabusDocument(id: string): Promise<string | null> {
    const local = this.getSyllabusApprovals().find((item) => item.id === id);
    if (local?.documentData) return local.documentData;
    if (!isSupabaseConfigured()) return null;
    const { data, error } = await supabase.from("syllabus_approvals").select("document_data").eq("id", id).maybeSingle();
    if (error || !data?.document_data) return null;
    const list = getFromStorage<SyllabusApprovalItem[]>("syllabus_approvals", []);
    const idx = list.findIndex((item) => item.id === id);
    if (idx === -1) return data.document_data;
    list[idx] = { ...list[idx], documentData: data.document_data };
    // Record the downloaded copy as already synced so it is not uploaded again.
    const snapshot = readSyncSnapshot("syllabus_approvals");
    snapshot[id] = hashSyncValue(list[idx]);
    writeSyncSnapshot("syllabus_approvals", snapshot);
    saveToStorage("syllabus_approvals", list);
    return data.document_data;
  },

  async syncFromSupabase(): Promise<void> {
    if (!isSupabaseConfigured()) return;
    try {
      const [{ data: suData }, { data: unitData }, { data: allocationData }, { data: facultyData }] = await Promise.all([
        supabase.from("subjects").select("*"),
        supabase.from("syllabus_units").select("*"),
        supabase.from("subject_allocations").select("*"),
        supabase.from("faculty").select("*"),
      ]);

      if (suData && suData.length > 0) {
        const localSubs = this.getSubjects();
        const mergedSubs = [...localSubs];
        suData.forEach((s) => {
          const idx = mergedSubs.findIndex((m) => m.id === s.id || m.code === s.code);
          const item: SubjectItem = {
            id: s.id,
            name: s.name,
            code: s.code,
            semester: s.semester || "Semester 1",
            department: s.department || "General",
            totalQuestions: s.total_questions || 0,
            approved: s.approved || 0,
            pending: s.pending || 0,
            verified: s.verified || 0,
            status: (s.status as any) || "In Progress",
            credits: 3,
            completed: `${s.approved || 0} (${s.total_questions ? Math.round(((s.approved || 0) / s.total_questions) * 100) : 0}%)`,
          };
          if (idx !== -1) mergedSubs[idx] = { ...mergedSubs[idx], ...item };
          else mergedSubs.push(item);
        });
        saveToStorage("subjects", mergedSubs);
      }

      if (unitData && unitData.length > 0) {
        const localUnits = this.getUnits();
        const mergedUnits = [...localUnits];
        unitData.forEach((u) => {
          const idx = mergedUnits.findIndex((m) => m.id === u.id);
          const item: SyllabusUnit = {
            id: u.id,
            num: u.num,
            name: u.name,
            subject: u.subject,
            topics: u.topics || 0,
            docs: u.docs || 0,
            subtopics: Array.isArray(u.subtopics) ? u.subtopics : [],
            coMapping: Array.isArray(u.co_mapping) ? u.co_mapping : [],
            description: u.description || "",
          };
          if (idx !== -1) mergedUnits[idx] = { ...mergedUnits[idx], ...item };
          else mergedUnits.push(item);
        });
        saveToStorage("units", mergedUnits);
      } else if (unitData) {
        saveToStorage("units", []);
      }

      await this.syncApprovalCollections();

      if (allocationData && allocationData.length > 0) {
        const allocations: SubjectAllocationItem[] = allocationData.map((a) => ({
          id: a.id,
          subjectCode: a.subject_code,
          subjectName: a.subject_name,
          department: a.department,
          semester: a.semester,
          academicYear: a.academic_year,
          facultyName: a.faculty_name || undefined,
          facultyId: a.faculty_id || undefined,
          status: a.status || "Allocated",
          createdAt: a.created_at || undefined,
        }));
        saveToStorage("subject_allocations", allocations);
      }

      if (facultyData && facultyData.length > 0) {
        const remoteFaculty: StaffFacultyItem[] = facultyData.map((f) => ({
          id: f.id,
          name: f.name,
          designation: f.designation || "Assistant Professor",
          employeeId: f.employee_id || "",
          department: f.department || "Visual Communication",
          school: f.school || "Rathinam Global University",
          deanName: f.dean_name || undefined,
          deanEmail: f.dean_email || undefined,
          hodName: f.hod_name || undefined,
          hodEmail: f.hod_email || undefined,
          email: f.email,
          phone: f.phone || "",
          qualification: f.qualification || "",
          experience: f.experience || "",
          reportingTo: f.reporting_to || "HOD",
          reportingOfficerName: f.reporting_officer_name || "Head of Department (HOD)",
          assignedSubjects: Array.isArray(f.subjects_assigned) ? f.subjects_assigned : [],
          syllabusCount: Number(f.syllabus_count || 0),
          assignedSyllabus: Array.isArray(f.assigned_syllabus) ? f.assigned_syllabus : [],
          questionsContributed: Number(f.questions_contributed || 0),
          pendingReviews: Number(f.pending_reviews || 0),
          status: f.status || "Active",
          avatarBg: f.avatar_bg || "linear-gradient(135deg, #d4a780, #deba9b)",
        }));
        this.setStaffFacultyList(remoteFaculty, false);
      }

      notifyUpdate();
    } catch (err) {
      console.warn("Supabase initial fetch sync warning:", err);
    }
  },

  // ----------------- SUBJECT ALLOCATION CRUD -----------------
  getSubjectAllocations(): SubjectAllocationItem[] {
    return getFromStorage<SubjectAllocationItem[]>("subject_allocations", defaultSubjectAllocations);
  },

  saveSubjectAllocation(
    allocation: Partial<SubjectAllocationItem> & {
      subjectCode: string;
      subjectName: string;
      department: string;
      semester: string;
      academicYear: string;
    }
  ): SubjectAllocationItem {
    const cleanCode = (allocation.subjectCode || "").trim().toUpperCase();
    const cleanName = (allocation.subjectName || "").trim();
    const cleanDept = (allocation.department || "").trim();
    const cleanSem = (allocation.semester || "").trim();
    const cleanYear = (allocation.academicYear || "").trim();

    if (!cleanCode) throw new Error("Subject Code is required.");
    if (!cleanName) throw new Error("Subject Name is required.");
    if (!cleanDept) throw new Error("Department is required.");
    if (!cleanSem) throw new Error("Semester is required.");
    if (!cleanYear) throw new Error("Academic Year is required.");

    const list = this.getSubjectAllocations();
    let savedItem: SubjectAllocationItem;

    const existingIdx = allocation.id
      ? list.findIndex((item) => item.id === allocation.id)
      : list.findIndex(
          (item) =>
            item.subjectCode.toUpperCase() === cleanCode &&
            item.academicYear === cleanYear &&
            item.semester === cleanSem &&
            item.department.toLowerCase() === cleanDept.toLowerCase()
        );

    const nowStr =
      new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
      ", " +
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (existingIdx !== -1) {
      list[existingIdx] = {
        ...list[existingIdx],
        ...allocation,
        subjectCode: cleanCode,
        subjectName: cleanName,
        department: cleanDept,
        semester: cleanSem,
        academicYear: cleanYear,
        updatedAt: nowStr,
      };
      savedItem = list[existingIdx];
    } else {
      savedItem = {
        id: allocation.id || `alloc-${Date.now()}`,
        subjectCode: cleanCode,
        subjectName: cleanName,
        department: cleanDept,
        semester: cleanSem,
        academicYear: cleanYear,
        facultyName: (allocation.facultyName || "").trim() || undefined,
        facultyId: allocation.facultyId,
        credits: allocation.credits || 3,
        status: allocation.status || "Allocated",
        createdAt: nowStr,
        updatedAt: nowStr,
      };
      list.unshift(savedItem);
    }

    saveToStorage("subject_allocations", list);
    this.touchLastUpdated();
    notifyUpdate();

    if (isSupabaseConfigured()) {
      supabase
        .from("subject_allocations")
        .upsert({
          id: savedItem.id,
          subject_code: savedItem.subjectCode,
          subject_name: savedItem.subjectName,
          department: savedItem.department,
          semester: savedItem.semester,
          academic_year: savedItem.academicYear,
          faculty_name: savedItem.facultyName,
          faculty_id: savedItem.facultyId,
          status: savedItem.status,
        })
        .then(({ error }) => {
          if (error) console.warn("Supabase Subject Allocation Sync error:", error.message);
        });
    }

    return savedItem;
  },

  deleteSubjectAllocation(id: string): void {
    const list = this.getSubjectAllocations();
    const remaining = list.filter((item) => String(item.id) !== String(id));
    saveToStorage("subject_allocations", remaining);
    this.touchLastUpdated();
    notifyUpdate();

    if (isSupabaseConfigured()) {
      supabase
        .from("subject_allocations")
        .delete()
        .eq("id", id)
        .then(({ error }) => {
          if (error) console.warn("Supabase Subject Allocation Delete error:", error.message);
        });
    }
  },

  // ----------------- RESET ALL -----------------
  resetAll(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem("exam_cell_subjects");
    localStorage.removeItem("exam_cell_units");
    localStorage.removeItem("exam_cell_questions");
    localStorage.removeItem("exam_cell_uploads");
    localStorage.removeItem("exam_cell_notifications");
    localStorage.removeItem("exam_cell_users");
    localStorage.removeItem("exam_cell_activities");
    localStorage.removeItem("exam_cell_syllabus_approvals");
    localStorage.removeItem("exam_cell_subject_allocations");
    notifyUpdate();
  },
};

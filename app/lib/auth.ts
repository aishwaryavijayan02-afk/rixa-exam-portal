"use client";

export type UserRole = "STAFF" | "HOD" | "DEAN" | "COE" | "SCRUTINIZER";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle: string;
  department: string;
  avatarBg: string;
  isSubjectFaculty?: boolean; // Specific to HOD role permission rule
}

export const PRESET_USERS: Record<UserRole, AuthUser> = {
  STAFF: {
    id: "usr-staff",
    name: "Mr. Vignesh M",
    email: "staff@rathinam.in",
    role: "STAFF",
    roleTitle: "Assistant Professor",
    department: "Visual Communication",
    avatarBg: "#ca9261",
  },
  HOD: {
    id: "usr-hod",
    name: "Dr. T.J RAJU",
    email: "hod@rathinam.in",
    role: "HOD",
    roleTitle: "HOD / Associate Dean",
    department: "Visual Arts & VFX",
    avatarBg: "#976132",
    isSubjectFaculty: true,
  },
  DEAN: {
    id: "usr-dean",
    name: "Dr. V Rajlakshmi",
    email: "dean@rathinam.in",
    role: "DEAN",
    roleTitle: "Dean Academic Affairs",
    department: "School of Media & Arts",
    avatarBg: "#d4a67e",
  },
  COE: {
    id: "usr-coe",
    name: "Dr. Rajubalaji",
    email: "coe@rathinam.in",
    role: "COE",
    roleTitle: "Controller of Examinations",
    department: "Exam Cell Office",
    avatarBg: "#10b981",
  },
  SCRUTINIZER: {
    id: "usr-scrutinizer",
    name: "Question Paper Scrutinizer",
    email: "scrutinizer@rathinam.in",
    role: "SCRUTINIZER",
    roleTitle: "Question Paper Scrutinizer",
    department: "Exam Cell Office",
    avatarBg: "#0e7490",
  },
};

export const STAFF_FACULTY_ACCOUNTS: AuthUser[] = [
  {
    id: "fac-vis-1",
    name: "Mr. Vignesh M",
    email: "vignesh.viscom@rathinam.in",
    role: "STAFF",
    roleTitle: "Assistant Professor",
    department: "Visual Communication",
    avatarBg: "#ca9261",
  },
  {
    id: "fac-vis-2",
    name: "Mr. Vishal Mithran",
    email: "vishal.viscom@rathinam.in",
    role: "STAFF",
    roleTitle: "Assistant Professor",
    department: "Visual Communication",
    avatarBg: "#976132",
  },
  {
    id: "fac-vis-3",
    name: "Mr. Athreya K",
    email: "athreya.viscom@rathinam.in",
    role: "STAFF",
    roleTitle: "Assistant Professor",
    department: "Visual Communication",
    avatarBg: "#059669",
  },
  {
    id: "fac-vis-4",
    name: "Mrs. Gayathiri G",
    email: "gayathiri.viscom@rathinam.in",
    role: "STAFF",
    roleTitle: "Assistant Professor",
    department: "Visual Communication",
    avatarBg: "#db2777",
  },
  {
    id: "fac-vis-5",
    name: "Mr. Saravanan S",
    email: "saravanan.viscom@rathinam.in",
    role: "STAFF",
    roleTitle: "Assistant Professor",
    department: "Visual Communication",
    avatarBg: "#ea580c",
  },
  {
    id: "fac-vis-6",
    name: "Mr. Kailash Tharayil",
    email: "kailash.viscom@rathinam.in",
    role: "STAFF",
    roleTitle: "Assistant Professor",
    department: "Visual Communication",
    avatarBg: "#d4a67e",
  },
];

export function parseStaffNameFromEmail(rawEmail: string): string {
  const clean = (rawEmail || "").trim().toLowerCase();
  const rawHandle = rawEmail.includes("@") ? rawEmail.split("@")[0].trim() : rawEmail.trim();
  const handle = clean.split("@")[0].trim();

  // If handle is literally 'staff' or 'faculty', return primary faculty name
  if (handle === "staff" || handle === "faculty") {
    return "Mr. Vignesh M";
  }

  // 1. Detect explicit salutation from handle or email string
  let salutation: "Mr." | "Mrs." | "Ms." | "Dr." | "Prof." | null = null;
  if (/^(mrs[\.\s_\-]|\(mrs\)|\[mrs\])/i.test(handle) || /\bmrs\b/i.test(handle)) {
    salutation = "Mrs.";
  } else if (/^(mr[\.\s_\-]|\(mr\)|\[mr\])/i.test(handle) || /\bmr\b/i.test(handle)) {
    salutation = "Mr.";
  } else if (/^(ms[\.\s_\-]|\(ms\)|\[ms\])/i.test(handle) || /\bms\b/i.test(handle)) {
    salutation = "Ms.";
  } else if (/^(dr[\.\s_\-]|\(dr\)|\[dr\])/i.test(handle) || /\bdr\b/i.test(handle)) {
    salutation = "Dr.";
  } else if (/^(prof[\.\s_\-]|\(prof\)|\[prof\])/i.test(handle) || /\bprof\b/i.test(handle)) {
    salutation = "Prof.";
  }

  // 2. Direct recognized faculty & authority members (respect explicit salutation if given)
  if (clean.includes("gayathiri") || clean.includes("gayathri")) {
    return `${salutation || "Mrs."} Gayathiri G`;
  }
  if (clean.includes("vignesh")) {
    return `${salutation || "Mr."} Vignesh M`;
  }
  if (clean.includes("vishal")) {
    return `${salutation || "Mr."} Vishal Mithran`;
  }
  if (clean.includes("athreya")) {
    return `${salutation || "Mr."} Athreya K`;
  }
  if (clean.includes("saravanan")) {
    return `${salutation || "Mr."} Saravanan S`;
  }
  if (clean.includes("kailash")) {
    return `${salutation || "Mr."} Kailash Tharayil`;
  }
  if (clean.includes("raju") && !clean.includes("balaji")) {
    return "Dr. T.J RAJU";
  }
  if (clean.includes("rajubalaji") || clean.includes("balaji")) {
    return "Dr. Rajubalaji";
  }
  if (clean.includes("rajlakshmi")) {
    return "Dr. V Rajlakshmi";
  }

  // 3. Parse custom staff names from email prefix or user input
  let nameHandle = rawHandle
    .replace(/(\.|\s|_|-)+viscom$/gi, "")
    .replace(/(\.|\s|_|-)+fashion$/gi, "")
    .replace(/(\.|\s|_|-)+media$/gi, "")
    .replace(/(\.|\s|_|-)+arts$/gi, "")
    .replace(/(\.|\s|_|-)+design$/gi, "")
    .replace(/(\.|\s|_|-)+cse$/gi, "")
    .replace(/(\.|\s|_|-)+it$/gi, "")
    .trim();

  // Strip salutation tokens from nameHandle so we don't repeat them
  nameHandle = nameHandle
    .replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.|mr|mrs|ms|dr|prof)[\s\._\-]+/gi, "")
    .trim();

  const tokens = nameHandle.split(/[\.\s_\-]+/).filter(Boolean);
  if (tokens.length === 0) {
    return salutation ? `${salutation} Faculty` : "Mr. Vignesh M";
  }

  const nameParts = tokens.map((t) => {
    if (t.length === 1) return t.toUpperCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
  });

  const baseName = nameParts.join(" ");
  if (salutation) {
    return `${salutation} ${baseName}`;
  }
  return baseName || "Mr. Vignesh M";
}

/**
 * Sign-in rule: any official name@rathinam.in address, with the password
 * "<name>@123" (e.g. vignesh@rathinam.in / vignesh@123). The user signs in
 * with the role selected on the login page; uploads and approvals are recorded
 * under the person's own name taken from the email.
 */
export async function authenticateUser(
  emailInput: string,
  passwordInput: string,
  selectedRole?: UserRole | null
): Promise<{ user: AuthUser | null; error: string | null }> {
  let cleanEmail = emailInput.trim().toLowerCase().replace(/\s+/g, "");
  const cleanPassword = passwordInput.trim();

  if (!cleanEmail) return { user: null, error: "Please enter your email." };
  if (!cleanPassword) return { user: null, error: "Please enter your password." };
  if (!selectedRole) return { user: null, error: "Please select your role first." };

  // "vignesh" is accepted as "vignesh@rathinam.in".
  if (!cleanEmail.includes("@")) cleanEmail = `${cleanEmail}@rathinam.in`;
  const [handle, domain] = cleanEmail.split("@");
  if (!handle || domain !== "rathinam.in") {
    return { user: null, error: "Please use your official name@rathinam.in email." };
  }
  if (cleanPassword.toLowerCase() !== `${handle}@123`) {
    return { user: null, error: "Invalid email or password." };
  }

  const preset = PRESET_USERS[selectedRole];
  // The role's own common address (staff@, hod@, dean@, coe@, scrutinizer@).
  if (cleanEmail === preset.email) return { user: { ...preset }, error: null };

  // A registered faculty account keeps its saved name and department.
  const known = STAFF_FACULTY_ACCOUNTS.find(
    (s) => s.email.toLowerCase() === cleanEmail || s.email.toLowerCase().split("@")[0] === handle,
  );
  if (known && selectedRole === "STAFF") return { user: { ...known }, error: null };

  return {
    user: {
      id: `usr-${cleanEmail.replace(/[^a-z0-9]/g, "-")}`,
      name: known?.name || parseStaffNameFromEmail(cleanEmail),
      email: cleanEmail,
      role: selectedRole,
      roleTitle: preset.roleTitle,
      department: known?.department || preset.department,
      avatarBg: preset.avatarBg,
      isSubjectFaculty: selectedRole === "HOD" ? true : undefined,
    },
    error: null,
  };
}

// Check permissions strictly matching the matrix table
export function hasPermission(role: UserRole, route: string, isSubjectFaculty: boolean = true): boolean {
  const normalizedRoute = route.replace(/\/$/, "").split("?")[0];

  // The Scrutinizer works in the Scrutiny dashboard, School, Manual Questions,
  // Notifications and Settings.
  if (role === "SCRUTINIZER") {
    return ["", "/dashboard", "/scrutinizer", "/subjects", "/subject", "/manual-questions", "/notifications", "/settings"].includes(normalizedRoute);
  }

  switch (normalizedRoute) {
    case "/scrutinizer":
      return role === "COE"; // COE can also follow the scrutiny progress

    case "/dashboard":
    case "":
      return true; // All roles

    case "/subjects":
    case "/subject":
    case "/subject-allocation":
    case "/academic-vault":
    case "/syllabus":
    case "/question-bank":
    case "/bulk-upload":
      if (role === "COE" || role === "STAFF") return true;
      if (role === "HOD") return true;
      if (role === "DEAN") return true;
      return true;

    case "/verify-questions":
    case "/approval":
      if (role === "COE" || role === "HOD" || role === "DEAN") return true;
      if (role === "STAFF") return false;
      return false;

    case "/staff-faculty":
    case "/faculty":
    case "/staff-work-status":
      if (role === "COE" || role === "HOD" || role === "DEAN") return true;
      return false; // STAFF denied

    case "/reports":
    case "/manual-questions":
      if (role === "COE") return true;
      return false; // STAFF, HOD, DEAN denied

    case "/print-paper":
      return role === "COE"; // ONLY COE (Controller of Examinations) can print question papers

    case "/notifications":
    case "/settings":
      return true; // All roles

    default:
      return true;
  }
}

/**
 * Whether a sidebar entry is shown for this role. Same as hasPermission, except
 * the Scrutinizer does not get the plain "Dashboard" entry: its dashboard is the
 * "Scrutiny Dashboard" (/dashboard only redirects there).
 */
export function showInMenu(role: UserRole, route: string, isSubjectFaculty: boolean = true): boolean {
  if (role === "SCRUTINIZER" && route.replace(/\/$/, "") === "/dashboard") return false;
  return hasPermission(role, route, isSubjectFaculty);
}

/**
 * A page's sidebar entries for this user: filtered with showInMenu, and for the
 * Scrutinizer the School entry is named "School & Academic Repository".
 */
export function menuForUser<T extends { route: string; label: string }>(items: T[], user: Pick<AuthUser, "role" | "isSubjectFaculty">): T[] {
  return items
    .filter((item) => showInMenu(user.role, item.route, user.isSubjectFaculty))
    .map((item) => (user.role === "SCRUTINIZER" && item.route === "/subjects" ? { ...item, label: "School & Academic Repository" } : item));
}

/**
 * Common name shown for the signed-in user in greetings and the header
 * (e.g. "Staff", "HOD"). Display only: uploads and approvals keep the real
 * staff name so every document is still credited to the right person.
 */
export function roleDisplayName(role: UserRole | string | undefined): string {
  switch (role) {
    case "STAFF":
      return "Staff";
    case "HOD":
      return "HOD";
    case "DEAN":
      return "Dean";
    case "COE":
      return "COE";
    case "SCRUTINIZER":
      return "Scrutinizer";
    default:
      return "User";
  }
}

export type AllocationLevel = "HOD" | "DEAN";

// Faculty allocation policy: HOD -> HOD level only, DEAN -> Dean level only,
// COE -> both. STAFF is denied (STAFF cannot even open /staff-faculty).
export function canAllocateFaculty(role: UserRole | undefined | null, level: AllocationLevel): boolean {
  if (role === "COE") return true;
  if (role === "HOD") return level === "HOD";
  if (role === "DEAN") return level === "DEAN";
  return false;
}

const STORAGE_KEY = "exam_cell_auth_user";

export const authStore = {
  getCurrentUser(): AuthUser {
    if (typeof window === "undefined") return PRESET_USERS.COE;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.role) {
          if (parsed.name && (/Mr\.\/Ms/i.test(parsed.name) || parsed.name.startsWith("Mr./Ms"))) {
            const reParsed = parseStaffNameFromEmail(parsed.email || parsed.name);
            parsed.name = reParsed.replace(/^Mr\.\/Ms\.\s*/i, "");
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            } catch (e) {}
          }
          // Auto-migrate any outdated generic "Faculty / Staff" or missing names in localStorage
          if (
            parsed.name === "Faculty / Staff" ||
            parsed.name === "Staff" ||
            parsed.roleTitle === "Faculty / Staff" ||
            !parsed.name
          ) {
            if (parsed.email && parsed.email !== "staff@rathinam.in") {
              parsed.name = parseStaffNameFromEmail(parsed.email);
            } else {
              parsed.name = "Mr. Vignesh M";
            }
            if (parsed.role === "STAFF" && (parsed.roleTitle === "Faculty / Staff" || !parsed.roleTitle)) {
              parsed.roleTitle = "Assistant Professor";
            }
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            } catch (e) {}
          }

          if (parsed.email && parsed.name) {
            return parsed as AuthUser;
          }
          if (PRESET_USERS[parsed.role as UserRole]) {
            const fresh = PRESET_USERS[parsed.role as UserRole];
            return {
              ...parsed,
              name: fresh.name,
              email: fresh.email,
              roleTitle: fresh.roleTitle,
            };
          }
        }
      }
    } catch (e) {
      console.error("Auth storage read error:", e);
    }
    return PRESET_USERS.COE;
  },

  setCurrentUser(user: AuthUser): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      window.dispatchEvent(new CustomEvent("exam-cell-auth-update", { detail: user }));
    } catch (e) {
      console.error("Auth storage save error:", e);
    }
  },

  loginAs(role: UserRole, customIsSubjectFaculty?: boolean): AuthUser {
    const preset = PRESET_USERS[role];
    const userToSave: AuthUser = {
      ...preset,
      isSubjectFaculty: customIsSubjectFaculty !== undefined ? customIsSubjectFaculty : (preset.isSubjectFaculty ?? true),
    };
    this.setCurrentUser(userToSave);
    return userToSave;
  },

  toggleHodSubjectFaculty(): AuthUser {
    const current = this.getCurrentUser();
    if (current.role !== "HOD") return current;
    const updated: AuthUser = {
      ...current,
      isSubjectFaculty: !current.isSubjectFaculty,
    };
    this.setCurrentUser(updated);
    return updated;
  },

  logout(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("exam-cell-auth-update", { detail: null }));
  },
};

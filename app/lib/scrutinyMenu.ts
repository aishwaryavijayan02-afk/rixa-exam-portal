import { ClipboardCheck, FolderOpen, type LucideIcon } from "lucide-react";

interface SidebarMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  route: string;
  badge?: string;
  hasArrow?: boolean;
}

/**
 * Scrutinizer menu entries shared by every page's sidebar, so they stay in the
 * menu on School, Manual Questions, Notifications and Settings too. Each page
 * filters its menu with showInMenu(), which hides entries a role cannot open.
 */
export const SCRUTINY_MENU_ITEMS: SidebarMenuItem[] = [
  { id: "scrutinizer", label: "Scrutiny Dashboard", icon: ClipboardCheck, route: "/scrutinizer" },
  { id: "academic-repository", label: "School & Academic Repository", icon: FolderOpen, route: "/academic-repository" },
];

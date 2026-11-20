import { ClipboardCheck, type LucideIcon } from "lucide-react";

interface SidebarMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  route: string;
  badge?: string;
  hasArrow?: boolean;
}

/**
 * Scrutinizer menu entry shared by every page's sidebar, so it stays in the
 * menu on School, Manual Questions, Notifications and Settings too. Each page
 * builds its menu with menuForUser(), which hides entries a role cannot open.
 */
export const SCRUTINY_MENU_ITEMS: SidebarMenuItem[] = [
  { id: "scrutinizer", label: "Scrutiny Dashboard", icon: ClipboardCheck, route: "/scrutinizer" },
];

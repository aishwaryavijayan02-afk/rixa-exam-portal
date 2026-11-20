"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Bell, ClipboardCheck, Edit3, Home, School, Settings } from "lucide-react";
import { AuthUser, menuForUser } from "../lib/auth";

const MENU = [
  { id: "scrutinizer", label: "Scrutiny Dashboard", icon: ClipboardCheck, route: "/scrutinizer" },
  { id: "dashboard", label: "Main Dashboard", icon: Home, route: "/dashboard" },
  { id: "school", label: "School", icon: School, route: "/subjects" },
  { id: "manual-questions", label: "Manual Questions", icon: Edit3, route: "/manual-questions" },
  { id: "notifications", label: "Notifications", icon: Bell, route: "/notifications" },
  { id: "settings", label: "Settings", icon: Settings, route: "/settings" },
];

/** Sidebar for the Scrutinizer pages (same look as the other portal sidebars). */
export default function ScrutinizerSidebar({ currentUser, active }: { currentUser: AuthUser; active: string }) {
  const router = useRouter();
  const items = menuForUser(MENU, currentUser);
  return (
    <aside className="digital-vfx-sidebar" style={{ width: "260px", background: "linear-gradient(180deg, #1c120c 0%, #120c08 100%)", color: "#94a3b8", display: "flex", flexDirection: "column", flexShrink: 0, borderRight: "1px solid rgba(255, 255, 255, 0.06)", padding: "20px 14px", height: "100vh", overflowY: "auto" }}>
      <div style={{ padding: "6px 10px 24px 10px" }}>
        <div className="brand-orbit-logo" aria-label="Rathinam Global (Deemed to be University)">
          <span className="brand-orbit-mark">RG</span>
          <span className="brand-orbit-name">Rathinam Global</span>
        </div>
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active;
          return (
            <button key={item.id} type="button" onClick={() => !isActive && router.push(item.route)} data-route={item.route} className={`sidebar-btn-3d ${isActive ? "sidebar-btn-active" : "sidebar-btn-inactive"}`}>
              <span className="nav-icon-3d" style={{ display: "flex", alignItems: "center" }}>
                <Icon size={18} />
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

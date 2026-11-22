"use client";

import React from "react";

/**
 * Animated, digital-style sidebar icons, one per menu route. Drawn with
 * currentColor so they take each menu item's tile colour (see the
 * data-route rules in globals.css); animated with the `ni-*` classes.
 */

const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const ICONS: Record<string, () => React.ReactElement> = {
  // Dashboard: tiles lighting up in turn
  "/dashboard": () => (
    <svg viewBox="0 0 24 24">
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" {...s} />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" {...s} />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" {...s} />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" {...s} />
      <rect className="ni-blink ni-d1" x="5" y="5" width="3.5" height="3.5" rx="1" fill="currentColor" />
      <rect className="ni-blink ni-d2" x="15.5" y="5" width="3.5" height="3.5" rx="1" fill="currentColor" />
      <rect className="ni-blink ni-d4" x="5" y="15.5" width="3.5" height="3.5" rx="1" fill="currentColor" />
      <rect className="ni-blink ni-d3" x="15.5" y="15.5" width="3.5" height="3.5" rx="1" fill="currentColor" />
    </svg>
  ),
  // School: campus building with a waving flag
  "/subjects": () => (
    <svg viewBox="0 0 24 24">
      <path d="M3 21h18M5 21V11l7-4 7 4v10" {...s} />
      <path d="M10 21v-4h4v4" {...s} />
      <line x1="12" y1="7" x2="12" y2="2.5" {...s} />
      <path className="ni-flag" d="M12 2.5h4.5l-1.2 1.4 1.2 1.4H12" fill="currentColor" />
      <rect className="ni-blink ni-d1" x="7.3" y="12.5" width="2" height="2" rx=".4" fill="currentColor" />
      <rect className="ni-blink ni-d3" x="14.7" y="12.5" width="2" height="2" rx=".4" fill="currentColor" />
    </svg>
  ),
  // Staff Work Status: people with a progress bar filling
  "/staff-work-status": () => (
    <svg viewBox="0 0 24 24">
      <circle cx="9" cy="7" r="3" {...s} />
      <path d="M3.5 17c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" {...s} />
      <circle cx="17" cy="8" r="2.2" {...s} />
      <rect x="3" y="19.5" width="18" height="2" rx="1" {...s} strokeWidth={1.2} />
      <rect className="ni-fill" x="3" y="19.5" width="18" height="2" rx="1" fill="currentColor" />
    </svg>
  ),
  // Academic Vault: vault door with a turning dial
  "/academic-vault": () => (
    <svg viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="16" rx="2.5" {...s} />
      <line x1="6" y1="20" x2="6" y2="21.5" {...s} />
      <line x1="18" y1="20" x2="18" y2="21.5" {...s} />
      <g className="ni-spin">
        <circle cx="12" cy="12" r="4.2" {...s} />
        <line x1="12" y1="7.8" x2="12" y2="9.6" {...s} />
        <line x1="12" y1="14.4" x2="12" y2="16.2" {...s} />
        <line x1="7.8" y1="12" x2="9.6" y2="12" {...s} />
        <line x1="14.4" y1="12" x2="16.2" y2="12" {...s} />
      </g>
      <circle className="ni-pulse" cx="12" cy="12" r="1.2" fill="currentColor" />
    </svg>
  ),
  // Verify & Approval: shield with a check being drawn
  "/approval": () => (
    <svg viewBox="0 0 24 24">
      <path d="M12 2.8l7.5 3v5.6c0 4.6-3.1 8.4-7.5 9.8-4.4-1.4-7.5-5.2-7.5-9.8V5.8z" {...s} />
      <polyline className="ni-draw" points="8.3,12.2 11,14.8 15.8,9.6" {...s} strokeWidth={2.1} pathLength={100} />
    </svg>
  ),
  // Scrutiny Dashboard: magnifier scanning a document
  "/scrutinizer": () => (
    <svg viewBox="0 0 24 24">
      <path d="M6 2.8h8l4 4v14.4H6z" {...s} />
      <path d="M14 2.8v4h4" {...s} />
      <g {...s} strokeWidth={1.3} opacity=".55">
        <line x1="8.5" y1="10" x2="15.5" y2="10" />
        <line x1="8.5" y1="13" x2="15.5" y2="13" />
        <line x1="8.5" y1="16" x2="13" y2="16" />
      </g>
      <g className="ni-scan">
        <circle cx="15" cy="15" r="3.4" {...s} strokeWidth={2} />
        <line x1="17.5" y1="17.5" x2="20.5" y2="20.5" {...s} strokeWidth={2.2} />
      </g>
    </svg>
  ),
  // Reports: bars growing
  "/reports": () => (
    <svg viewBox="0 0 24 24">
      <polyline points="3,3 3,21 21,21" {...s} />
      <rect className="ni-grow ni-d1" x="6.5" y="13" width="3" height="8" rx="1" fill="currentColor" opacity=".55" />
      <rect className="ni-grow ni-d2" x="11.5" y="9" width="3" height="12" rx="1" fill="currentColor" opacity=".75" />
      <rect className="ni-grow ni-d3" x="16.5" y="5" width="3" height="16" rx="1" fill="currentColor" />
    </svg>
  ),
  // Manual Questions: pen writing a line
  "/manual-questions": () => (
    <svg viewBox="0 0 24 24">
      <g className="ni-write">
        <path d="M14.5 4.5l5 5L9 20H4v-5z" {...s} />
        <line x1="12.5" y1="6.5" x2="17.5" y2="11.5" {...s} />
      </g>
      <line className="ni-draw" x1="12" y1="21" x2="21" y2="21" {...s} pathLength={100} />
    </svg>
  ),
  // Notifications: swinging bell with a live dot
  "/notifications": () => (
    <svg viewBox="0 0 24 24">
      <g className="ni-ring">
        <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" {...s} />
        <path d="M10 20.5a2 2 0 0 0 4 0" {...s} />
      </g>
      <circle className="ni-pulse" cx="18" cy="5" r="2.4" fill="currentColor" />
    </svg>
  ),
  // Print Question Paper: paper sliding out of the printer
  "/print-paper": () => (
    <svg viewBox="0 0 24 24">
      <path d="M7 8V3h10v5" {...s} />
      <rect x="3" y="8" width="18" height="8.5" rx="2" {...s} />
      <circle className="ni-pulse" cx="17.5" cy="11.5" r="1" fill="currentColor" />
      <g className="ni-feed">
        <path d="M7 13.5h10v7.5H7z" {...s} />
        <line x1="9" y1="16.5" x2="15" y2="16.5" {...s} strokeWidth={1.2} />
        <line x1="9" y1="18.8" x2="13.5" y2="18.8" {...s} strokeWidth={1.2} />
      </g>
    </svg>
  ),
  // Settings: turning gear
  "/settings": () => (
    <svg viewBox="0 0 24 24">
      <g className="ni-spin">
        <path
          d="M12 2.5l1.6 2.3 2.7-.7.7 2.7 2.6 1-.6 2.7 1.9 2-1.9 2 .6 2.7-2.6 1-.7 2.7-2.7-.7L12 21.5l-1.6-2.3-2.7.7-.7-2.7-2.6-1 .6-2.7L3.1 12 5 10l-.6-2.7 2.6-1 .7-2.7 2.7.7z"
          {...s}
          strokeWidth={1.5}
        />
        <circle cx="12" cy="12" r="3.2" {...s} />
      </g>
    </svg>
  ),
};

/** Animated sidebar icon for a route; falls back to the given icon component. */
export default function NavIcon({ route, fallback: Fallback, size = 18 }: { route: string; fallback?: React.ElementType; size?: number }) {
  const Icon = ICONS[route];
  if (!Icon) return Fallback ? <Fallback size={size} /> : null;
  return (
    <span className="nav-anim-icon" style={{ width: size + 2, height: size + 2 }} aria-hidden="true">
      <Icon />
    </span>
  );
}

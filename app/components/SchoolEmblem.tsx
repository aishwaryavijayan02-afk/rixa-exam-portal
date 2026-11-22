"use client";

import React from "react";

/**
 * Animated, digital-style emblems for the School page cards. Each emblem is an
 * inline SVG drawn in the card's theme colour (currentColor = --sc-accent) and
 * animated with the `se-*` classes in globals.css. Motion is disabled for users
 * who prefer reduced motion.
 */

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function QuantumEmblem() {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
      {/* chip + pins */}
      <rect x="15" y="15" width="18" height="18" rx="3.5" {...stroke} />
      {[19, 24, 29].map((p) => (
        <g key={p} {...stroke} strokeWidth={1.6}>
          <line x1={p} y1="10" x2={p} y2="15" />
          <line x1={p} y1="33" x2={p} y2="38" />
          <line x1="10" y1={p} x2="15" y2={p} />
          <line x1="33" y1={p} x2="38" y2={p} />
        </g>
      ))}
      {/* pulsing core */}
      <circle className="se-pulse" cx="24" cy="24" r="3.4" fill="currentColor" />
      {/* orbit with electron */}
      <g className="se-spin-slow">
        <ellipse cx="24" cy="24" rx="21" ry="8" {...stroke} strokeWidth={1.2} strokeDasharray="2 3" opacity="0.55" />
        <circle cx="45" cy="24" r="2.3" fill="currentColor" />
      </g>
    </svg>
  );
}

function BusinessEmblem() {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
      <polyline points="8,8 8,40 41,40" {...stroke} />
      <rect className="se-grow se-d1" x="13" y="28" width="6" height="12" rx="1.5" fill="currentColor" opacity="0.45" />
      <rect className="se-grow se-d2" x="22" y="22" width="6" height="18" rx="1.5" fill="currentColor" opacity="0.65" />
      <rect className="se-grow se-d3" x="31" y="15" width="6" height="25" rx="1.5" fill="currentColor" opacity="0.85" />
      <polyline className="se-draw" points="11,27 20,20 28,23 40,10" {...stroke} strokeWidth={2.2} pathLength={100} />
      <polyline className="se-draw-head" points="34,10 40,10 40,16" {...stroke} strokeWidth={2.2} />
    </svg>
  );
}

function HealthEmblem() {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
      <circle className="se-ring" cx="24" cy="25" r="14" {...stroke} strokeWidth={1.4} />
      <path d="M24 39 C10 30 6 22 9.5 15.5 C12.5 10 19.5 9.5 24 15 C28.5 9.5 35.5 10 38.5 15.5 C42 22 38 30 24 39 Z" {...stroke} />
      <polyline className="se-ecg" points="4,25 14,25 17,19 21,31 25,15 29,29 32,25 44,25" {...stroke} strokeWidth={2.2} pathLength={100} />
    </svg>
  );
}

function MediaEmblem() {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
      <circle cx="24" cy="24" r="17" {...stroke} />
      <g className="se-spin">
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <line key={angle} x1="24" y1="7" x2="31" y2="19" {...stroke} strokeWidth={1.6} transform={`rotate(${angle} 24 24)`} />
        ))}
      </g>
      <path className="se-pulse" d="M21 18.5 L30.5 24 L21 29.5 Z" fill="currentColor" />
      <path className="se-twinkle" d="M40 5 L41.3 8.7 L45 10 L41.3 11.3 L40 15 L38.7 11.3 L35 10 L38.7 8.7 Z" fill="currentColor" />
    </svg>
  );
}

function LiberalArtsEmblem() {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
      <path d="M24 16 C19 12 12 12 6 14 V38 C12 36 19 36 24 40 C29 36 36 36 42 38 V14 C36 12 29 12 24 16 Z" {...stroke} />
      <line x1="24" y1="16" x2="24" y2="40" {...stroke} />
      <g {...stroke} strokeWidth={1.3} opacity="0.55">
        <line x1="10" y1="21" x2="19" y2="20" />
        <line x1="10" y1="26" x2="19" y2="25" />
        <line x1="29" y1="20" x2="38" y2="21" />
        <line x1="29" y1="25" x2="38" y2="26" />
      </g>
      <circle className="se-rise se-d1" cx="17" cy="10" r="1.8" fill="currentColor" />
      <circle className="se-rise se-d2" cx="24" cy="8" r="2.2" fill="currentColor" />
      <circle className="se-rise se-d3" cx="31" cy="10" r="1.8" fill="currentColor" />
    </svg>
  );
}

function BioEmblem() {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
      <g className="se-sway">
        <path d="M16 4 C16 14 32 14 32 24 C32 34 16 34 16 44" {...stroke} />
        <path d="M32 4 C32 14 16 14 16 24 C16 34 32 34 32 44" {...stroke} />
        {[9, 16, 31, 38].map((y, i) => (
          <line key={y} className={`se-blink se-d${i + 1}`} x1="18.5" y1={y} x2="29.5" y2={y} {...stroke} strokeWidth={1.8} />
        ))}
        <circle className="se-pulse" cx="24" cy="24" r="2.6" fill="currentColor" />
      </g>
    </svg>
  );
}

function SustainabilityEmblem() {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
      <circle cx="22" cy="26" r="16" {...stroke} />
      <ellipse className="se-globe" cx="22" cy="26" rx="7" ry="16" {...stroke} strokeWidth={1.5} />
      <g {...stroke} strokeWidth={1.3} opacity="0.6">
        <line x1="6.5" y1="21" x2="37.5" y2="21" />
        <line x1="6.5" y1="31" x2="37.5" y2="31" />
      </g>
      <g className="se-leaf">
        <path d="M33 14 C33 6 39 3 45 3 C45 10 41 15 33 14 Z" fill="currentColor" opacity="0.9" />
        <line x1="33" y1="14" x2="40" y2="7" stroke="#ffffff" strokeWidth={1} strokeLinecap="round" opacity="0.8" />
      </g>
    </svg>
  );
}

const EMBLEMS: Record<string, () => React.ReactElement> = {
  "quantum-ai": QuantumEmblem,
  "business-commerce": BusinessEmblem,
  "sports-health": HealthEmblem,
  "media-performing": MediaEmblem,
  "liberal-arts": LiberalArtsEmblem,
  "applied-bio": BioEmblem,
  sustainability: SustainabilityEmblem,
};

/** Animated emblem for a school; falls back to the given icon for unknown schools. */
export default function SchoolEmblem({ schoolId, fallback: Fallback, size = 30 }: { schoolId: string; fallback?: React.ElementType; size?: number }) {
  const Emblem = EMBLEMS[schoolId];
  if (!Emblem) return Fallback ? <Fallback size={Math.round(size * 0.65)} /> : null;
  return (
    <span className="school-emblem" style={{ width: size, height: size }}>
      <Emblem />
    </span>
  );
}

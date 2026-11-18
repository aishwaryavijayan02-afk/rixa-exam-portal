"use client";

import React from "react";
import { FileText, Lock, Trash2 } from "lucide-react";

export interface MyUploadItem {
  id: string;
  fileName: string;
  subject: string;
  detail: string;
  /** Finalized items (e.g. COE approved) cannot be deleted by staff. */
  locked?: boolean;
  status: string;
}

/**
 * "Your uploads" list shown under an Academic Vault upload panel, so a staff
 * member can delete a syllabus or question bank after it was saved (deleting
 * also removes it from the HOD / Dean / COE review screens).
 */
export default function MyUploadsList({
  title,
  items,
  onDelete,
}: {
  title: string;
  items: MyUploadItem[];
  onDelete: (item: MyUploadItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginTop: "14px", borderTop: "1px dashed var(--vp-border, #e3cba8)", paddingTop: "12px" }}>
      <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--vp-text, #6b4226)", marginBottom: "8px" }}>
        {title} ({items.length})
      </div>
      <div style={{ display: "grid", gap: "8px" }}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "9px 11px",
              borderRadius: "10px",
              border: "1px solid var(--vp-border, #e3cba8)",
              background: "var(--vp-soft, #f6ecdd)",
            }}
          >
            <FileText size={16} style={{ flexShrink: 0, color: "var(--vp-accent, #a0673a)" }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div title={item.fileName} style={{ fontSize: "12px", fontWeight: 750, color: "#3b2a1e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.fileName}
              </div>
              <div style={{ fontSize: "10.5px", color: "#8a7260", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.subject} · {item.detail} · {item.status}
              </div>
            </div>
            {item.locked ? (
              <span title="Final approval is complete, so this upload is locked." style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10.5px", fontWeight: 700, color: "#8a7260", flexShrink: 0 }}>
                <Lock size={12} /> Locked
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onDelete(item)}
                title="Delete this upload"
                aria-label={`Delete ${item.fileName}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  flexShrink: 0,
                  padding: "6px 10px",
                  borderRadius: "8px",
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#dc2626",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Trash2 size={13} /> Delete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

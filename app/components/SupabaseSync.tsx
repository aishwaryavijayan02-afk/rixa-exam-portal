"use client";

import { useEffect } from "react";
import { examStore } from "../lib/examStore";

const APPROVAL_SYNC_INTERVAL_MS = 8000;

/**
 * Hydrates the local UI store from Supabase when the app starts, then keeps
 * the approval pipeline (questions + syllabus approvals) in step with other
 * users: a HOD's verification shows up on the Dean's screen without a reload.
 */
export default function SupabaseSync() {
  useEffect(() => {
    let running = false;
    const pull = async () => {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      try {
        await examStore.syncApprovalCollections();
      } finally {
        running = false;
      }
    };

    void examStore.syncFromSupabase();
    const timer = window.setInterval(() => void pull(), APPROVAL_SYNC_INTERVAL_MS);
    const onFocus = () => void pull();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  return null;
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders a modal / overlay straight into <body>.
 *
 * Page wrappers use CSS transform, filter and perspective (entrance
 * animations, glass effects). Any of those turns `position: fixed` into
 * "fixed to that wrapper", so an overlay inside a long scrolling page was
 * as tall as the page and its dialog ended up off screen: only the blurred
 * backdrop was visible. Portalling to <body> keeps every popup centred on
 * the viewport.
 */
export default function ModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

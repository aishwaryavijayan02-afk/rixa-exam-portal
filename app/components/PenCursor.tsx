"use client";

import { useEffect, useRef } from "react";

/**
 * Small pencil mouse cursor (professional, minimal):
 *  - the graphite tip is the exact click point,
 *  - no effect while moving; only a small quick ring on click,
 *  - slightly larger over buttons/links,
 *  - native text cursor inside text fields.
 * Disabled on touch devices and when the user prefers reduced motion.
 */

const INTERACTIVE = "a, button, [role='button'], select, label, summary, [onclick], .sidebar-btn-3d, input[type='checkbox'], input[type='radio']";
const TEXT_FIELD = "input:not([type='checkbox']):not([type='radio']):not([type='button']):not([type='submit']):not([type='file']), textarea, [contenteditable='true']";

type Ripple = { x: number; y: number; life: number };

export default function PenCursor() {
  const penRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pen = penRef.current;
    const canvas = canvasRef.current;
    if (!finePointer || reducedMotion || !pen || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    document.documentElement.classList.add("pen-cursor-on");

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    let targetX = -100;
    let targetY = -100;
    let x = -100;
    let y = -100;
    let visible = false;
    let hovering = false;
    let inText = false;
    let pressed = false;
    const ripples: Ripple[] = [];
    let frame = 0;

    // Frames are only requested while something changes (pointer moved, a
    // click ring is fading). An idle page runs no cursor work at all, and a
    // 1000 Hz mouse still costs one update per display frame.
    let lastTarget: Element | null = null;
    let ringsDrawn = false;
    let lastTime = performance.now();
    const requestTick = () => {
      if (!frame) frame = window.requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      targetX = event.clientX;
      targetY = event.clientY;
      lastTarget = event.target as Element | null;
      if (!visible) {
        visible = true;
        pen.style.opacity = "1";
      }
      requestTick();
    };
    const onDown = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      pressed = true;
      if (!inText) ripples.push({ x: event.clientX, y: event.clientY, life: 1 });
      requestTick();
    };
    const onUp = () => {
      pressed = false;
      requestTick();
    };
    const onLeave = () => {
      visible = false;
      pen.style.opacity = "0";
    };

    let prevTarget: Element | null = null;
    const tick = (time: number) => {
      frame = 0;
      // Time-based fade so the click ring lasts the same on 60/90/120/144 Hz.
      const step = Math.min(3, (time - lastTime) / (1000 / 60));
      lastTime = time;

      if (lastTarget !== prevTarget) {
        prevTarget = lastTarget;
        inText = Boolean(lastTarget?.closest?.(TEXT_FIELD));
        hovering = !inText && Boolean(lastTarget?.closest?.(INTERACTIVE));
        pen.classList.toggle("is-hover", hovering);
        pen.classList.toggle("is-text", inText);
      }

      // The pencil sits exactly on the pointer: no trail or tilt while moving.
      x = targetX;
      y = targetY;
      const scale = pressed ? 0.92 : hovering ? 1.08 : 1;
      pen.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;

      if (ripples.length > 0 || ringsDrawn) {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        ringsDrawn = false;
        // only effect: a small quick ring where you click
        for (let i = ripples.length - 1; i >= 0; i -= 1) {
          const ring = ripples[i];
          ring.life -= 0.07 * step;
          if (ring.life <= 0) {
            ripples.splice(i, 1);
            continue;
          }
          ctx.strokeStyle = `rgba(139, 90, 43, ${0.4 * ring.life})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(ring.x, ring.y, (1 - ring.life) * 12 + 2, 0, Math.PI * 2);
          ctx.stroke();
          ringsDrawn = true;
        }
        if (ripples.length > 0 || ringsDrawn) requestTick();
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("resize", resize);
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", resize);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.documentElement.classList.remove("pen-cursor-on");
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="pen-cursor-trail" aria-hidden="true" />
      <div ref={penRef} className="pen-cursor" aria-hidden="true">
        {/* Small pencil; the graphite tip at (1,1) is the click point. */}
        <svg className="pen-cursor-svg" width="22" height="22" viewBox="0 0 22 22">
          <g transform="rotate(-45 1 1)">
            {/* graphite tip */}
            <path d="M1 1 L2.6 5 L-0.6 5 Z" fill="#3b2a1e" />
            {/* sharpened wood */}
            <path d="M-0.6 5 L2.6 5 L4.2 9 L-2.2 9 Z" fill="#ecd5b0" stroke="#a0673a" strokeWidth="0.4" strokeLinejoin="round" />
            {/* body */}
            <rect x="-2.2" y="9" width="6.4" height="11" fill="#8b5a2b" stroke="#5a3a24" strokeWidth="0.5" />
            <path d="M1 9 L1 20" stroke="rgba(255, 240, 218, .45)" strokeWidth="0.9" />
            {/* metal band + eraser */}
            <rect x="-2.3" y="20" width="6.6" height="1.8" fill="#c9a27a" stroke="#6b4226" strokeWidth="0.4" />
            <rect x="-2.2" y="21.8" width="6.4" height="2.4" rx="1" fill="#f3e3cc" stroke="#a0673a" strokeWidth="0.4" />
          </g>
        </svg>
      </div>
    </>
  );
}

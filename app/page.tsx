"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { authStore, UserRole, authenticateUser } from "./lib/auth";
import {
  ShieldCheck,
  Zap,
  Sparkles,
  User,
  Lock,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Headphones,
  Home,
  Users,
  Calendar,
  Settings,
  BookOpen,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Check,
  GraduationCap,
  FileCheck,
  Award,
  Key
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Email is shown as typed; the eye button can hide it.
  const [showEmail, setShowEmail] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeInput, setActiveInput] = useState<"email" | "password" | null>(null);
  const [isFieldReadOnly, setIsFieldReadOnly] = useState(true);
  const signInButtonRef = useRef<HTMLButtonElement>(null);

  // Strictly prevent browser autofill on load
  useEffect(() => {
    setEmail("");
    setPassword("");
    const timer = setTimeout(() => {
      setIsFieldReadOnly(false);
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  // The portal always uses the light cream & brown theme.
  useEffect(() => {
    document.documentElement.classList.remove("dark-theme");
    document.body?.classList.remove("dark-theme");
  }, []);

  // Animated counters state
  const [studentsCount, setStudentsCount] = useState(0);
  const [subjectsCount, setSubjectsCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  // Mouse tilt effect for 3D stage
  const stageRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [12, -12]), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-14, 14]), { stiffness: 200, damping: 20 });
  const capFloatY = useSpring(useTransform(mouseY, [-0.5, 0.5], [-15, 15]), { stiffness: 150, damping: 15 });
  const clipboardFloatX = useSpring(useTransform(mouseX, [-0.5, 0.5], [-10, 10]), { stiffness: 150, damping: 15 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const currentMouseX = (e.clientX - rect.left) / width - 0.5;
    const currentMouseY = (e.clientY - rect.top) / height - 0.5;
    mouseX.set(currentMouseX);
    mouseY.set(currentMouseY);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  // Canvas particle effect for left side
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 600);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 800);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener("resize", handleResize);

    // Letters scattered across the header, drifting slowly upward with a
    // gentle sway, rotation and fade (replaces the old bubble particles).
    const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZABCD";
    const COLORS = ["245, 230, 204", "224, 169, 109", "236, 213, 176", "192, 133, 82"];
    const FONTS = ["Georgia, 'Times New Roman', serif", "Inter, \"Segoe UI\", sans-serif"];
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    type FloatingLetter = {
      char: string;
      x: number;
      y: number;
      size: number;
      speedY: number;
      swayAmp: number;
      swaySpeed: number;
      phase: number;
      rotation: number;
      spin: number;
      baseOpacity: number;
      color: string;
      font: string;
    };
    const makeLetter = (startAnywhere: boolean): FloatingLetter => ({
      char: LETTERS[Math.floor(Math.random() * LETTERS.length)],
      x: Math.random() * width,
      y: startAnywhere ? Math.random() * height : height + 30,
      size: 12 + Math.random() * 20,
      speedY: 0.15 + Math.random() * 0.35,
      swayAmp: 6 + Math.random() * 14,
      swaySpeed: 0.0006 + Math.random() * 0.0009,
      phase: Math.random() * Math.PI * 2,
      rotation: (Math.random() - 0.5) * 0.6,
      spin: (Math.random() - 0.5) * 0.004,
      baseOpacity: 0.14 + Math.random() * 0.26,
      color: `rgb(${COLORS[Math.floor(Math.random() * COLORS.length)]})`,
      font: "",
    });
    const withFont = (letter: FloatingLetter): FloatingLetter => {
      // Built once per letter instead of re-parsing the font string every frame.
      letter.font = `700 ${Math.round(letter.size)}px ${FONTS[Math.floor(Math.random() * FONTS.length)]}`;
      return letter;
    };
    const letters: FloatingLetter[] = Array.from({ length: 28 }, () => withFont(makeLetter(true)));

    // Time-based motion: the same speed on 60, 90, 120 or 144 Hz screens.
    let lastTime = performance.now();
    const render = (time: number = performance.now()) => {
      const step = Math.min(3, (time - lastTime) / (1000 / 60));
      lastTime = time;
      ctx.clearRect(0, 0, width, height);
      const now = time;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      letters.forEach((letter, index) => {
        if (!reduceMotion) {
          letter.y -= letter.speedY * step;
          letter.rotation += letter.spin * step;
        }
        if (letter.y < -30) letters[index] = withFont(makeLetter(false));
        const sway = reduceMotion ? 0 : Math.sin(now * letter.swaySpeed + letter.phase) * letter.swayAmp;
        // fade in near the bottom, out near the top, with a soft twinkle
        const edgeFade = Math.min(1, letter.y / 80, (height - letter.y) / 80);
        const twinkle = 0.75 + 0.25 * Math.sin(now * 0.0012 + letter.phase);
        const alpha = Math.max(0, letter.baseOpacity * edgeFade * twinkle);

        // No shadowBlur: a per-letter blur is the most expensive canvas op.
        ctx.setTransform(1, 0, 0, 1, letter.x + sway, letter.y);
        ctx.rotate(letter.rotation);
        ctx.font = letter.font;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = letter.color;
        ctx.fillText(letter.char, 0, 0);
      });
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Number Counter Animation on load
  useEffect(() => {
    let startTime: number | null = null;
    const duration = 1800; // ms

    const animateCounters = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOutQuad = (t: number) => t * (2 - t);
      const easeVal = easeOutQuad(progress);

      setStudentsCount(Math.floor(easeVal * 2568));
      setSubjectsCount(Math.floor(easeVal * 24));
      setPendingCount(Math.floor(easeVal * 12));

      if (progress < 1) {
        requestAnimationFrame(animateCounters);
      }
    };

    const animTimer = setTimeout(() => {
      requestAnimationFrame(animateCounters);
    }, 300);

    return () => clearTimeout(animTimer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsSubmitting(true);

    // No role picker: the role comes from the email ID (see roleFromEmail).
    const { user, error } = await authenticateUser(email, password);

    if (error || !user) {
      setTimeout(() => {
        setLoginError(error || "Invalid email or password.");
        setIsSubmitting(false);
      }, 300);
      return;
    }

    // Confetti pop positioned directly at the Sign In button / login card ("ligin panra place le")
    let originX = 0.74;
    let originY = 0.65;
    if (signInButtonRef.current) {
      const rect = signInButtonRef.current.getBoundingClientRect();
      originX = (rect.left + rect.width / 2) / window.innerWidth;
      originY = (rect.top + rect.height / 2) / window.innerHeight;
    }

    confetti({
      particleCount: 95,
      spread: 80,
      origin: { x: originX, y: originY },
      colors: ["#cc9564", "#cc9565", "#10b981", "#d3a37a"],
    });

    setTimeout(() => {
      authStore.setCurrentUser(user);
      router.push(user.role === "SCRUTINIZER" ? "/scrutinizer" : "/dashboard");
    }, 600);
  };

  return (
    <div className="split-page-container relative">


      {/* =========================================================
          LEFT HALF: DARK COSMIC AURORA & 3D ACADEMIC STAGE
      ========================================================= */}
      <section
        className="left-split-section"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Interactive Cosmic Particle Canvas & Aurora Background */}
        <div className="left-aurora-bg">
          <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />
          <motion.div
            className="aurora-swirl-cyan"
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.45, 0.6, 0.45],
              rotate: [-25, -20, -25],
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="aurora-swirl-purple"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.25, 0.4, 0.25],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
          <div className="cosmic-stars" />
        </div>

        {/* Top Content Stack */}
        <div className="left-content-stack">
          {/* Rathinam Logo with Animated Glow Sheen */}
          <motion.div
            className="left-brand-logo relative"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="login-brand-lockup" aria-label="Rathinam Global Exam Cell">
              <span className="login-brand-mark">RG</span>
              <span className="login-brand-name">Rathinam Global<span>EXAM CELL PORTAL</span></span>
            </div>
          </motion.div>

          {/* Smart Academic Platform Badge */}
          <motion.div
            className="platform-badge"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            whileHover={{ scale: 1.05, boxShadow: "0 0 25px rgba(204, 149, 100, 0.5)" }}
          >
            <span className="badge-pulse-dot" />
            <span className="badge-text">Smart Academic Platform</span>
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse ml-1" />
          </motion.div>

          {/* Main Hero Headings */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <h1 className="hero-main-title">
              Manage Academics.
              <br />
              Simplify{" "}
              <motion.span
                className="title-exams-gradient"
                animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                transition={{ duration: 6, repeat: Infinity }}
              >
                Exams.
              </motion.span>
            </h1>
            <p className="hero-subtitle" style={{ marginTop: "10px" }}>
              A unified workspace for managing departments, subjects and
              academic activities with ease.
            </p>
          </motion.div>

          {/* ================= 3D INTERACTIVE ACADEMIC DASHBOARD STAGE ================= */}
          <div className="stage-container" ref={stageRef}>
            <motion.div
              className="w-full h-full relative"
              style={{
                rotateX,
                rotateY,
                transformStyle: "preserve-3d",
              }}
            >
              {/* Ambient Stage Glow & Pedestal Disk */}
              <div className="pedestal-ambient-glow" />
              <motion.div
                className="pedestal-disk"
                animate={{
                  boxShadow: [
                    "0 0 35px rgba(204, 149, 100, 0.45)",
                    "0 0 50px rgba(211, 163, 122, 0.6)",
                    "0 0 35px rgba(204, 149, 100, 0.45)",
                  ],
                }}
                transition={{ duration: 4, repeat: Infinity }}
              />

              {/* Stack of 3 Glossy Books */}
              <motion.div
                className="books-stack"
                whileHover={{ y: -6, rotateZ: 2 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="book-slab book-slab-blue" />
                <div className="book-slab book-slab-orange" />
                <div className="book-slab book-slab-purple" />
              </motion.div>

              {/* Dashboard Tablet */}
              <motion.div
                className="stage-tablet"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.4 }}
              >
                {/* Sidebar */}
                <div className="tablet-sidebar">
                  <div className="tablet-sidebar-icon sidebar-icon-active">
                    <Home size={14} />
                  </div>
                  <div className="tablet-sidebar-icon">
                    <Users size={14} />
                  </div>
                  <div className="tablet-sidebar-icon">
                    <Calendar size={14} />
                  </div>
                  <div className="tablet-sidebar-icon">
                    <Settings size={14} />
                  </div>
                </div>

                {/* Tablet Content */}
                <div className="tablet-main">
                  <div className="cal-header-row">
                    <span>Exam Schedule</span>
                    <div className="cal-month-switch">
                      <ChevronLeft size={11} style={{ cursor: "pointer" }} />
                      <span>May 2024</span>
                      <ChevronRight size={11} style={{ cursor: "pointer" }} />
                    </div>
                  </div>

                  {/* Calendar Days */}
                  <div className="cal-matrix">
                    <span className="cal-head-day">S</span>
                    <span className="cal-head-day">M</span>
                    <span className="cal-head-day">T</span>
                    <span className="cal-head-day">W</span>
                    <span className="cal-head-day">T</span>
                    <span className="cal-head-day">F</span>
                    <span className="cal-head-day">S</span>

                    <span className="cal-day-cell" style={{ opacity: 0.35 }}>28</span>
                    <span className="cal-day-cell" style={{ opacity: 0.35 }}>29</span>
                    <span className="cal-day-cell" style={{ opacity: 0.35 }}>30</span>
                    <span className="cal-day-cell">1</span>
                    <span className="cal-day-cell">2</span>
                    <span className="cal-day-cell">3</span>
                    <span className="cal-day-cell">4</span>

                    <span className="cal-day-cell">5</span>
                    <span className="cal-day-cell">6</span>
                    <span className="cal-day-cell">7</span>
                    <span className="cal-day-cell">8</span>
                    <span className="cal-day-cell">9</span>
                    <span className="cal-day-cell">10</span>
                    <span className="cal-day-cell">11</span>

                    <span className="cal-day-cell">12</span>
                    <span className="cal-day-cell">13</span>
                    <span className="cal-day-cell">14</span>
                    <motion.span
                      className="cal-day-cell day-cell-active"
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      15
                    </motion.span>
                    <span className="cal-day-cell">16</span>
                    <span className="cal-day-cell">17</span>
                    <span className="cal-day-cell">18</span>

                    <span className="cal-day-cell">19</span>
                    <span className="cal-day-cell">20</span>
                    <span className="cal-day-cell">21</span>
                    <span className="cal-day-cell">22</span>
                    <span className="cal-day-cell">23</span>
                    <span className="cal-day-cell">24</span>
                    <span className="cal-day-cell">25</span>

                    <span className="cal-day-cell">26</span>
                    <span className="cal-day-cell">27</span>
                    <span className="cal-day-cell">28</span>
                    <span className="cal-day-cell">29</span>
                    <span className="cal-day-cell">30</span>
                    <span className="cal-day-cell">31</span>
                    <span className="cal-day-cell" style={{ opacity: 0.35 }}>1</span>
                  </div>
                </div>
              </motion.div>

              {/* Exam Paper Clipboard with Floating Tilt */}
              <motion.div
                className="paper-clipboard"
                style={{ x: clipboardFloatX }}
                animate={{
                  y: [0, -8, 0],
                  rotate: [-5, -2, -5],
                }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                whileHover={{ scale: 1.08, rotate: 0 }}
              >
                <div className="clipboard-binder-clip" />
                <div className="clipboard-page">
                  <span className="page-title">Exam Paper</span>
                  <div className="page-item-line">
                    <span className="check-dot">✓</span>
                    <div className="item-bar" />
                  </div>
                  <div className="page-item-line">
                    <span className="check-dot">✓</span>
                    <div className="item-bar" />
                  </div>
                  <div className="page-item-line">
                    <span className="check-dot">✓</span>
                    <div className="item-bar" />
                  </div>
                </div>
              </motion.div>

              {/* Floating Graduation Cap Mortarboard with Golden Tassel Swinging */}
              <motion.div
                className="mortarboard-wrapper"
                style={{ y: capFloatY }}
                animate={{
                  y: [0, -12, 0],
                  rotate: [-8, -4, -8],
                }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                whileHover={{ scale: 1.12, rotate: 5 }}
              >
                <div className="mortarboard-diamond">
                  <motion.div
                    className="mortarboard-gold-tassel"
                    animate={{ rotate: [-6, 6, -6] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <div className="tassel-tip" />
                  </motion.div>
                </div>
                <div className="mortarboard-cap-base" />
              </motion.div>

              {/* Right Platform Stats Widgets */}
              <div className="stage-right-widgets">
                {/* Total Students Card with Animated Count Up */}
                <motion.div
                  className="widget-students"
                  whileHover={{ scale: 1.06, translateY: -4 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <div className="widget-students-top">
                    <span>Total Students</span>
                    <span className="badge-green-trend">
                      <TrendingUp size={9} /> +12.5%
                    </span>
                  </div>
                  <div className="widget-students-val font-mono">
                    {studentsCount.toLocaleString()}
                  </div>
                  <svg className="sparkline-svg" viewBox="0 0 150 25" fill="none">
                    <motion.path
                      d="M 0 18 Q 25 10, 50 16 T 100 8 T 150 4"
                      stroke="#cc9564"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 2, ease: "easeInOut" }}
                    />
                    <path
                      d="M 0 18 Q 25 10, 50 16 T 100 8 T 150 4 L 150 25 L 0 25 Z"
                      fill="url(#sparkGrad)"
                      opacity="0.25"
                    />
                    <defs>
                      <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#cc9564" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#cc9564" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </motion.div>

                {/* Twin Mini Widgets */}
                <div className="widget-row-twin">
                  <motion.div
                    className="twin-box"
                    whileHover={{ scale: 1.08 }}
                    transition={{ type: "spring", stiffness: 350 }}
                  >
                    <span className="twin-label">School</span>
                    <div className="twin-number font-mono">{subjectsCount}</div>
                    <div className="twin-icon-purple">
                      <BookOpen size={11} />
                    </div>
                  </motion.div>

                  <motion.div
                    className="twin-box"
                    whileHover={{ scale: 1.08 }}
                    transition={{ type: "spring", stiffness: 350 }}
                  >
                    <span className="twin-label">Pending Papers</span>
                    <div className="twin-number font-mono">{pendingCount}</div>
                    <span className="twin-link-orange">View all</span>
                  </motion.div>
                </div>
              </div>

              {/* Bottom Foot Elements */}
              <div className="stage-foot-elements">
                {/* Student Profile Card */}
                <motion.div
                  className="mini-profile-capsule"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="profile-avatar-circle">👨‍🎓</div>
                  <div className="profile-lines-col">
                    <div className="profile-bar-line" style={{ width: "36px" }} />
                    <div className="profile-bar-line" style={{ width: "22px" }} />
                    <span style={{ fontSize: "7px", color: "#eab308" }}>★★★★</span>
                  </div>
                </motion.div>

                {/* 3D Colorful Bars */}
                <div className="stage-bars-3d">
                  <motion.div
                    className="bar-pill bar-pill-blue"
                    animate={{ height: ["20px", "26px", "20px"] }}
                    transition={{ duration: 2.2, repeat: Infinity }}
                  />
                  <motion.div
                    className="bar-pill bar-pill-cyan"
                    animate={{ height: ["28px", "18px", "28px"] }}
                    transition={{ duration: 2.6, repeat: Infinity }}
                  />
                  <motion.div
                    className="bar-pill bar-pill-orange"
                    animate={{ height: ["36px", "42px", "36px"] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />
                </div>

                {/* Succulent Plant */}
                <motion.div
                  className="potted-plant-wrap"
                  whileHover={{ rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <span className="plant-emoji">🪴</span>
                  <div className="pot-base" />
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Bottom 3 Feature Badges with Hover Pop Animations */}
        <div className="left-bottom-features">
          {/* Secure */}
          <motion.div
            className="feature-pill-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            whileHover={{ scale: 1.05, translateY: -4 }}
          >
            <motion.div
              className="feature-icon-badge icon-cyan-aura"
              whileHover={{ rotate: 360, scale: 1.15 }}
              transition={{ duration: 0.6 }}
            >
              <ShieldCheck size={20} />
            </motion.div>
            <div className="feature-card-texts">
              <strong>Secure</strong>
              <p>Your data is protected with advanced security.</p>
            </div>
          </motion.div>

          {/* Fast */}
          <motion.div
            className="feature-pill-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            whileHover={{ scale: 1.05, translateY: -4 }}
          >
            <motion.div
              className="feature-icon-badge icon-amber-aura"
              whileHover={{ scale: 1.25, rotate: 15 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <Zap size={20} />
            </motion.div>
            <div className="feature-card-texts">
              <strong>Fast</strong>
              <p>Access information quickly and efficiently.</p>
            </div>
          </motion.div>

          {/* Simple */}
          <motion.div
            className="feature-pill-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            whileHover={{ scale: 1.05, translateY: -4 }}
          >
            <motion.div
              className="feature-icon-badge icon-purple-aura"
              whileHover={{ scale: 1.25, rotate: -15 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <Sparkles size={20} />
            </motion.div>
            <div className="feature-card-texts">
              <strong>Simple</strong>
              <p>Everything organized in one place.</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =========================================================
          RIGHT HALF: CLEAN LIGHT SOFT LAVENDER & WHITE LOGIN CARD
      ========================================================= */}
      <section className="right-split-section">
        {/* Soft Ambient Pastel Glows & Subtle Dot Grid */}
        <div className="right-ambient-bg">
          <motion.div
            className="light-orb-top"
            animate={{
              scale: [1, 1.2, 1],
              x: [0, 20, 0],
              y: [0, -15, 0],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="light-orb-bottom"
            animate={{
              scale: [1, 1.25, 1],
              x: [0, -25, 0],
              y: [0, 20, 0],
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="right-dot-grid" />
        </div>

        {/* Pure White Rounded Login Card with Pop Entrance */}
        <motion.div
          className="white-login-card shadow-2xl relative"
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Header: animated RXA logo, then the sign-in title */}
          <div className="card-welcome-header mt-1">
            <div style={{ display: "flex", justifyContent: "center", marginTop: "-14px", marginBottom: "-22px" }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.55, rotate: -12 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 170, damping: 13, delay: 0.15 }}
                whileHover={{ scale: 1.06 }}
                style={{ position: "relative", width: "190px", height: "190px" }}
              >
                {/* Soft pulsing glow in the logo's colours */}
                <motion.div
                  aria-hidden="true"
                  animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.9, 1.05, 0.9] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                  style={{ position: "absolute", inset: "18%", borderRadius: "50%", background: "radial-gradient(circle, rgba(14,165,233,0.28) 0%, rgba(249,115,22,0.18) 45%, rgba(132,204,22,0) 72%)", filter: "blur(10px)" }}
                />
                <motion.img
                  src="/images/rxa-logo.png"
                  alt="RXA"
                  draggable={false}
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.9 }}
                  style={{ position: "relative", width: "100%", height: "100%", objectFit: "contain", userSelect: "none" }}
                />
              </motion.div>
            </div>
            <motion.h2
              className="card-title"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45 }}
              style={{ textAlign: "center" }}
            >
              Sign in to your account
            </motion.h2>
            <p className="card-subtitle" style={{ textAlign: "center" }}>
              Enter your credentials to access the examination portal.
            </p>

            {/* Login Error Banner */}
            <AnimatePresence>
              {loginError && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  style={{
                    marginTop: "14px",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    background: "#fef2f2",
                    border: "1px solid #fca5a5",
                    color: "#dc2626",
                    fontSize: "12px",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <span>{loginError}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="light-login-form" autoComplete="off">
            {/* Dummy honeypot inputs to absorb browser autofill */}
            <div style={{ position: "absolute", opacity: 0, height: 0, width: 0, overflow: "hidden", zIndex: -1 }} aria-hidden="true">
              <input type="text" name="chrome_dummy_username" tabIndex={-1} autoComplete="off" />
              <input type="password" name="chrome_dummy_password" tabIndex={-1} autoComplete="off" />
            </div>

            {/* Email / User ID Input */}
            <div className="light-input-block">
              <label className="light-label">Email / User ID</label>
              <motion.div
                className={`light-input-wrapper transition-all duration-300 ${
                  activeInput === "email" ? "border-blue-600 ring-4 ring-blue-500/15 shadow-lg" : ""
                }`}
                animate={{ scale: activeInput === "email" ? 1.01 : 1 }}
              >
                <motion.span
                  className="light-icon-left"
                  animate={activeInput === "email" ? { scale: 1.25, color: "#c3844d" } : { scale: 1, color: "#94a3b8" }}
                >
                  <User size={18} />
                </motion.span>
                <input
                  type="text"
                  name="rathinam_portal_username_field"
                  className="light-input-field"
                  placeholder="Enter your email"
                  value={email}
                  // Shown as typed; hidden as dots only when the eye button is used.
                  style={{ ...(showEmail ? {} : ({ WebkitTextSecurity: "disc" } as React.CSSProperties)) }}
                  readOnly={isFieldReadOnly}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={(e) => {
                    e.currentTarget.readOnly = false;
                    setIsFieldReadOnly(false);
                    setActiveInput("email");
                  }}
                  onBlur={() => setActiveInput(null)}
                  autoComplete="new-password"
                  data-form-type="other"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  required
                />
                {email && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-emerald-500" style={{ marginRight: "44px", display: "flex" }}>
                    <CheckCircle2 size={16} />
                  </motion.span>
                )}
                <motion.button
                  type="button"
                  className="light-eye-btn"
                  onClick={() => setShowEmail(!showEmail)}
                  aria-label={showEmail ? "Hide email" : "Show email"}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {/* Same eye icon as the password box; crossed out only while the email is hidden. */}
                  {showEmail ? <Eye size={18} /> : <EyeOff size={18} className="text-blue-600" />}
                </motion.button>
              </motion.div>
            </div>

            {/* Password Input */}
            <div className="light-input-block">
              <label className="light-label">Password</label>
              <motion.div
                className={`light-input-wrapper transition-all duration-300 ${
                  activeInput === "password" ? "border-blue-600 ring-4 ring-blue-500/15 shadow-lg" : ""
                }`}
                animate={{ scale: activeInput === "password" ? 1.01 : 1 }}
              >
                <motion.span
                  className="light-icon-left"
                  animate={activeInput === "password" ? { scale: 1.25, color: "#c3844d" } : { scale: 1, color: "#94a3b8" }}
                >
                  <Lock size={18} />
                </motion.span>
                <input
                  type={showPassword ? "text" : "password"}
                  name="rathinam_portal_password_field"
                  className="light-input-field"
                  placeholder="Enter your password"
                  value={password}
                  readOnly={isFieldReadOnly}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={(e) => {
                    e.currentTarget.readOnly = false;
                    setIsFieldReadOnly(false);
                    setActiveInput("password");
                  }}
                  onBlur={() => setActiveInput(null)}
                  autoComplete="new-password"
                  data-form-type="other"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  required
                />
                <motion.button
                  type="button"
                  className="light-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {showPassword ? <EyeOff size={18} className="text-blue-600" /> : <Eye size={18} />}
                </motion.button>
              </motion.div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="light-remember-row">
              <label className="light-remember-label cursor-pointer flex items-center gap-2">
                <input
                  type="checkbox"
                  className="light-checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
              <a href="#forgot" className="light-forgot-link hover:underline">
                Forgot password?
              </a>
            </div>

            {/* Sign In Gradient Button with Shimmer and Pop Hover */}
            <motion.button
              ref={signInButtonRef}
              type="submit"
              disabled={isSubmitting}
              className="btn-primary-gradient relative overflow-hidden group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Shimmer Light Beam Effect */}
              <motion.div
                className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12"
                initial={{ x: "-150%" }}
                animate={{ x: "250%" }}
                transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.5 }}
              />

              {isSubmitting ? (
                <div className="flex items-center gap-2 justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing In...</span>
                </div>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} className="group-hover:-rotate-12 transition-transform duration-300" />
                </>
              )}
            </motion.button>

            {/* OR Divider */}
            <div className="light-or-divider">
              <span className="light-or-line" />
              <span className="light-or-text">OR</span>
              <span className="light-or-line" />
            </div>

            {/* Social Logins with Bounce Icons */}
            <div className="light-social-grid">
              {/* Google */}
              <motion.button
                type="button"
                className="btn-light-social"
                whileHover={{ scale: 1.03, borderColor: "#cd9869" }}
                whileTap={{ scale: 0.97 }}
                onClick={() => router.push("/institution")}
              >
                <svg className="social-logo-img" viewBox="0 0 24 24">
                  <path
                    fill="#cd9869"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Google</span>
              </motion.button>

              {/* Microsoft */}
              <motion.button
                type="button"
                className="btn-light-social"
                whileHover={{ scale: 1.03, borderColor: "#b3743c" }}
                whileTap={{ scale: 0.97 }}
                onClick={() => router.push("/institution")}
              >
                <svg className="social-logo-img" viewBox="0 0 21 21">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                  <rect x="1" y="11" width="9" height="9" fill="#b3743c" />
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                </svg>
                <span>Microsoft</span>
              </motion.button>
            </div>

            {/* Support Footer */}
            <div className="card-support-footer">
              <motion.div
                className="support-blue-headset"
                whileHover={{ rotate: [0, -15, 15, 0] }}
                transition={{ duration: 0.4 }}
              >
                <Headphones size={18} />
              </motion.div>
              <div className="support-text-col">
                <span>Need help accessing your account?</span>
                <a href="#support" className="support-blue-link hover:underline">
                  Contact Exam Cell Support
                </a>
              </div>
            </div>
          </form>
        </motion.div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";

/* ─── Constants ────────────────────────────────────────────────────── */
const FRAME_INTERVAL = 33; // ~30 fps
const ROTATION_SPEED = 0.0024;
const CENTER_X_RATIO = 0.75;
const CENTER_Y_RATIO = 0.48;
const SPHERE_RADIUS_RATIO = 0.045; // Core sphere size relative to galaxy radius

/* Star distribution */
const CORE_STARS = 1200;
const ARM_STARS = 4000;
const SCATTER_STARS = 800;
const BG_STARS = 300;
const ARMS = 2;
const ARM_SPREAD = 0.35;
const TILT = 0.38; // Vertical squish for perspective (0=edge-on, 1=face-on)

/* ─── Types ────────────────────────────────────────────────────────── */
const enum StarLayer {
  Core,
  Arm,
  Scatter,
  Background,
}

interface Star {
  /** Orbital angle in galaxy plane (radians) */
  angle: number;
  /** Distance from center (0..1 normalized to galaxy radius) */
  dist: number;
  /** Small random offset for natural scatter (normalized) */
  scatterX: number;
  scatterY: number;
  /** Rendering */
  size: number;
  layer: StarLayer;
  /** Color hue (degrees) */
  hue: number;
  saturation: number;
  lightness: number;
  baseAlpha: number;
}

/** Theme-dependent rendering profile */
interface ThemeProfile {
  isDark: boolean;
  /** Multiplier for star alpha values */
  alphaBoost: number;
  /** Lightness adjustment: dark mode uses stored values, light mode darkens them */
  lightnessClamp: (l: number) => number;
  /** Core glow color stops */
  coreOuter: [string, string, string];
  coreInner: [string, string, string, string];
  corePoint: [string, string, string];
  /** Ring stroke color + alpha */
  ringColor: string;
  ringAlpha: number;
  /** Background star lightness */
  bgLightness: (l: number) => number;
  /** Core sphere colors */
  sphereBase: string;       // Dark hemisphere color
  sphereMid: string;        // Mid-tone blue
  sphereBright: string;     // Bright face color
  sphereHighlight: string;  // Specular spot
  sphereAura: string;       // Outer glow color
  sphereAuraAlpha: number;  // Outer glow opacity
}

const THEME_DARK: ThemeProfile = {
  isDark: true,
  alphaBoost: 1.0,
  lightnessClamp: (l) => l,
  coreOuter: ["rgba(0,160,255,0.15)", "rgba(0,120,255,0.06)", "rgba(0,60,255,0)"],
  coreInner: ["rgba(120,200,255,0.45)", "rgba(40,140,255,0.3)", "rgba(20,80,255,0.12)", "rgba(0,40,180,0)"],
  corePoint: ["rgba(200,230,255,0.7)", "rgba(100,180,255,0.3)", "rgba(30,100,255,0)"],
  ringColor: "rgba(80,180,255,0.4)",
  ringAlpha: 0.12,
  bgLightness: (l) => l,
  sphereBase: "rgb(5, 15, 60)",
  sphereMid: "rgb(20, 80, 200)",
  sphereBright: "rgb(60, 170, 255)",
  sphereHighlight: "rgba(180, 230, 255, 0.95)",
  sphereAura: "rgba(0, 140, 255, 0.35)",
  sphereAuraAlpha: 1.0,
};

const THEME_LIGHT: ThemeProfile = {
  isDark: false,
  alphaBoost: 2.8,
  lightnessClamp: (l) => Math.min(l, 40), // Force darker stars on bright background
  coreOuter: ["rgba(0,100,220,0.25)", "rgba(0,80,200,0.12)", "rgba(0,40,180,0)"],
  coreInner: ["rgba(30,100,220,0.55)", "rgba(20,80,200,0.4)", "rgba(10,60,180,0.18)", "rgba(0,30,150,0)"],
  corePoint: ["rgba(40,120,220,0.8)", "rgba(20,80,200,0.45)", "rgba(10,50,180,0)"],
  ringColor: "rgba(20,80,200,0.5)",
  ringAlpha: 0.25,
  bgLightness: (l) => Math.min(l, 50),
  sphereBase: "rgb(10, 30, 100)",
  sphereMid: "rgb(30, 100, 220)",
  sphereBright: "rgb(80, 180, 255)",
  sphereHighlight: "rgba(200, 235, 255, 0.9)",
  sphereAura: "rgba(0, 100, 220, 0.3)",
  sphereAuraAlpha: 1.0,
};

function getThemeProfile(): ThemeProfile {
  return document.documentElement.classList.contains("dark") ? THEME_DARK : THEME_LIGHT;
}

/* ─── Star generation ──────────────────────────────────────────────── */

function randomGaussian(): number {
  // Box-Muller transform — gives natural clustering
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function generateStars(): Star[] {
  const stars: Star[] = [];

  // ── Core stars: dense bright cluster at center ──
  for (let i = 0; i < CORE_STARS; i++) {
    const dist = Math.min(Math.abs(randomGaussian()) * 0.12, 0.25);
    const angle = Math.random() * Math.PI * 2;

    const lum = 70 + Math.random() * 30;
    stars.push({
      angle,
      dist,
      scatterX: 0,
      scatterY: 0,
      size: Math.random() * 1.2 + 0.4,
      layer: StarLayer.Core,
      hue: 200 + Math.random() * 20,
      saturation: 60 + Math.random() * 40,
      lightness: lum,
      baseAlpha: 0.6 + Math.random() * 0.4,
    });
  }

  // ── Spiral arm stars ──
  for (let i = 0; i < ARM_STARS; i++) {
    const armIndex = i % ARMS;
    const armOffset = (armIndex / ARMS) * Math.PI * 2;

    const t = Math.random(); // 0..1 along the arm
    const dist = 0.05 + t * 0.85;

    // Spiral winding angle
    const spiralAngle = armOffset + t * Math.PI * 3.2;

    // Spread perpendicular to arm (stored as scatter offset)
    const spread = randomGaussian() * ARM_SPREAD * (0.3 + t * 0.7);
    const angle = spiralAngle + spread;

    // Small random scatter for natural look
    const scatterX = randomGaussian() * 0.01;
    const scatterY = randomGaussian() * 0.01;

    const colorVariation = Math.random();
    let hue: number, sat: number, light: number;

    if (colorVariation < 0.7) {
      hue = 195 + Math.random() * 30;
      sat = 70 + Math.random() * 30;
      light = 55 + (1 - t) * 30;
    } else if (colorVariation < 0.88) {
      hue = 210;
      sat = 10 + Math.random() * 30;
      light = 80 + Math.random() * 20;
    } else if (colorVariation < 0.95) {
      hue = 20 + Math.random() * 30;
      sat = 80 + Math.random() * 20;
      light = 55 + Math.random() * 25;
    } else {
      hue = 350 + Math.random() * 20;
      sat = 70 + Math.random() * 30;
      light = 50 + Math.random() * 20;
    }

    const alpha = (1 - t * 0.6) * (0.3 + Math.random() * 0.5);

    stars.push({
      angle,
      dist,
      scatterX,
      scatterY,
      size: Math.random() * 1.0 + 0.3,
      layer: StarLayer.Arm,
      hue,
      saturation: sat,
      lightness: light,
      baseAlpha: alpha,
    });
  }

  // ── Scattered halo stars ──
  for (let i = 0; i < SCATTER_STARS; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 0.3 + Math.random() * 0.7;
    const scatterX = (Math.random() - 0.5) * 0.15;
    const scatterY = (Math.random() - 0.5) * 0.08;

    const colorRoll = Math.random();
    let hue: number;
    if (colorRoll < 0.5) hue = 200 + Math.random() * 20;
    else if (colorRoll < 0.75) hue = 30 + Math.random() * 20;
    else if (colorRoll < 0.9) hue = 0 + Math.random() * 15;
    else hue = 260 + Math.random() * 30;

    stars.push({
      angle,
      dist,
      scatterX,
      scatterY,
      size: Math.random() * 0.8 + 0.2,
      layer: StarLayer.Scatter,
      hue,
      saturation: 50 + Math.random() * 50,
      lightness: 50 + Math.random() * 30,
      baseAlpha: 0.15 + Math.random() * 0.35,
    });
  }

  // ── Background distant stars (static, no orbit) ──
  for (let i = 0; i < BG_STARS; i++) {
    stars.push({
      angle: 0,
      dist: 2,
      scatterX: (Math.random() - 0.5) * 2.5,
      scatterY: (Math.random() - 0.5) * 2.5,
      size: Math.random() * 0.6 + 0.2,
      layer: StarLayer.Background,
      hue: 0,
      saturation: 0,
      lightness: 80 + Math.random() * 20,
      baseAlpha: 0.2 + Math.random() * 0.5,
    });
  }

  return stars;
}

/* ─── Component ────────────────────────────────────────────────────── */

export function GalaxyBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let destroyed = false;
    let animFrame = 0;
    let lastTime = 0;
    let rotationAngle = 0;
    let width = 0;
    let height = 0;
    let galaxyRadius = 0;
    let centerX = 0;
    let centerY = 0;

    const stars = generateStars();

    /* ── Resize handler ── */
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      width = rect.width;
      height = rect.height;
      galaxyRadius = Math.min(width, height) * 1.95;
      centerX = width * CENTER_X_RATIO;
      centerY = height * CENTER_Y_RATIO;
    };

    /* ── Draw core glow (radial gradient) — theme-aware ── */
    const drawCoreGlow = (tp: ThemeProfile) => {
      const coreR = galaxyRadius * 0.18;

      // Outer halo
      const outerGlow = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, coreR * 2.5
      );
      outerGlow.addColorStop(0, tp.coreOuter[0]);
      outerGlow.addColorStop(0.3, tp.coreOuter[1]);
      outerGlow.addColorStop(1, tp.coreOuter[2]);

      ctx.fillStyle = outerGlow;
      ctx.fillRect(0, 0, width, height);

      // Inner bright core
      const innerGlow = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, coreR
      );
      innerGlow.addColorStop(0, tp.coreInner[0]);
      innerGlow.addColorStop(0.2, tp.coreInner[1]);
      innerGlow.addColorStop(0.5, tp.coreInner[2]);
      innerGlow.addColorStop(1, tp.coreInner[3]);

      ctx.fillStyle = innerGlow;
      ctx.fillRect(0, 0, width, height);

      // Bright center point
      const corePoint = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, coreR * 0.3
      );
      corePoint.addColorStop(0, tp.corePoint[0]);
      corePoint.addColorStop(0.5, tp.corePoint[1]);
      corePoint.addColorStop(1, tp.corePoint[2]);

      ctx.fillStyle = corePoint;
      ctx.fillRect(0, 0, width, height);
    };

    /* ── Draw 3D glowing sphere at galaxy center ── */
    const drawCoreSphere = (tp: ThemeProfile) => {
      const r = galaxyRadius * SPHERE_RADIUS_RATIO;

      // 1. Outer aura glow (soft bloom around sphere)
      ctx.globalAlpha = tp.sphereAuraAlpha;
      const aura = ctx.createRadialGradient(
        centerX, centerY, r * 0.8,
        centerX, centerY, r * 3.5
      );
      aura.addColorStop(0, tp.sphereAura);
      aura.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(centerX, centerY, r * 3.5, 0, Math.PI * 2);
      ctx.fill();

      // 2. Base sphere (3D shading: dark bottom-right to bright top-left)
      ctx.globalAlpha = 1;
      const sphereGrad = ctx.createRadialGradient(
        centerX - r * 0.3, centerY - r * 0.3, r * 0.05,
        centerX, centerY, r
      );
      sphereGrad.addColorStop(0, tp.sphereBright);
      sphereGrad.addColorStop(0.5, tp.sphereMid);
      sphereGrad.addColorStop(1, tp.sphereBase);

      ctx.fillStyle = sphereGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.fill();

      // 3. Specular highlight (small bright spot on upper-left)
      const hlX = centerX - r * 0.3;
      const hlY = centerY - r * 0.35;
      const hlR = r * 0.4;
      const specular = ctx.createRadialGradient(
        hlX, hlY, 0,
        hlX, hlY, hlR
      );
      specular.addColorStop(0, tp.sphereHighlight);
      specular.addColorStop(0.6, "rgba(150,210,255,0.2)");
      specular.addColorStop(1, "rgba(100,180,255,0)");

      ctx.fillStyle = specular;
      ctx.beginPath();
      ctx.arc(hlX, hlY, hlR, 0, Math.PI * 2);
      ctx.fill();

      // 4. Rim light (subtle bright edge on bottom for backlight effect)
      ctx.globalAlpha = 0.25;
      const rimGrad = ctx.createRadialGradient(
        centerX, centerY + r * 0.6, r * 0.2,
        centerX, centerY, r * 1.05
      );
      rimGrad.addColorStop(0, "rgba(100,200,255,0.6)");
      rimGrad.addColorStop(1, "rgba(0,80,200,0)");

      ctx.fillStyle = rimGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, r * 1.05, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
    };

    /* ── Animation loop ── */
    const animate = (timestamp: number) => {
      if (destroyed) return;

      if (timestamp - lastTime < FRAME_INTERVAL) {
        animFrame = requestAnimationFrame(animate);
        return;
      }
      lastTime = timestamp;

      const tp = getThemeProfile();

      ctx.clearRect(0, 0, width, height);

      rotationAngle = (rotationAngle + ROTATION_SPEED) % (Math.PI * 2);

      // Draw core glow first (behind stars)
      drawCoreGlow(tp);

      // Draw all stars — each orbits along its own horizontal ellipse
      for (const star of stars) {
        let sx: number, sy: number;

        if (star.layer === StarLayer.Background) {
          // Background stars: fixed position, no orbit
          sx = centerX + star.scatterX * galaxyRadius;
          sy = centerY + star.scatterY * galaxyRadius;

          if (sx < -5 || sx > width + 5 || sy < -5 || sy > height + 5) continue;

          const bgL = tp.bgLightness(star.lightness);
          ctx.globalAlpha = Math.min(1, star.baseAlpha * tp.alphaBoost);
          ctx.fillStyle = `hsl(0, 0%, ${bgL}%)`;
          ctx.beginPath();
          ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        // Orbital position: angle advances with time
        const orbitalAngle = star.angle + rotationAngle;

        // Elliptical orbit: X = full radius, Y = TILT * radius (horizontal ellipse)
        sx = centerX + (Math.cos(orbitalAngle) * star.dist + star.scatterX) * galaxyRadius;
        sy = centerY + (Math.sin(orbitalAngle) * star.dist * TILT + star.scatterY) * galaxyRadius;

        if (sx < -5 || sx > width + 5 || sy < -5 || sy > height + 5) continue;

        // Depth fade: stars at the "back" of the ellipse (sin > 0) are slightly dimmer
        const depthFade = star.layer === StarLayer.Core
          ? 1.0
          : 0.7 + 0.3 * (0.5 + 0.5 * Math.cos(orbitalAngle));
        const alpha = Math.min(1, star.baseAlpha * depthFade * tp.alphaBoost);

        if (alpha < 0.02) continue;

        ctx.globalAlpha = alpha;

        const drawL = tp.lightnessClamp(star.lightness);

        if (star.layer === StarLayer.Core && star.dist < 0.06) {
          ctx.shadowBlur = 6;
          ctx.shadowColor = `hsla(${star.hue}, ${star.saturation}%, ${drawL}%, 0.5)`;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = `hsl(${star.hue}, ${star.saturation}%, ${drawL}%)`;
        ctx.beginPath();
        ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // Draw 3D sphere at center (on top of stars, behind rings)
      drawCoreSphere(tp);

      // Draw ring highlight over core (horizontal ellipses)
      drawRings(tp);

      animFrame = requestAnimationFrame(animate);
    };

    /* ── Elliptical ring glow — horizontal ellipses ── */
    const drawRings = (tp: ThemeProfile) => {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.globalAlpha = tp.ringAlpha;
      ctx.strokeStyle = tp.ringColor;
      ctx.lineWidth = 1.5;

      const ringRadii = [0.22, 0.35];
      for (const rr of ringRadii) {
        const rx = galaxyRadius * rr;
        const ry = rx * TILT;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    };

    /* ── Bootstrap ── */
    resize();
    animFrame = requestAnimationFrame(animate);

    /* ── Visibility handling ── */
    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animFrame);
      } else {
        lastTime = 0;
        cancelAnimationFrame(animFrame);
        animFrame = requestAnimationFrame(animate);
      }
    };

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      destroyed = true;
      cancelAnimationFrame(animFrame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}

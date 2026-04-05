"use client";

import { useEffect, useRef } from "react";

/* ─── Constants ────────────────────────────────────────────────────── */
const FRAME_INTERVAL = 33; // ~30 fps
const ROTATION_SPEED = 0.0008;
const CENTER_X_RATIO = 0.55;
const CENTER_Y_RATIO = 0.48;

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
  /** Polar angle in galaxy plane (radians) */
  angle: number;
  /** Distance from center (0..1 normalized to galaxy radius) */
  dist: number;
  /** Pre-computed Cartesian offset from spiral formula */
  ox: number;
  oy: number;
  /** Rendering */
  size: number;
  layer: StarLayer;
  /** Color hue (degrees) */
  hue: number;
  saturation: number;
  lightness: number;
  baseAlpha: number;
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
    const dist = Math.abs(randomGaussian()) * 0.12;
    const angle = Math.random() * Math.PI * 2;
    const r = Math.min(dist, 0.25);

    // Core is bright white-blue
    const lum = 70 + Math.random() * 30;
    stars.push({
      angle,
      dist: r,
      ox: Math.cos(angle) * r,
      oy: Math.sin(angle) * r * TILT,
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

    // Logarithmic spiral: r increases, angle wraps
    const t = Math.random(); // 0..1 along the arm
    const dist = 0.05 + t * 0.85;

    // Spiral winding
    const spiralAngle = armOffset + t * Math.PI * 3.2;

    // Spread perpendicular to arm
    const spread = randomGaussian() * ARM_SPREAD * (0.3 + t * 0.7);
    const angle = spiralAngle + spread;

    const ox = Math.cos(angle) * dist;
    const oy = Math.sin(angle) * dist * TILT;

    // Color gradient: inner=bright cyan/blue -> outer=deeper blue with some variety
    const colorVariation = Math.random();
    let hue: number, sat: number, light: number;

    if (colorVariation < 0.7) {
      // Blue-cyan range
      hue = 195 + Math.random() * 30;
      sat = 70 + Math.random() * 30;
      light = 55 + (1 - t) * 30;
    } else if (colorVariation < 0.88) {
      // White-ish
      hue = 210;
      sat = 10 + Math.random() * 30;
      light = 80 + Math.random() * 20;
    } else if (colorVariation < 0.95) {
      // Warm orange/yellow sparks at outer edges
      hue = 20 + Math.random() * 30;
      sat = 80 + Math.random() * 20;
      light = 55 + Math.random() * 25;
    } else {
      // Rare red/pink
      hue = 350 + Math.random() * 20;
      sat = 70 + Math.random() * 30;
      light = 50 + Math.random() * 20;
    }

    const alpha = (1 - t * 0.6) * (0.3 + Math.random() * 0.5);

    stars.push({
      angle,
      dist,
      ox,
      oy,
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
    const ox = Math.cos(angle) * dist + (Math.random() - 0.5) * 0.15;
    const oy = Math.sin(angle) * dist * TILT + (Math.random() - 0.5) * 0.08;

    const colorRoll = Math.random();
    let hue: number;
    if (colorRoll < 0.5) hue = 200 + Math.random() * 20;
    else if (colorRoll < 0.75) hue = 30 + Math.random() * 20;
    else if (colorRoll < 0.9) hue = 0 + Math.random() * 15;
    else hue = 260 + Math.random() * 30;

    stars.push({
      angle,
      dist,
      ox,
      oy,
      size: Math.random() * 0.8 + 0.2,
      layer: StarLayer.Scatter,
      hue,
      saturation: 50 + Math.random() * 50,
      lightness: 50 + Math.random() * 30,
      baseAlpha: 0.15 + Math.random() * 0.35,
    });
  }

  // ── Background distant stars (static, no rotation) ──
  for (let i = 0; i < BG_STARS; i++) {
    const ox = (Math.random() - 0.5) * 2.5;
    const oy = (Math.random() - 0.5) * 2.5;

    stars.push({
      angle: 0,
      dist: 2,
      ox,
      oy,
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
      galaxyRadius = Math.min(width, height) * 0.65;
      centerX = width * CENTER_X_RATIO;
      centerY = height * CENTER_Y_RATIO;
    };

    /* ── Draw core glow (radial gradient) ── */
    const drawCoreGlow = () => {
      const coreR = galaxyRadius * 0.18;

      // Outer halo
      const outerGlow = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, coreR * 2.5
      );
      outerGlow.addColorStop(0, "rgba(0, 160, 255, 0.15)");
      outerGlow.addColorStop(0.3, "rgba(0, 120, 255, 0.06)");
      outerGlow.addColorStop(1, "rgba(0, 60, 255, 0)");

      ctx.fillStyle = outerGlow;
      ctx.fillRect(0, 0, width, height);

      // Inner bright core
      const innerGlow = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, coreR
      );
      innerGlow.addColorStop(0, "rgba(120, 200, 255, 0.45)");
      innerGlow.addColorStop(0.2, "rgba(40, 140, 255, 0.3)");
      innerGlow.addColorStop(0.5, "rgba(20, 80, 255, 0.12)");
      innerGlow.addColorStop(1, "rgba(0, 40, 180, 0)");

      ctx.fillStyle = innerGlow;
      ctx.fillRect(0, 0, width, height);

      // Bright center point
      const corePoint = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, coreR * 0.3
      );
      corePoint.addColorStop(0, "rgba(200, 230, 255, 0.7)");
      corePoint.addColorStop(0.5, "rgba(100, 180, 255, 0.3)");
      corePoint.addColorStop(1, "rgba(30, 100, 255, 0)");

      ctx.fillStyle = corePoint;
      ctx.fillRect(0, 0, width, height);
    };

    /* ── Animation loop ── */
    const animate = (timestamp: number) => {
      if (destroyed) return;

      if (timestamp - lastTime < FRAME_INTERVAL) {
        animFrame = requestAnimationFrame(animate);
        return;
      }
      lastTime = timestamp;

      ctx.clearRect(0, 0, width, height);

      rotationAngle = (rotationAngle + ROTATION_SPEED) % (Math.PI * 2);
      const cosR = Math.cos(rotationAngle);
      const sinR = Math.sin(rotationAngle);

      // Draw core glow first (behind stars)
      drawCoreGlow();

      // Draw all stars
      for (const star of stars) {
        let sx: number, sy: number;

        if (star.layer === StarLayer.Background) {
          // Background stars: fixed position, mapped to screen
          sx = centerX + star.ox * galaxyRadius;
          sy = centerY + star.oy * galaxyRadius;

          // Skip if outside canvas
          if (sx < -5 || sx > width + 5 || sy < -5 || sy > height + 5) continue;

          ctx.globalAlpha = star.baseAlpha;
          ctx.fillStyle = `hsl(0, 0%, ${star.lightness}%)`;
          ctx.beginPath();
          ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        // Galaxy stars: rotate with galaxy
        const rx = star.ox * cosR - star.oy * sinR;
        const ry = star.ox * sinR + star.oy * cosR;

        sx = centerX + rx * galaxyRadius;
        sy = centerY + ry * galaxyRadius;

        // Skip if outside canvas
        if (sx < -5 || sx > width + 5 || sy < -5 || sy > height + 5) continue;

        // Alpha falloff for depth (back side of galaxy is dimmer)
        const depthFade = star.layer === StarLayer.Core ? 1.0 : (0.7 + 0.3 * (1 + ry / star.dist) * 0.5);
        const alpha = Math.min(1, star.baseAlpha * depthFade);

        if (alpha < 0.02) continue;

        ctx.globalAlpha = alpha;

        if (star.layer === StarLayer.Core && star.dist < 0.06) {
          // Brightest core stars get a glow
          ctx.shadowBlur = 6;
          ctx.shadowColor = `hsla(${star.hue}, ${star.saturation}%, ${star.lightness}%, 0.5)`;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = `hsl(${star.hue}, ${star.saturation}%, ${star.lightness}%)`;
        ctx.beginPath();
        ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Reset shadow
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // Draw ring highlight over core (thin elliptical ring)
      drawRings(cosR, sinR);

      animFrame = requestAnimationFrame(animate);
    };

    /* ── Elliptical ring glow around core ── */
    const drawRings = (cosR: number, sinR: number) => {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = "rgba(80, 180, 255, 0.4)";
      ctx.lineWidth = 1.5;

      // Draw 2 subtle rings
      const ringRadii = [0.22, 0.35];
      for (const rr of ringRadii) {
        const rx = galaxyRadius * rr;
        const ry = rx * TILT;
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2; a += 0.05) {
          const px = Math.cos(a) * rx;
          const py = Math.sin(a) * ry;
          // Apply rotation
          const rpx = px * cosR - py * sinR;
          const rpy = px * sinR + py * cosR;
          if (a === 0) ctx.moveTo(rpx, rpy);
          else ctx.lineTo(rpx, rpy);
        }
        ctx.closePath();
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

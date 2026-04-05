"use client";

import { useEffect, useRef } from "react";

/**
 * Animated galaxy background — a glowing central sphere with
 * orbiting rings and scattered star particles.
 *
 * Performance optimizations:
 * - Throttled to ~30fps via FRAME_INTERVAL
 * - Pauses when tab is hidden
 * - Uses pre-calculated orbital paths (sin/cos cached per frame)
 * - Single canvas, no DOM thrashing
 * - Clean cleanup on unmount
 */

// ─── Tuning constants ──────────────────────────────────────────
const FRAME_INTERVAL = 33; // ~30fps
const STAR_COUNT = 220; // background stars
const RING_PARTICLE_COUNT = 180; // particles along orbital rings
const RING_COUNT = 4; // number of orbital ellipses
const ROTATION_SPEED = 0.0003; // radians per frame — slow majestic spin

// ─── Types ─────────────────────────────────────────────────────
interface Star {
  x: number; // normalized 0..1
  y: number;
  size: number;
  brightness: number;
  twinkleSpeed: number;
  twinkleOffset: number;
  /** 0 = white/blue, 1 = warm accent (orange/gold) */
  warm: boolean;
}

interface RingParticle {
  /** Angle on the ellipse (radians) */
  angle: number;
  /** Which ring (index) this particle belongs to */
  ring: number;
  size: number;
  brightness: number;
  /** Speed multiplier — slight variation keeps it organic */
  speedMul: number;
}

interface Ring {
  /** Semi-major axis as fraction of galaxy radius */
  a: number;
  /** Semi-minor axis (controls tilt perspective) */
  b: number;
  /** Rotation offset of this ring (radians) */
  tilt: number;
  /** Base opacity */
  opacity: number;
}

// ─── Ring definitions ──────────────────────────────────────────
const RINGS: Ring[] = [
  { a: 1.0, b: 0.28, tilt: 0, opacity: 0.6 },
  { a: 1.35, b: 0.38, tilt: 0.12, opacity: 0.45 },
  { a: 1.7, b: 0.48, tilt: -0.08, opacity: 0.3 },
  { a: 2.1, b: 0.58, tilt: 0.18, opacity: 0.18 },
];

// ─── Helpers ───────────────────────────────────────────────────
function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function createStars(): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random(),
      y: Math.random(),
      size: rand(0.4, 2.0),
      brightness: rand(0.3, 1.0),
      twinkleSpeed: rand(0.002, 0.008),
      twinkleOffset: rand(0, Math.PI * 2),
      warm: Math.random() < 0.12, // ~12% warm-colored stars
    });
  }
  return stars;
}

function createRingParticles(): RingParticle[] {
  const particles: RingParticle[] = [];
  for (let i = 0; i < RING_PARTICLE_COUNT; i++) {
    particles.push({
      angle: rand(0, Math.PI * 2),
      ring: Math.floor(rand(0, RING_COUNT)),
      size: rand(0.6, 2.2),
      brightness: rand(0.4, 1.0),
      speedMul: rand(0.7, 1.3),
    });
  }
  return particles;
}

// ─── Component ─────────────────────────────────────────────────
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
    let globalAngle = 0;

    let width = 0;
    let height = 0;

    const stars = createStars();
    const ringParticles = createRingParticles();

    // ── Resize handler ───────────────────────────────────────
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      width = rect.width;
      height = rect.height;
    };

    // ── Draw the central glowing sphere ──────────────────────
    const drawCore = (cx: number, cy: number, r: number) => {
      // Outer glow (large soft radial)
      const outerGlow = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 2.8);
      outerGlow.addColorStop(0, "hsla(210, 100%, 70%, 0.25)");
      outerGlow.addColorStop(0.3, "hsla(210, 100%, 60%, 0.08)");
      outerGlow.addColorStop(1, "hsla(210, 100%, 60%, 0)");
      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 2.8, 0, Math.PI * 2);
      ctx.fill();

      // Mid glow
      const midGlow = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r * 1.5);
      midGlow.addColorStop(0, "hsla(200, 100%, 80%, 0.5)");
      midGlow.addColorStop(0.5, "hsla(213, 94%, 60%, 0.15)");
      midGlow.addColorStop(1, "hsla(213, 94%, 60%, 0)");
      ctx.fillStyle = midGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Sphere body
      const sphere = ctx.createRadialGradient(
        cx - r * 0.25,
        cy - r * 0.25,
        r * 0.05,
        cx,
        cy,
        r
      );
      sphere.addColorStop(0, "hsla(195, 100%, 85%, 1)");
      sphere.addColorStop(0.3, "hsla(210, 100%, 65%, 0.95)");
      sphere.addColorStop(0.7, "hsla(220, 90%, 45%, 0.9)");
      sphere.addColorStop(1, "hsla(230, 80%, 25%, 0.85)");
      ctx.fillStyle = sphere;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    };

    // ── Draw orbital ring line ───────────────────────────────
    const drawRingLine = (
      cx: number,
      cy: number,
      baseR: number,
      ring: Ring,
      angle: number
    ) => {
      const a = baseR * ring.a;
      const b = baseR * ring.b;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ring.tilt + angle);

      ctx.strokeStyle = `hsla(210, 80%, 65%, ${ring.opacity * 0.35})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, a, b, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    };

    // ── Draw a single ring particle ──────────────────────────
    const drawRingParticle = (
      cx: number,
      cy: number,
      baseR: number,
      p: RingParticle,
      angle: number,
      time: number
    ) => {
      const ring = RINGS[p.ring];
      const a = baseR * ring.a;
      const b = baseR * ring.b;
      const theta = p.angle + angle * p.speedMul;

      // Position on ellipse
      const ex = Math.cos(theta) * a;
      const ey = Math.sin(theta) * b;

      // Rotate by ring tilt + global rotation
      const cosT = Math.cos(ring.tilt + angle);
      const sinT = Math.sin(ring.tilt + angle);
      const px = cx + ex * cosT - ey * sinT;
      const py = cy + ex * sinT + ey * cosT;

      // Twinkle
      const twinkle = 0.5 + 0.5 * Math.sin(time * 0.004 + p.angle * 3);
      const alpha = p.brightness * twinkle * 0.9;

      // Depth effect: particles at "back" of orbit are dimmer
      const depthFade = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(theta));

      ctx.fillStyle = `hsla(210, 90%, 75%, ${alpha * depthFade})`;
      ctx.beginPath();
      ctx.arc(px, py, p.size * (0.6 + 0.4 * depthFade), 0, Math.PI * 2);
      ctx.fill();
    };

    // ── Draw background stars ────────────────────────────────
    const drawStars = (time: number) => {
      for (const s of stars) {
        const twinkle =
          0.5 + 0.5 * Math.sin(time * s.twinkleSpeed + s.twinkleOffset);
        const alpha = s.brightness * twinkle;

        if (s.warm) {
          ctx.fillStyle = `hsla(30, 90%, 65%, ${alpha * 0.8})`;
        } else {
          ctx.fillStyle = `hsla(215, 60%, 80%, ${alpha * 0.7})`;
        }
        ctx.beginPath();
        ctx.arc(s.x * width, s.y * height, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    // ── Main animation loop ──────────────────────────────────
    const animate = (timestamp: number) => {
      if (destroyed) return;

      if (timestamp - lastTime < FRAME_INTERVAL) {
        animFrame = requestAnimationFrame(animate);
        return;
      }
      lastTime = timestamp;

      globalAngle += ROTATION_SPEED;

      ctx.clearRect(0, 0, width, height);

      // Galaxy center position
      const cx = width * 0.5;
      const cy = height * 0.48;
      const baseR = Math.min(width, height) * 0.085;

      // 1. Background stars
      drawStars(timestamp);

      // 2. Ring particles that are "behind" the sphere (back half)
      for (const p of ringParticles) {
        const ring = RINGS[p.ring];
        const theta = p.angle + globalAngle * p.speedMul;
        const depthVal = Math.sin(theta);
        // Draw back-half particles first (depthVal < 0)
        if (depthVal < 0) {
          drawRingParticle(cx, cy, baseR, p, globalAngle, timestamp);
        }
      }

      // 3. Ring lines (behind sphere)
      for (const ring of RINGS) {
        drawRingLine(cx, cy, baseR, ring, globalAngle);
      }

      // 4. Central sphere
      drawCore(cx, cy, baseR);

      // 5. Ring particles in front of sphere (front half)
      for (const p of ringParticles) {
        const theta = p.angle + globalAngle * p.speedMul;
        const depthVal = Math.sin(theta);
        if (depthVal >= 0) {
          drawRingParticle(cx, cy, baseR, p, globalAngle, timestamp);
        }
      }

      animFrame = requestAnimationFrame(animate);
    };

    // ── Bootstrap ────────────────────────────────────────────
    resize();
    animFrame = requestAnimationFrame(animate);

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

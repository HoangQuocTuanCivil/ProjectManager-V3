"use client";

import { useEffect, useRef } from "react";

/**
 * Animated particle network background — floating nodes that form
 * connection lines when near each other. Optimized for performance:
 * - Throttled to 30fps to reduce CPU load
 * - Avoids forcing reflows (getBoundingClientRect) during animation loop
 * - Clean boundary collision logic
 * - Pauses when tab is hidden, resumes when visible
 * - Stable animation loop that never re-initializes on parent re-renders
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
}

const CONNECTION_DISTANCE = 250;
const BASE_SPEED = 1.5;
const PARTICLE_DENSITY = 15000;
const FRAME_INTERVAL = 33;

export function ParticleNetwork({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /**
   * Single useEffect with empty deps [] ensures the animation loop
   * starts once on mount and never re-initializes during parent re-renders
   * (e.g., when user types in the login form). This prevents the
   * "particles flash then disappear" issue.
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let destroyed = false;
    let animFrame = 0;
    let lastTime = 0;
    let particles: Particle[] = [];
    let width = 0;
    let height = 0;

    /** Detects dark mode for adjusting particle contrast against background */
    const getTheme = () => {
      const isDark = document.documentElement.classList.contains("dark");
      return {
        particle: isDark ? 1.8 : 1.4,
        line: isDark ? 2.5 : 2.0,
        color: isDark ? "210, 100%, 70%" : "215, 80%, 45%",
      };
    };

    /** Creates particles distributed randomly with randomized size and velocity */
    const initParticles = (w: number, h: number) => {
      const count = Math.floor((w * h) / PARTICLE_DENSITY);
      const arr: Particle[] = [];
      for (let i = 0; i < count; i++) {
        arr.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * BASE_SPEED * 2,
          vy: (Math.random() - 0.5) * BASE_SPEED * 2,
          radius: Math.random() * 3 + 1.5,
          opacity: Math.random() * 0.4 + 0.3,
        });
      }
      return arr;
    };

    /** Matches canvas resolution to display size, re-creates particles on resize */
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      width = rect.width;
      height = rect.height;
      particles = initParticles(width, height);
    };

    /** Main render loop — moves particles, draws connections and dots */
    const animate = (timestamp: number) => {
      if (destroyed) return;

      if (timestamp - lastTime < FRAME_INTERVAL) {
        animFrame = requestAnimationFrame(animate);
        return;
      }
      lastTime = timestamp;

      const theme = getTheme();

      ctx.clearRect(0, 0, width, height);

      // Move particles, bounce off edges
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // Clean collision logic to prevent boundary traps
        if (p.x <= 0) {
          p.x = 0;
          p.vx = Math.abs(p.vx);
        } else if (p.x >= width) {
          p.x = width;
          p.vx = -Math.abs(p.vx);
        }

        if (p.y <= 0) {
          p.y = 0;
          p.vy = Math.abs(p.vy);
        } else if (p.y >= height) {
          p.y = height;
          p.vy = -Math.abs(p.vy);
        }
      }

      // Draw connection lines using standard loop (fast enough & no array GC overhead)
      const connDist2 = CONNECTION_DISTANCE * CONNECTION_DISTANCE;
      ctx.lineWidth = 0.8;

      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < connDist2) {
            const dist = Math.sqrt(distSq);
            const opacity = (1 - dist / CONNECTION_DISTANCE) * 0.2 * theme.line;
            ctx.strokeStyle = `hsla(${theme.color}, ${opacity})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Draw particle dots
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${theme.color}, ${p.opacity * theme.particle})`;
        ctx.fill();
      }

      animFrame = requestAnimationFrame(animate);
    };

    resize();
    animFrame = requestAnimationFrame(animate);

    /** Pauses rendering when tab is hidden, resumes when visible */
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
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}

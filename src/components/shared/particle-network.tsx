"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Animated particle network background — creates floating nodes that
 * drift and form connection lines when near each other.
 * Uses HTML Canvas for GPU-accelerated rendering at ~60fps.
 * Automatically adapts particle count to screen size, detects
 * light/dark theme for visibility, and pauses when tab is hidden.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
}

/** Maximum pixel distance at which two particles form a connection line */
const CONNECTION_DISTANCE = 250;

/** Particle movement speed in pixels per frame */
const BASE_SPEED = 1.5;

/** One particle is created per this many square pixels of canvas area */
const PARTICLE_DENSITY = 12000;

export function ParticleNetwork({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);

  /**
   * Detects the current theme (light/dark) by checking the document root class.
   * Returns opacity multipliers so particles and lines are more visible on dark backgrounds.
   */
  const getThemeOpacity = useCallback(() => {
    const isDark = document.documentElement.classList.contains("dark");
    return {
      /** Base multiplier for particle dot opacity */
      particle: isDark ? 1.8 : 1.0,
      /** Base multiplier for connection line opacity */
      line: isDark ? 2.5 : 1.0,
      /** The HSL color string used for all drawing */
      color: isDark ? "210, 100%, 70%" : "217, 91%, 60%",
    };
  }, []);

  /** Creates particles distributed randomly across the canvas with randomized size and speed */
  const initParticles = useCallback((width: number, height: number) => {
    const count = Math.floor((width * height) / PARTICLE_DENSITY);
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * BASE_SPEED * 2,
        vy: (Math.random() - 0.5) * BASE_SPEED * 2,
        radius: Math.random() * 3 + 1.5,
        opacity: Math.random() * 0.4 + 0.3,
      });
    }
    return particles;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    /** Matches canvas pixel buffer to display size, accounting for HiDPI screens */
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      particlesRef.current = initParticles(rect.width, rect.height);
    };

    /** Main render loop — moves particles, draws connections, renders dots */
    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const theme = getThemeOpacity();

      ctx.clearRect(0, 0, w, h);
      const particles = particlesRef.current;

      // Move each particle and reverse direction when hitting canvas edges
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      // Draw semi-transparent lines between particles within CONNECTION_DISTANCE
      ctx.lineWidth = 0.8;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distSq = dx * dx + dy * dy;
          if (distSq < CONNECTION_DISTANCE * CONNECTION_DISTANCE) {
            const dist = Math.sqrt(distSq);
            const lineOpacity = (1 - dist / CONNECTION_DISTANCE) * 0.2 * theme.line;
            ctx.strokeStyle = `hsla(${theme.color}, ${lineOpacity})`;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw each particle as a filled circle with per-particle opacity
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${theme.color}, ${p.opacity * theme.particle})`;
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    resize();
    animFrameRef.current = requestAnimationFrame(animate);

    // Pause rendering when browser tab is not visible to save CPU/battery
    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animFrameRef.current);
      } else {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [initParticles, getThemeOpacity]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}

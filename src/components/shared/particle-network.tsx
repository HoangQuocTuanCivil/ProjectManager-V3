"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Animated particle network background — creates floating nodes that
 * drift slowly and form connection lines when near each other.
 * Uses HTML Canvas for GPU-accelerated rendering at ~30fps.
 * Automatically adapts particle count to screen size and pauses
 * when the tab is not visible to save resources.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
}

const CONNECTION_DISTANCE = 150;
const BASE_SPEED = 0.3;
const PARTICLE_DENSITY = 8000; // 1 particle per N square pixels

export function ParticleNetwork({
  color = "var(--primary)",
  className,
}: {
  color?: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  /** Resolves a CSS variable or color string to an RGB triplet for canvas rendering */
  const resolveColor = useCallback((canvas: HTMLCanvasElement): string => {
    if (color.startsWith("var(")) {
      const varName = color.replace("var(", "").replace(")", "");
      const hsl = getComputedStyle(canvas).getPropertyValue(varName).trim();
      if (hsl) return `hsl(${hsl})`;
    }
    return color;
  }, [color]);

  /** Creates particles distributed randomly across the canvas area */
  const initParticles = useCallback((width: number, height: number) => {
    const count = Math.floor((width * height) / PARTICLE_DENSITY);
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * BASE_SPEED,
        vy: (Math.random() - 0.5) * BASE_SPEED,
        radius: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.5 + 0.2,
      });
    }
    return particles;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    /** Matches canvas resolution to its display size (handles HiDPI) */
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      particlesRef.current = initParticles(rect.width, rect.height);
    };

    /** Animation loop — updates positions and draws particles + connections at ~30fps */
    const animate = (timestamp: number) => {
      // Throttle to ~30fps to reduce CPU usage
      if (timestamp - lastTimeRef.current < 33) {
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      lastTimeRef.current = timestamp;

      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const resolvedColor = resolveColor(canvas);

      ctx.clearRect(0, 0, w, h);
      const particles = particlesRef.current;

      // Update positions — bounce off edges
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      // Draw connection lines between nearby particles
      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DISTANCE) {
            const lineOpacity = (1 - dist / CONNECTION_DISTANCE) * 0.15;
            ctx.strokeStyle = resolvedColor.replace(")", ` / ${lineOpacity})`).replace("hsl(", "hsl(");
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw particles as small glowing dots
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = resolvedColor.replace(")", ` / ${p.opacity})`).replace("hsl(", "hsl(");
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    resize();
    animFrameRef.current = requestAnimationFrame(animate);

    // Pause animation when tab is not visible
    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animFrameRef.current);
      } else {
        lastTimeRef.current = 0;
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
  }, [initParticles, resolveColor]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}

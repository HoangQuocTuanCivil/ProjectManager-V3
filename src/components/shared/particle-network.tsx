"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Animated particle network background — floating nodes that form
 * connection lines when near each other. Optimized for performance:
 * - Throttled to 30fps to reduce CPU load
 * - Spatial grid partitioning avoids O(n²) distance checks
 * - Pauses when tab is hidden or component unmounts
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
const FRAME_INTERVAL = 33; // ~30fps throttle

export function ParticleNetwork({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  /** Detects dark mode and returns appropriate opacity and color for rendering */
  const getThemeOpacity = useCallback(() => {
    const isDark = document.documentElement.classList.contains("dark");
    return {
      particle: isDark ? 1.8 : 1.0,
      line: isDark ? 2.5 : 1.0,
      color: isDark ? "210, 100%, 70%" : "217, 91%, 60%",
    };
  }, []);

  /** Creates particles with randomized position, velocity, and size */
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

    let destroyed = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particlesRef.current = initParticles(rect.width, rect.height);
    };

    /**
     * Builds a spatial grid that partitions particles into cells.
     * Only particles in the same or neighboring cells need distance checks,
     * reducing connection lookup from O(n²) to roughly O(n).
     */
    const buildGrid = (particles: Particle[], w: number, h: number) => {
      const cellSize = CONNECTION_DISTANCE;
      const cols = Math.ceil(w / cellSize);
      const rows = Math.ceil(h / cellSize);
      const grid: number[][] = new Array(cols * rows);
      for (let i = 0; i < grid.length; i++) grid[i] = [];

      for (let i = 0; i < particles.length; i++) {
        const col = Math.min(Math.floor(particles[i].x / cellSize), cols - 1);
        const row = Math.min(Math.floor(particles[i].y / cellSize), rows - 1);
        grid[row * cols + col].push(i);
      }
      return { grid, cols, rows };
    };

    const animate = (timestamp: number) => {
      if (destroyed) return;

      // Throttle to ~30fps
      if (timestamp - lastTimeRef.current < FRAME_INTERVAL) {
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      lastTimeRef.current = timestamp;

      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const theme = getThemeOpacity();
      const particles = particlesRef.current;

      ctx.clearRect(0, 0, w, h);

      // Move particles and bounce off edges
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      // Use spatial grid to efficiently find nearby particles for connections
      const { grid, cols, rows } = buildGrid(particles, w, h);
      const connDist2 = CONNECTION_DISTANCE * CONNECTION_DISTANCE;

      ctx.lineWidth = 0.8;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const cell = grid[row * cols + col];
          // Check connections within this cell and with 3 forward neighbors (right, below, below-right)
          // to avoid duplicate pair checks
          const neighborOffsets = [
            [0, 0], [1, 0], [0, 1], [1, 1],
          ];
          for (const [dc, dr] of neighborOffsets) {
            const nc = col + dc;
            const nr = row + dr;
            if (nc >= cols || nr >= rows) continue;
            const neighbor = grid[nr * cols + nc];
            const isSame = dc === 0 && dr === 0;

            for (let ii = 0; ii < cell.length; ii++) {
              const startJ = isSame ? ii + 1 : 0;
              for (let jj = startJ; jj < neighbor.length; jj++) {
                const a = particles[cell[ii]];
                const b = particles[neighbor[jj]];
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

      animFrameRef.current = requestAnimationFrame(animate);
    };

    resize();
    animFrameRef.current = requestAnimationFrame(animate);

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
      destroyed = true;
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

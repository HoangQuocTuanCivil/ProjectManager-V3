"use client";

import { useEffect, useRef } from "react";

/**
 * Animated particle network background — floating nodes that form
 * connection lines when near each other. Optimized for performance:
 * - Throttled to 30fps to reduce CPU load
 * - Spatial grid partitioning avoids O(n²) distance checks
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

    /** Detects dark mode for adjusting particle brightness */
    const getTheme = () => {
      const isDark = document.documentElement.classList.contains("dark");
      return {
        particle: isDark ? 1.8 : 1.0,
        line: isDark ? 2.5 : 1.0,
        color: isDark ? "210, 100%, 70%" : "217, 91%, 60%",
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
      particles = initParticles(rect.width, rect.height);
    };

    /** Partitions particles into a spatial grid for efficient neighbor lookups */
    const buildGrid = (w: number, h: number) => {
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

    /** Main render loop — moves particles, draws connections and dots */
    const animate = (timestamp: number) => {
      if (destroyed) return;

      if (timestamp - lastTime < FRAME_INTERVAL) {
        animFrame = requestAnimationFrame(animate);
        return;
      }
      lastTime = timestamp;

      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const theme = getTheme();

      ctx.clearRect(0, 0, w, h);

      // Move particles, bounce off edges
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      // Draw connection lines using spatial grid neighbor lookup
      const { grid, cols, rows } = buildGrid(w, h);
      const connDist2 = CONNECTION_DISTANCE * CONNECTION_DISTANCE;

      ctx.lineWidth = 0.8;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const cell = grid[row * cols + col];
          const neighborOffsets = [[0, 0], [1, 0], [0, 1], [1, 1]];
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

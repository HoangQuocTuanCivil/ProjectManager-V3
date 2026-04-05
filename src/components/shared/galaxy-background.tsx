"use client";

import { useEffect, useRef } from "react";

const FRAME_INTERVAL = 33;
const STAR_COUNT = 10000;
const BRANCHES = 3;
const SPIN = 1;
const RANDOMNESS = 0.2;
const RANDOMNESS_POWER = 3;
const BASE_SIZE = 0.8;
const ROTATION_SPEED = 0.002;
const CORE_RATIO = 0.2;

interface GalaxyStar {
  x: number;
  y: number;
  size: number;
  distance: number;
  colorMix: number;
}

function lerpColor(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
  t: number
): [number, number, number] {
  return [
    r1 + (r2 - r1) * t,
    g1 + (g2 - g1) * t,
    b1 + (b2 - b1) * t,
  ];
}

function generateStars(radius: number): GalaxyStar[] {
  const stars: GalaxyStar[] = [];

  for (let i = 0; i < STAR_COUNT; i++) {
    const r = Math.random() * radius;
    const spinAngle = r * SPIN;
    const branchAngle = ((i % BRANCHES) / BRANCHES) * Math.PI * 2;

    const scatter = () =>
      Math.pow(Math.random(), RANDOMNESS_POWER) *
      (Math.random() < 0.5 ? 1 : -1) *
      RANDOMNESS *
      r;

    stars.push({
      x: Math.cos(branchAngle + spinAngle) * r + scatter(),
      y: Math.sin(branchAngle + spinAngle) * r + scatter(),
      size: Math.random() * BASE_SIZE,
      distance: r,
      colorMix: r / radius,
    });
  }

  return stars;
}

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
    let angle = 0;
    let width = 0;
    let height = 0;
    let stars: GalaxyStar[] = [];
    let galaxyRadius = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      width = rect.width;
      height = rect.height;
      galaxyRadius = Math.max(width, height) * 0.55;
      stars = generateStars(galaxyRadius);
    };

    const animate = (timestamp: number) => {
      if (destroyed) return;

      if (timestamp - lastTime < FRAME_INTERVAL) {
        animFrame = requestAnimationFrame(animate);
        return;
      }
      lastTime = timestamp;

      ctx.clearRect(0, 0, width, height);

      ctx.save();
      ctx.translate(width / 2, height / 2);

      angle = (angle + ROTATION_SPEED) % (Math.PI * 2);
      ctx.rotate(angle);

      for (const star of stars) {
        const t = star.colorMix;
        const isCore = star.distance < galaxyRadius * CORE_RATIO;

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);

        if (isCore) {
          const coreAlpha = 0.7 + 0.3 * (1 - star.distance / (galaxyRadius * CORE_RATIO));
          ctx.fillStyle = `rgba(255, 255, 255, ${coreAlpha})`;
          ctx.shadowBlur = 8;
          ctx.shadowColor = "rgba(0, 255, 255, 0.6)";
        } else {
          const alpha = Math.max(0.05, 1 - t);
          const [r, g, b] = lerpColor(0, 255, 255, 30, 0, 255, t);
          ctx.fillStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha})`;
          ctx.shadowBlur = 0;
        }

        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.restore();

      animFrame = requestAnimationFrame(animate);
    };

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

"use client";

import React, { useId } from "react";

export interface LoadingSpinnerProps {
  /**
   * Optional custom width/height override (e.g. 200, "240px", "60vh").
   * Defaults to responsive mobile: 160px / desktop: 250px (or mobile: min(50vh, 300px) / desktop: min(68vh, 500px) for fullscreen).
   */
  size?: number | string;
  /**
   * Optional status message rendered below the spinner.
   */
  text?: string;
  /**
   * When true, takes over the full viewport with brand cream (#F6E9C8) background.
   */
  fullScreen?: boolean;
  /**
   * Optional custom classes.
   */
  className?: string;
}

const COUNT = 16;
const SPEED = 12; // 12s total duration base

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size,
  text,
  fullScreen = false,
  className = "",
}) => {
  const uid = useId().replace(/:/g, "");
  const scopeClass = `gyro-scope-${uid}`;

  // Default sizes: significantly bigger on desktop
  const mobileSize = fullScreen ? "min(50vh, 300px)" : "160px";
  const desktopSize = fullScreen ? "min(68vh, 500px)" : "250px";

  const resolvedMobileSize = size ? (typeof size === "number" ? `${size}px` : size) : mobileSize;
  const resolvedDesktopSize = size
    ? typeof size === "number"
      ? `${Math.round(size * 1.35)}px`
      : size
    : desktopSize;

  const step = 100 / COUNT; // 6.25% per step

  return (
    <div
      className={`flex flex-col items-center justify-center bg-[#F6E9C8] ${scopeClass} ${
        fullScreen ? "fixed inset-0 w-screen h-screen z-[9999] overflow-hidden" : ""
      } ${className}`}
      role="status"
      aria-label={text || "Loading"}
    >
      <style>{`
        .${scopeClass} {
          --gyro-size: ${resolvedMobileSize};
          --gyro-border: 2px;
        }
        @media (min-width: 768px) {
          .${scopeClass} {
            --gyro-size: ${resolvedDesktopSize};
            --gyro-border: 3.5px;
          }
        }
        @keyframes gyroSpin {
          0% {
            transform: rotateX(0deg);
          }
          100% {
            transform: rotateX(360deg);
          }
        }
      `}</style>

      {/* 3D Preserved Perspective Container */}
      <div
        style={{
          position: "relative",
          display: "block",
          width: "var(--gyro-size)",
          height: "var(--gyro-size)",
          transformStyle: "preserve-3d",
          WebkitTransformStyle: "preserve-3d",
          transform: "perspective(1000px) rotateY(45deg) rotateX(45deg)",
          WebkitTransform: "perspective(1000px) rotateY(45deg) rotateX(45deg)",
          pointerEvents: "none",
        }}
      >
        {Array.from({ length: COUNT }).map((_, idx) => {
          const n = idx + 1; // 1 to 16
          const localSize = 100 - step * n;
          const offset = (step * n) / 2;
          const duration = SPEED / n;
          const isEven = n % 2 === 0;
          const isLast = n === COUNT;

          return (
            <div
              key={idx}
              data-index={idx}
              style={{
                position: "absolute",
                background: "transparent",
                borderStyle: isEven ? "dashed" : "solid",
                borderWidth: "var(--gyro-border)",
                borderColor: isEven ? "rgba(104, 1, 20, 0.55)" : "#680114",
                borderRadius: "50%",
                boxSizing: "border-box",
                left: `${offset}%`,
                top: `${offset}%`,
                width: `${localSize}%`,
                height: `${localSize}%`,
                animation: `gyroSpin ${duration}s infinite linear`,
                WebkitAnimation: `gyroSpin ${duration}s infinite linear`,
                display: isLast ? "none" : "block",
                willChange: "transform",
              }}
            />
          );
        })}
      </div>

      {text && (
        <p className="mt-6 md:mt-10 text-xs md:text-sm font-serif font-bold text-[#680114] tracking-wide animate-pulse text-center px-4">
          {text}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;

"use client";

import React, { useId } from "react";

export interface LoadingSpinnerProps {
  /**
   * Optional custom scale factor or sizing override.
   */
  size?: number | string;
  /**
   * Custom scale factor directly applied to the loader animation (default 2.30).
   */
  scale?: number;
  /**
   * Circle diameter in px (default 21).
   */
  circleSize?: number;
  /**
   * Distance between balls in px (default 31).
   */
  spread?: number;
  /**
   * Animation rotation and translation speed in seconds (default 1.90).
   */
  speed?: number;
  /**
   * Dots animation cycle duration in seconds (default 2.30).
   */
  dotsSpeed?: number;
  /**
   * Font size in rem or px for the title text (default "24px").
   */
  fontSize?: string;
  /**
   * Text rendered below the spinner.
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

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size,
  scale: propScale,
  circleSize = 21,
  spread = 31,
  speed = 1.9,
  dotsSpeed = 2.3,
  fontSize = "24px",
  text,
  fullScreen = false,
  className = "",
}) => {
  const uid = useId().replace(/:/g, "");
  const scopeClass = `custom-loader-${uid}`;

  // Default to user's exact chosen scale of 2.30x
  let effectiveScale = 2.3;
  if (propScale !== undefined) {
    effectiveScale = propScale;
  } else if (size !== undefined) {
    effectiveScale = typeof size === "number" ? (size > 10 ? size / 50 : size) : 2.3;
  }

  // The 4-circle bounding box width is circleSize + spread, height is 2 * circleSize + 10px margin
  const boxWidth = circleSize + spread;
  const boxHeight = circleSize * 2 + 10;
  const ballHalfSpread = spread / 2;

  return (
    <div
      className={`flex flex-col items-center justify-center bg-[#F6E9C8] w-full h-full ${scopeClass} ${
        fullScreen ? "fixed inset-0 w-screen h-screen z-[9999] overflow-hidden" : ""
      } ${className}`}
      role="status"
      aria-label={text || "Loading"}
    >
      <style>{`
        .${scopeClass} .loader-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: ${boxWidth * effectiveScale}px;
          height: ${boxHeight * effectiveScale}px;
        }

        .${scopeClass} .loader {
          position: relative;
          height: ${boxHeight}px;
          width: ${boxWidth}px;
          transform: scale(${effectiveScale});
          transform-origin: center center;
          animation: ${scopeClass}-rotate ${speed}s infinite;
        }

        .${scopeClass} .loader:before,
        .${scopeClass} .loader:after {
          border-radius: 50%;
          content: '';
          display: block;
          height: ${circleSize}px;
          width: ${circleSize}px;
        }

        .${scopeClass} .loader:before {
          animation: ${scopeClass}-ball1 ${speed}s infinite;
          background-color: #680114;
          box-shadow: ${spread}px 0 0 #680114;
          margin-bottom: 10px;
        }

        .${scopeClass} .loader:after {
          animation: ${scopeClass}-ball2 ${speed}s infinite;
          background-color: #680114;
          box-shadow: ${spread}px 0 0 #680114;
        }

        @keyframes ${scopeClass}-rotate {
          0% {
            transform: scale(${effectiveScale}) rotate(0deg) scale(0.8);
            -webkit-transform: scale(${effectiveScale}) rotate(0deg) scale(0.8);
          }
          50% {
            transform: scale(${effectiveScale}) rotate(360deg) scale(1.2);
            -webkit-transform: scale(${effectiveScale}) rotate(360deg) scale(1.2);
          }
          100% {
            transform: scale(${effectiveScale}) rotate(720deg) scale(0.8);
            -webkit-transform: scale(${effectiveScale}) rotate(720deg) scale(0.8);
          }
        }

        @keyframes ${scopeClass}-ball1 {
          0% {
            box-shadow: ${spread}px 0 0 #680114;
          }
          50% {
            box-shadow: 0 0 0 #680114;
            margin-bottom: 0;
            transform: translate(${ballHalfSpread}px, ${ballHalfSpread}px);
            -webkit-transform: translate(${ballHalfSpread}px, ${ballHalfSpread}px);
          }
          100% {
            box-shadow: ${spread}px 0 0 #680114;
            margin-bottom: 10px;
          }
        }

        @keyframes ${scopeClass}-ball2 {
          0% {
            box-shadow: ${spread}px 0 0 #680114;
          }
          50% {
            box-shadow: 0 0 0 #680114;
            margin-top: -${circleSize}px;
            transform: translate(${ballHalfSpread}px, ${ballHalfSpread}px);
            -webkit-transform: translate(${ballHalfSpread}px, ${ballHalfSpread}px);
          }
          100% {
            box-shadow: ${spread}px 0 0 #680114;
            margin-top: 0;
          }
        }

        .${scopeClass} .dots-anim {
          position: absolute;
          left: 100%;
          bottom: 0;
          white-space: nowrap;
        }

        .${scopeClass} .dots-anim::after {
          content: '';
          display: inline-block;
          animation: ${scopeClass}-dots ${dotsSpeed}s infinite steps(4, jump-none);
        }

        @keyframes ${scopeClass}-dots {
          0% { content: ''; }
          25% { content: '.'; }
          50% { content: '..'; }
          75% { content: '...'; }
          100% { content: '....'; }
        }
      `}</style>

      {/* Centered Bounding Wrapper for the Scaled Rotating Animation */}
      <div className="loader-wrapper">
        <div className="loader" />
      </div>

      {/* True-Centered Title Text with absolute dots overlay so text never shifts off-center */}
      <div className="mt-8 px-4 flex justify-center w-full">
        <div
          className="relative inline-block font-serif font-black tracking-tight text-[#680114] select-none text-center leading-none"
          style={fontSize ? { fontSize } : undefined}
        >
          <span>{text ? text.replace(/\.{2,}$/, "") : "Loading"}</span>
          <span className="dots-anim" />
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner;

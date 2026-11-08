"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";

interface PriceRangeSliderProps {
  stockMin: number;
  stockMax: number;
  minValue: number | null;
  maxValue: number | null;
  onChangeMin: (val: number | null) => void;
  onChangeMax: (val: number | null) => void;
  currencyPrefix?: string;
  step?: number;
  className?: string;
}

export const PriceRangeSlider: React.FC<PriceRangeSliderProps> = ({
  stockMin,
  stockMax,
  minValue,
  maxValue,
  onChangeMin,
  onChangeMax,
  currencyPrefix = "₹",
  step = 10,
  className = "",
}) => {
  const trackRef = useRef<HTMLDivElement>(null);

  // Local immediate state for butter-smooth 60fps drag response
  const [localMin, setLocalMin] = useState<number>(() =>
    minValue !== null ? minValue : stockMin
  );
  const [localMax, setLocalMax] = useState<number>(() =>
    maxValue !== null ? maxValue : stockMax
  );
  const isDraggingRef = useRef<"min" | "max" | null>(null);

  // Sync external changes when not actively dragging
  useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalMin(minValue !== null ? minValue : stockMin);
    }
  }, [minValue, stockMin]);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalMax(maxValue !== null ? maxValue : stockMax);
    }
  }, [maxValue, stockMax]);

  const rangeSpan = Math.max(1, stockMax - stockMin);
  const minPercent = Math.max(0, Math.min(100, ((localMin - stockMin) / rangeSpan) * 100));
  const maxPercent = Math.max(0, Math.min(100, ((localMax - stockMin) / rangeSpan) * 100));

  // High performance pointer tracking
  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const dragging = isDraggingRef.current;
      if (!dragging || !trackRef.current) return;

      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const rawVal = stockMin + ratio * rangeSpan;
      const stepped = Math.round(rawVal / step) * step;
      const clamped = Math.max(stockMin, Math.min(stockMax, stepped));

      if (dragging === "min") {
        setLocalMax((currentMax) => {
          const nextMin = Math.min(clamped, currentMax);
          setLocalMin(nextMin);
          onChangeMin(nextMin <= stockMin ? null : nextMin);
          return currentMax;
        });
      } else if (dragging === "max") {
        setLocalMin((currentMin) => {
          const nextMax = Math.max(clamped, currentMin);
          setLocalMax(nextMax);
          onChangeMax(nextMax >= stockMax ? null : nextMax);
          return currentMin;
        });
      }
    },
    [stockMin, stockMax, rangeSpan, step, onChangeMin, onChangeMax]
  );

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }, [handlePointerMove]);

  const startDrag = (thumb: "min" | "max") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = thumb;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  // Keyboard navigation
  const handleKeyDown = (thumb: "min" | "max") => (e: React.KeyboardEvent) => {
    let delta = 0;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") delta = -step;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") delta = step;
    else if (e.key === "PageDown") delta = -step * 5;
    else if (e.key === "PageUp") delta = step * 5;

    if (delta !== 0) {
      e.preventDefault();
      if (thumb === "min") {
        const next = Math.max(stockMin, Math.min(localMax, localMin + delta));
        setLocalMin(next);
        onChangeMin(next <= stockMin ? null : next);
      } else {
        const next = Math.min(stockMax, Math.max(localMin, localMax + delta));
        setLocalMax(next);
        onChangeMax(next >= stockMax ? null : next);
      }
    }
  };

  // Click on track to snap closest thumb
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const clickVal = stockMin + ratio * rangeSpan;
    const stepped = Math.round(clickVal / step) * step;
    const clamped = Math.max(stockMin, Math.min(stockMax, stepped));

    const distToMin = Math.abs(clamped - localMin);
    const distToMax = Math.abs(clamped - localMax);

    if (distToMin <= distToMax) {
      const next = Math.min(clamped, localMax);
      setLocalMin(next);
      onChangeMin(next <= stockMin ? null : next);
    } else {
      const next = Math.max(clamped, localMin);
      setLocalMax(next);
      onChangeMax(next >= stockMax ? null : next);
    }
  };

  return (
    <div className={`flex w-full flex-col gap-3 select-none ${className}`}>
      {/* 1. Track & Thumbs (shadcn Slider Primitive Pattern) */}
      <div className="relative flex w-full touch-none select-none items-center py-2.5">
        {/* Track Line */}
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          className="relative h-2 w-full grow overflow-hidden rounded-full bg-[#E5D7B7] cursor-pointer"
        >
          {/* Highlight Range Fill: Zero CSS transition lag for instant 60fps tracking */}
          <div
            className="absolute h-full bg-[#680114] rounded-full will-change-[left,width]"
            style={{
              left: `${Math.min(minPercent, maxPercent)}%`,
              width: `${Math.abs(maxPercent - minPercent)}%`,
            }}
          />
        </div>

        {/* Min Thumb */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Minimum price"
          aria-valuemin={stockMin}
          aria-valuemax={localMax}
          aria-valuenow={localMin}
          onPointerDown={startDrag("min")}
          onKeyDown={handleKeyDown("min")}
          style={{ left: `${minPercent}%` }}
          className="absolute block h-5 w-5 -translate-x-1/2 rounded-full border-2 border-[#680114] bg-[#F6E9C8] shadow-md transition-transform hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#680114] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F6E9C8] cursor-grab active:cursor-grabbing z-10 will-change-[left]"
        />

        {/* Max Thumb */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Maximum price"
          aria-valuemin={localMin}
          aria-valuemax={stockMax}
          aria-valuenow={localMax}
          onPointerDown={startDrag("max")}
          onKeyDown={handleKeyDown("max")}
          style={{ left: `${maxPercent}%` }}
          className="absolute block h-5 w-5 -translate-x-1/2 rounded-full border-2 border-[#680114] bg-[#F6E9C8] shadow-md transition-transform hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#680114] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F6E9C8] cursor-grab active:cursor-grabbing z-10 will-change-[left]"
        />
      </div>

      {/* 2. Dynamic Readouts with tabular-nums */}
      <div className="flex items-center justify-between text-xs font-serif font-bold text-[#680114] tabular-nums">
        <span>
          {currencyPrefix}
          {localMin.toLocaleString("en-IN")}
        </span>
        <span className="text-[10px] text-[#680114]/60 font-sans font-normal uppercase tracking-wider">
          Stock {currencyPrefix}{stockMin} – {currencyPrefix}{stockMax}
        </span>
        <span>
          {currencyPrefix}
          {localMax.toLocaleString("en-IN")}
        </span>
      </div>

      {/* 3. Min & Max Input Fields */}
      <div className="grid grid-cols-2 gap-2.5 items-center pt-1">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-serif font-bold uppercase tracking-wider text-[#680114]/80">
            Min Price
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-2.5 text-xs font-bold text-[#680114]/70">
              {currencyPrefix}
            </span>
            <input
              type="text"
              inputMode="numeric"
              placeholder={String(stockMin)}
              value={minValue !== null ? minValue : ""}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw === "") {
                  onChangeMin(null);
                  setLocalMin(stockMin);
                  return;
                }
                const parsed = parseInt(raw.replace(/\D/g, ""), 10);
                if (!isNaN(parsed)) {
                  onChangeMin(parsed);
                  setLocalMin(parsed);
                }
              }}
              className="w-full h-8.5 pl-6 pr-2 bg-[#EFE0BC] border border-[#DFCBA0] focus:border-[#680114] rounded-lg text-xs font-bold text-[#680114] tabular-nums placeholder:text-[#680114]/40 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-serif font-bold uppercase tracking-wider text-[#680114]/80">
            Max Price
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-2.5 text-xs font-bold text-[#680114]/70">
              {currencyPrefix}
            </span>
            <input
              type="text"
              inputMode="numeric"
              placeholder={String(stockMax)}
              value={maxValue !== null ? maxValue : ""}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw === "") {
                  onChangeMax(null);
                  setLocalMax(stockMax);
                  return;
                }
                const parsed = parseInt(raw.replace(/\D/g, ""), 10);
                if (!isNaN(parsed)) {
                  onChangeMax(parsed);
                  setLocalMax(parsed);
                }
              }}
              className="w-full h-8.5 pl-6 pr-2 bg-[#EFE0BC] border border-[#DFCBA0] focus:border-[#680114] rounded-lg text-xs font-bold text-[#680114] tabular-nums placeholder:text-[#680114]/40 focus:outline-none transition-colors"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

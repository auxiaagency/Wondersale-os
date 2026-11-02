import React from "react";

export interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export const QuantityStepper: React.FC<QuantityStepperProps> = ({
  value,
  min = 1,
  max = 99,
  onChange,
  disabled = false,
}) => {
  const handleDecrement = () => {
    if (value > min && !disabled) {
      onChange(value - 1);
    }
  };

  const handleIncrement = () => {
    if (value < max && !disabled) {
      onChange(value + 1);
    }
  };

  return (
    <div className="inline-flex items-center bg-white border border-slate-300 rounded-lg shadow-2xs p-0.5 select-none">
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={handleDecrement}
        className="w-8 h-8 rounded-md bg-slate-100 hover:bg-red-50 hover:text-[#D91E2A] text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="w-9 text-center text-xs font-bold text-[#680114]">{value}</span>
      <button
        type="button"
        disabled={disabled || value >= max}
        onClick={handleIncrement}
        className="w-8 h-8 rounded-md bg-[#D91E2A] text-white hover:bg-[#B31520] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
};

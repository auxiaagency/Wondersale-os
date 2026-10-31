import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = "", id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700 mb-1">
            {label}
          </label>
        )}
        <div className="relative rounded-lg shadow-2xs">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full h-11 bg-white border rounded-lg text-xs text-slate-900 transition-all focus:outline-none focus:ring-1 ${
              icon ? "pl-9" : "pl-3"
            } pr-3 ${
              error
                ? "border-[#D91E2A] bg-red-50/30 focus:border-[#D91E2A] focus:ring-[#D91E2A]"
                : "border-slate-300 focus:border-[#D91E2A] focus:ring-[#D91E2A]"
            } ${className}`}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1 text-[11px] text-[#D91E2A] font-medium flex items-center space-x-1">
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

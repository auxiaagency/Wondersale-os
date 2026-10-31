import React from "react";

export interface MobileNumberInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange"
> {
  value: string;
  onChange: (val: string) => void;
  error?: string;
  label?: string;
}

export const MobileNumberInput: React.FC<MobileNumberInputProps> = ({
  value,
  onChange,
  error,
  label = "Mobile Number",
  ...props
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
    onChange(raw);
  };

  return (
    <div className="w-full">
      {label && <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>}
      <div
        className={`flex h-11 rounded-lg border bg-white overflow-hidden transition-all focus-within:ring-1 ${
          error
            ? "border-[#D91E2A] focus-within:border-[#D91E2A] focus-within:ring-[#D91E2A]"
            : "border-slate-300 focus-within:border-[#D91E2A] focus-within:ring-[#D91E2A]"
        }`}
      >
        <div className="bg-slate-50 px-3 flex items-center border-r border-slate-200 space-x-1.5 text-xs font-semibold text-slate-700 select-none">
          <span className="text-sm">🇮🇳</span>
          <span>+91</span>
        </div>
        <input
          type="tel"
          inputMode="numeric"
          placeholder="98765 43210"
          value={value}
          onChange={handleChange}
          maxLength={10}
          className="flex-1 px-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-[11px] text-[#D91E2A] font-medium">{error}</p>}
    </div>
  );
};

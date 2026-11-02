import React, { useRef } from "react";

export interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (otp: string) => void;
  error?: string;
}

export const OtpInput: React.FC<OtpInputProps> = ({ length = 6, value, onChange, error }) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = value.split("").slice(0, length);
  while (digits.length < length) {
    digits.push("");
  }

  const handleChange = (index: number, val: string) => {
    const digit = val.slice(-1).replace(/\D/g, "");
    const newDigits = [...digits];
    newDigits[index] = digit;
    const combined = newDigits.join("");
    onChange(combined);

    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="w-full">
      <div className="flex gap-2 justify-between">
        {digits.map((digit, idx) => (
          <input
            key={idx}
            ref={(el) => {
              inputRefs.current[idx] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            className={`w-11 h-12 text-center font-bold text-base rounded-lg border transition-all focus:outline-none focus:ring-1 ${
              error
                ? "border-[#D91E2A] bg-red-50/40 text-[#680114] focus:ring-[#D91E2A]"
                : digit
                  ? "border-[#D91E2A] bg-red-50/20 text-[#680114] focus:ring-[#D91E2A]"
                  : "border-slate-300 bg-white text-[#680114] focus:border-[#D91E2A] focus:ring-[#D91E2A]"
            }`}
          />
        ))}
      </div>
      {error && (
        <p className="mt-1.5 text-[11px] text-[#D91E2A] font-medium text-center">{error}</p>
      )}
    </div>
  );
};

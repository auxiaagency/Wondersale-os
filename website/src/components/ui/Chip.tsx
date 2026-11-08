import React from "react";

export interface ChipProps {
  label: string;
  selected?: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
  className?: string;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onToggle,
  onRemove,
  className = "",
}) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`h-8 px-3 rounded-full text-xs font-semibold inline-flex items-center space-x-1 transition-all select-none cursor-pointer ${
        selected
          ? "bg-[#D91E2A] text-white shadow-2xs hover:bg-[#B31520]"
          : "bg-slate-100 hover:bg-slate-200 text-[#680114]"
      } ${className}`}
    >
      <span>{label}</span>
      {selected && onRemove && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 text-xs opacity-80 hover:opacity-100"
        >
          ✕
        </span>
      )}
    </button>
  );
};

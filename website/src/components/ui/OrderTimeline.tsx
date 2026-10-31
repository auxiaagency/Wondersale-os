import React from "react";

export interface OrderTimelineProps {
  currentStep: "ordered" | "packed" | "shipped" | "delivered";
}

const steps = [
  { key: "ordered", label: "Ordered" },
  { key: "packed", label: "Packed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
] as const;

export const OrderTimeline: React.FC<OrderTimelineProps> = ({ currentStep }) => {
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center justify-between relative px-2 w-full py-2">
      {steps.map((step, idx) => {
        const isDone = idx < currentIndex;
        const isCurrent = idx === currentIndex;

        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center z-10">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isDone
                    ? "bg-[#1E9E5A] text-white"
                    : isCurrent
                      ? "bg-[#D91E2A] text-white ring-4 ring-red-100"
                      : "bg-slate-200 text-slate-400"
                }`}
              >
                {isDone ? "✓" : idx + 1}
              </div>
              <span
                className={`text-[10px] mt-1 font-semibold ${
                  isCurrent ? "text-[#D91E2A]" : isDone ? "text-slate-700" : "text-slate-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 -mt-4 ${
                  idx < currentIndex
                    ? "bg-[#1E9E5A]"
                    : idx === currentIndex
                      ? "bg-[#D91E2A]"
                      : "bg-slate-200"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

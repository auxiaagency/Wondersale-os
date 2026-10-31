import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      className = "",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#D91E2A] disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer";

    const variantStyles = {
      primary: "bg-[#D91E2A] text-white hover:bg-[#B31520] active:bg-[#8E0E17] shadow-sm",
      outline:
        "bg-white border-2 border-[#D91E2A] text-[#D91E2A] hover:bg-[#FDECEE] active:bg-[#FEECEC]",
      ghost: "bg-transparent text-slate-700 hover:bg-slate-100 hover:text-[#D91E2A]",
      danger: "bg-red-700 text-white hover:bg-red-800",
    };

    const sizeStyles = {
      sm: "h-9 px-3 text-xs min-w-[36px]",
      md: "h-11 px-4 text-xs min-h-[44px]", // Min 44px touch target
      lg: "h-12 px-6 text-sm min-h-[48px]",
      icon: "w-11 h-11 p-2 min-h-[44px] min-w-[44px]",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <span className="inline-flex items-center space-x-2">
            <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>Loading...</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

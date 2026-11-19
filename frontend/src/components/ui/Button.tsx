import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "success";
  size?: "md" | "lg";
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-base whitespace-nowrap cursor-pointer";

  const variants = {
    primary: "bg-teal-700 text-white hover:bg-teal-800 focus:ring-teal-600",
    secondary: "bg-white text-stone-900 border-2 border-stone-300 hover:bg-stone-100 focus:ring-stone-500",
    danger: "bg-red-700 text-white hover:bg-red-800 focus:ring-red-600",
    success: "bg-emerald-700 text-white hover:bg-emerald-800 focus:ring-emerald-600",
  };

  const sizes = {
    md: "px-4 py-2.5",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button
      disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
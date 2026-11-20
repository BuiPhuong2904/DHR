import React from "react";

interface BadgeProps {
  variant?: "success" | "warning" | "danger" | "info" | "neutral";
  children: React.ReactNode;
}

export function Badge({ variant = "neutral", children }: BadgeProps) {
  const styles = {
    success: "bg-emerald-100 text-emerald-900 border-emerald-400",
    warning: "bg-amber-100 text-amber-950 border-amber-400",
    danger: "bg-red-100 text-red-900 border-red-500 font-bold",
    info: "bg-blue-100 text-blue-900 border-blue-400",
    neutral: "bg-stone-200 text-stone-900 border-stone-400",
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-base font-semibold border whitespace-nowrap shrink-0 ${styles[variant]}`}
    >
      {children}
    </span>
  );
}
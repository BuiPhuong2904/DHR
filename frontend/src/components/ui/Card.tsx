import React from "react";

interface CardProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Card({ title, subtitle, action, children, className = "" }: CardProps) {
  return (
    <section className={`bg-white border-2 border-stone-200 rounded-xl shadow-sm p-6 ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 mb-5 border-b border-stone-200">
          <div>
            {title && <h2 className="text-xl font-bold text-stone-950">{title}</h2>}
            {subtitle && <p className="text-base text-stone-700 mt-1">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
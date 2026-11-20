import React from "react";

interface TableProps {
  headers: string[];
  children: React.ReactNode;
}

export function Table({ headers, children }: TableProps) {
  return (
    <div className="overflow-x-auto border-2 border-stone-200 rounded-lg">
      <table className="w-full text-left border-collapse text-base">
        <thead className="bg-stone-100 border-b-2 border-stone-300 text-stone-950">
          <tr>
            {headers.map((h, idx) => (
              <th key={idx} className="py-3.5 px-4 font-bold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-200 text-stone-900 bg-white">
          {children}
        </tbody>
      </table>
    </div>
  );
}
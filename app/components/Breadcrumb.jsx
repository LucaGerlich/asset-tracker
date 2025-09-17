"use client";
import React from "react";
import Link from "next/link";

const Breadcrumb = ({ options }) => {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex items-center gap-2">
        {options.map((opt, i) => (
          <li key={opt.href || opt.label} className="flex items-center gap-2">
            {i > 0 && <span>/</span>}
            {opt.href ? (
              <Link href={opt.href} className="hover:underline">
                {opt.label}
              </Link>
            ) : (
              <span>{opt.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumb;

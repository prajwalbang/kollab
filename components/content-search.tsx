"use client";
import { useEffect, useId, useState } from "react";
export function useSearchQuery(value: string) {
  const [query, setQuery] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(value), 200);
    return () => clearTimeout(timer);
  }, [value]);
  return query;
}
export function ContentSearch({
  value,
  onChange,
  label,
  placeholder,
  count,
  suggestions = [],
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  count?: number;
  suggestions?: string[];
}) {
  const id = useId();
  return (
    <div className="content-search-block">
      <div className="content-search">
        <svg
          width="21"
          height="21"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        <input
          id={id}
          type="search"
          aria-label={label}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onChange("");
          }}
          autoComplete="off"
        />
        {value ? (
          <button
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => onChange("")}
          >
            ×
          </button>
        ) : (
          <span className="search-scope">{label.replace("Search ", "")}</span>
        )}
      </div>
      {value && count !== undefined ? (
        <p className="content-search-meta" role="status">
          {count} {count === 1 ? "result" : "results"} for <b>“{value}”</b>
        </p>
      ) : suggestions.length > 0 ? (
        <div className="search-suggestions">
          <span>Explore</span>
          {suggestions.map((s) => (
            <button key={s} onClick={() => onChange(s)}>
              {s} <span>↗</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

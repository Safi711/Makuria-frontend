"use client";

import { useRef, useState } from "react";
import { isValidIsoDate } from "@/lib/case-mapper/iso-date.mjs";

/**
 * Incident-date text field, yyyy-mm-dd. A date that matches the shape but does
 * not exist (2026-02-30) is blocked here, before submit, with a visible message.
 * The server parser drops such a date silently, so this check must come first.
 */
export function IncidentDateInput({
  defaultValue,
  locale,
  className,
  style,
}: {
  defaultValue: string;
  locale: "ar" | "en";
  className: string;
  style: React.CSSProperties;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const message =
    locale === "ar"
      ? "أدخل تاريخاً حقيقياً بصيغة \u2066yyyy-mm-dd\u2069، مثل \u20662026-03-10\u2069."
      : "Enter a real date in yyyy-mm-dd format, e.g. 2026-03-10.";

  function check(value: string) {
    const v = value.trim();
    const bad = v !== "" && !isValidIsoDate(v);
    ref.current?.setCustomValidity(bad ? message : "");
    setError(bad ? message : null);
  }

  return (
    <>
      <input
        ref={ref}
        type="text"
        name="incident_date"
        defaultValue={defaultValue}
        inputMode="numeric"
        dir="ltr"
        placeholder="yyyy-mm-dd"
        pattern="\d{4}-\d{2}-\d{2}"
        title="yyyy-mm-dd"
        maxLength={10}
        onChange={(e) => check(e.target.value)}
        onBlur={(e) => check(e.target.value)}
        className={className}
        style={style}
        aria-invalid={error ? true : undefined}
      />
      {error ? (
        <span role="alert" className="mt-1 block text-xs" style={{ color: "#f5a3a3" }}>
          {error}
        </span>
      ) : null}
    </>
  );
}

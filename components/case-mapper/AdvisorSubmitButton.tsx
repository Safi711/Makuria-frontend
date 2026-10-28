"use client";

import { useFormStatus } from "react-dom";

/**
 * The analyze button. Since the form became a Server Action (2026-10-27) the
 * route's loading.tsx no longer shows during an analysis, so the button itself
 * says the work is under way and refuses a second click.
 */
export function AdvisorSubmitButton({
  label,
  pendingLabel,
  variant = "primary",
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  const primary = variant === "primary";
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`rounded-xl text-sm font-bold disabled:opacity-70 ${primary ? "px-7 py-3" : "border px-5 py-2.5"}`}
      style={
        primary
          ? { background: "linear-gradient(180deg,#EACC82 0%,#DBB663 100%)", color: "#071226" }
          : { borderColor: "var(--cm-gold)", color: "var(--cm-gold)", background: "transparent" }
      }
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Locale, t } from "@/lib/i18n";

const inputClass =
  "w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1";

export function CaseInputForm({
  locale,
  initial,
}: {
  locale: Locale;
  initial: {
    facts: string;
    caseType: string;
    court: string;
    jurisdiction: string;
    incidentDate: string;
    keywords: string;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [clientError, setClientError] = useState<string | null>(null);
  const [values, setValues] = useState(initial);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!values.facts.trim()) {
      setClientError(t(locale, "cmEmptyFacts"));
      return;
    }
    setClientError(null);
    const params = new URLSearchParams();
    params.set("facts", values.facts.trim());
    if (values.caseType.trim()) params.set("case_type", values.caseType.trim());
    if (values.court.trim()) params.set("court", values.court.trim());
    if (values.jurisdiction.trim()) params.set("jurisdiction", values.jurisdiction.trim());
    if (values.incidentDate.trim()) params.set("incident_date", values.incidentDate.trim());
    if (values.keywords.trim()) params.set("keywords", values.keywords.trim());
    params.set("submitted", "1");
    startTransition(() => {
      router.push(`/case-mapper?${params.toString()}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-busy={isPending}>
      <div>
        <label htmlFor="cm-facts" className="mb-1.5 block text-sm font-medium">
          {t(locale, "cmFactsLabel")}
        </label>
        <textarea
          id="cm-facts"
          name="facts"
          rows={8}
          value={values.facts}
          onChange={(e) => setValues((v) => ({ ...v, facts: e.target.value }))}
          placeholder={t(locale, "cmFactsPlaceholder")}
          className={inputClass}
          style={{ borderColor: "var(--mk-border)" }}
        />
        {clientError && <p className="mt-1.5 text-sm text-red-600">{clientError}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        <div>
          <label htmlFor="cm-case-type" className="mb-1.5 block text-sm font-medium">
            {t(locale, "cmCaseType")}
          </label>
          <input
            id="cm-case-type"
            type="text"
            value={values.caseType}
            onChange={(e) => setValues((v) => ({ ...v, caseType: e.target.value }))}
            className={inputClass}
            style={{ borderColor: "var(--mk-border)" }}
          />
        </div>
        <div>
          <label htmlFor="cm-court" className="mb-1.5 block text-sm font-medium">
            {t(locale, "cmCourt")}
          </label>
          <input
            id="cm-court"
            type="text"
            value={values.court}
            onChange={(e) => setValues((v) => ({ ...v, court: e.target.value }))}
            className={inputClass}
            style={{ borderColor: "var(--mk-border)" }}
          />
        </div>
        <div>
          <label htmlFor="cm-jurisdiction" className="mb-1.5 block text-sm font-medium">
            {t(locale, "cmJurisdiction")}
          </label>
          <input
            id="cm-jurisdiction"
            type="text"
            value={values.jurisdiction}
            onChange={(e) => setValues((v) => ({ ...v, jurisdiction: e.target.value }))}
            className={inputClass}
            style={{ borderColor: "var(--mk-border)" }}
          />
        </div>
        <div>
          <label htmlFor="cm-incident-date" className="mb-1.5 block text-sm font-medium">
            {t(locale, "cmIncidentDate")}
          </label>
          <input
            id="cm-incident-date"
            type="date"
            value={values.incidentDate}
            onChange={(e) => setValues((v) => ({ ...v, incidentDate: e.target.value }))}
            className={inputClass}
            style={{ borderColor: "var(--mk-border)" }}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="cm-keywords" className="mb-1.5 block text-sm font-medium">
            {t(locale, "cmKeywords")}
          </label>
          <input
            id="cm-keywords"
            type="text"
            value={values.keywords}
            onChange={(e) => setValues((v) => ({ ...v, keywords: e.target.value }))}
            className={inputClass}
            style={{ borderColor: "var(--mk-border)" }}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
        style={{ background: "var(--mk-gold)" }}
      >
        {isPending ? t(locale, "cmAnalyzing") : t(locale, "cmAnalyzeButton")}
      </button>
    </form>
  );
}

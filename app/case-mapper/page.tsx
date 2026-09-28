import type { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t, type Locale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { LawStatusBadge } from "@/components/LawStatusBadge";
import { AuthorityBadge } from "@/components/case-mapper/AuthorityBadge";
import { Highlight } from "@/components/case-mapper/Highlight";
import { sourceNameAr } from "@/lib/site";
import { analyzeCase } from "@/lib/case-mapper/analyze";
import type {
  CaseMapResult,
  ForceStatus,
  IssueLens,
  RetrievedAuthority,
  RetrievedCase,
  RetrievedPrinciple,
} from "@/lib/case-mapper/analyze";

/**
 * «المستشار القانوني الذكي» — /case-mapper
 *
 * Laid out to Safi's design sheet (Makuria_Case_Mapper_Smart_Advisor.pdf,
 * 2026-09-28): dark navy ground, gold accents, RTL, a two-card top row
 * (how-it-works beside the facts box) and a three-card results row —
 * provisions, precedents, and «لماذا ظهرت هذه النتيجة؟».
 *
 * Three decisions worth knowing before editing this file:
 *
 * 1. THE DARK THEME IS SCOPED TO THIS PAGE, not to the site. The palette is
 *    declared as CSS variables on the outermost element here, so nothing
 *    outside /case-mapper changes and no global stylesheet had to be touched.
 *    If the whole site goes dark later, lift these five variables into
 *    globals.css and delete the `style` block — nothing else in this file
 *    needs to change.
 *
 * 2. THE RESULT CARDS ARE RENDERED INLINE rather than through the existing
 *    components/case-mapper/* sections. Those components are written for the
 *    light pages (text-neutral-700 on white) and would be close to unreadable
 *    on this ground. They are still used by nothing else, so they are left in
 *    place untouched rather than rewritten twice over. What is NOT dropped in
 *    the move: legal force, the recorded source, the status note, the matched
 *    terms, and the link to the full text — every one of those is a claim a
 *    lawyer checks, and the design sheet keeps room for all of them.
 *
 * 3. THE FORM IS A PLAIN GET FORM. No client component, no JavaScript needed
 *    to run an analysis, and every analysis is a shareable URL. The design
 *    sheet shows only the facts box, so the other engine inputs (case type as
 *    a ranking lens, court, jurisdiction, date, keywords) live in a collapsed
 *    `<details>` — present, one line to remove, and they round-trip from the
 *    URL either way.
 */

export const metadata: Metadata = {
  title: "المستشار القانوني الذكي",
  description:
    "أدخل وقائع الدعوى ليقابلها المستشار بالمواد القانونية والسوابق القضائية في متن مكوريا، مع بيان حالة نفاذ كل نص ومصدره.",
  alternates: { canonical: "/case-mapper" },
};

function paramStr(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

/** Corpus status string that `LawStatusBadge` already labels in both locales.
 * Same mapping as components/case-mapper/RelatedLaws.tsx — one vocabulary for
 * the three states, not two. */
function badgeStatus(force: ForceStatus): string | undefined {
  switch (force) {
    case "in_force":
      return "active";
    case "not_in_force":
      return "repealed";
    case "under_review":
      return "reference";
    default:
      return undefined;
  }
}

function originLabel(locale: Locale, origin: IssueLens["origin"]): string {
  switch (origin) {
    case "keyword":
      return t(locale, "cmIssueOriginKeyword");
    case "expanded":
      return t(locale, "cmIssueOriginExpanded");
    default:
      return t(locale, "cmIssueOriginExtracted");
  }
}

/* ------------------------------------------------------------------ chrome */

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border p-5 sm:p-6 ${className}`}
      style={{ background: "var(--cm-surface)", borderColor: "var(--cm-line)" }}
    >
      {children}
    </section>
  );
}

function CardTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mb-3 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
      style={{
        color: "var(--mk-gold-soft)",
        borderColor: "rgba(201,162,39,0.45)",
        background: "rgba(201,162,39,0.10)",
      }}
    >
      {children}
    </span>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 text-base font-semibold sm:text-lg">{children}</h2>;
}

function Muted({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-sm leading-relaxed ${className}`} style={{ color: "var(--cm-muted)" }}>
      {children}
    </p>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
        style={{ background: "rgba(201,162,39,0.14)", color: "var(--mk-gold-soft)", border: "1px solid rgba(201,162,39,0.45)" }}
      >
        {n}
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-sm" style={{ color: "var(--cm-muted)" }}>
          {body}
        </span>
      </span>
    </li>
  );
}

/** A result row inside a card: same bordered block for laws, cases and
 * principles so the three read as one family. */
function Row({ children }: { children: React.ReactNode }) {
  return (
    <li
      className="rounded-xl border p-4"
      style={{ background: "var(--cm-surface-2)", borderColor: "var(--cm-line)" }}
    >
      {children}
    </li>
  );
}

function MetaLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs leading-relaxed" style={{ color: "var(--cm-faint)" }}>
      {children}
    </p>
  );
}

function FullTextLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mt-2 inline-block text-xs font-medium"
      style={{ color: "var(--mk-gold-soft)" }}
    >
      {label}
    </Link>
  );
}

/* ----------------------------------------------------------------- results */

function LawRow({ locale, law }: { locale: Locale; law: RetrievedAuthority }) {
  const href =
    law.type === "article"
      ? law.lawSlug
        ? `/laws/${law.lawSlug}`
        : null
      : law.slug
        ? `/laws/${law.slug}`
        : null;

  return (
    <Row>
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="text-sm font-semibold leading-relaxed">
          {law.type === "article" ? law.lawTitle : law.title}
          {law.type === "article" && law.articleNumber && (
            <span style={{ color: "var(--cm-muted)" }}>
              {" "}
              — {t(locale, "cmArticleLabel")} {law.articleNumber}
            </span>
          )}
        </p>
        {/* Legal force first. A provision of a repealed law must never read as
            live authority just because the search matched it. */}
        <LawStatusBadge status={badgeStatus(law.force)} locale={locale} />
      </div>

      <p className="mb-2 text-sm leading-relaxed" style={{ color: "var(--cm-text-2)" }}>
        <Highlight html={law.excerptHtml} />
      </p>

      {/* The repeal / status note. Given a real background rather than a bare
          hairline border: on the first render it was all but invisible, and
          «أُلغي بموجب القانون رقم ٣ لسنة ٢٠١٥، المادة ٥٤» is the single most
          important line on the card when it is present. */}
      {law.statusNote && (
        <p
          className="mb-2 rounded-lg border px-2.5 py-1.5 text-xs leading-relaxed"
          style={{
            borderColor: "rgba(201,162,39,0.40)",
            background: "rgba(201,162,39,0.10)",
            color: "var(--cm-text)",
          }}
        >
          {law.statusNote}
        </p>
      )}

      {/* The source, not a «موثّق / غير موثّق» stamp — that stamp was retired
          site-wide on 2026-09-28. Where the text came from is the lawyer's
          question; whether a box was ticked is not. */}
      <MetaLine>
        {t(locale, "sourceLabel")}: {sourceNameAr(law.sourceUrl) ?? t(locale, "noSourceRecorded")}
      </MetaLine>
      <MetaLine>
        {t(locale, "cmMatchedOn")}: {law.matchedTerms.join("، ")}
      </MetaLine>

      {href && (
        <FullTextLink href={href} label={locale === "ar" ? "عرض القانون كاملاً ←" : "View full law →"} />
      )}
    </Row>
  );
}

function CaseRow({ locale, c }: { locale: Locale; c: RetrievedCase }) {
  const meta = [c.courtName, c.year ?? undefined, c.citation ?? c.caseNumber ?? undefined]
    .filter(Boolean)
    .join(" · ");

  return (
    <Row>
      <div className="mb-1 flex items-start justify-between gap-3">
        <p className="text-sm font-semibold leading-relaxed">{c.title}</p>
        <AuthorityBadge level={c.authority} locale={locale} />
      </div>

      {meta && <MetaLine>{meta}</MetaLine>}

      {c.principle && (
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--cm-text-2)" }}>
          <span className="font-semibold">{locale === "ar" ? "المبدأ: " : "Principle: "}</span>
          {c.principle}
        </p>
      )}

      <p className="mt-2 mb-2 text-sm leading-relaxed" style={{ color: "var(--cm-text-2)" }}>
        <span className="text-xs font-medium" style={{ color: "var(--cm-faint)" }}>
          {t(locale, "cmRelevanceReason")}:{" "}
        </span>
        <Highlight html={c.excerptHtml} />
      </p>

      <MetaLine>
        {t(locale, "sourceLabel")}: {sourceNameAr(c.sourceUrl) ?? t(locale, "noSourceRecorded")}
      </MetaLine>
      <MetaLine>
        {t(locale, "cmMatchedOn")}: {c.matchedTerms.join("، ")}
      </MetaLine>

      {c.slug && (
        <FullTextLink
          href={`/cases/${c.slug}`}
          label={locale === "ar" ? "عرض السابقة كاملة ←" : "View full precedent →"}
        />
      )}
    </Row>
  );
}

function PrincipleRow({ locale, p }: { locale: Locale; p: RetrievedPrinciple }) {
  return (
    <Row>
      <p className="text-sm font-semibold leading-relaxed">{p.title}</p>
      {p.category && <MetaLine>{p.category}</MetaLine>}
      {p.summary && (
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--cm-text-2)" }}>
          {p.summary.slice(0, 220)}
        </p>
      )}
      <MetaLine>
        {t(locale, "cmMatchedOn")}: {p.matchedTerms.join("، ")}
      </MetaLine>
      {p.slug && (
        <FullTextLink
          href={`/principles/${p.slug}`}
          label={locale === "ar" ? "عرض المبدأ كاملاً ←" : "View full principle →"}
        />
      )}
    </Row>
  );
}

/** «لماذا ظهرت هذه النتيجة؟» — the method card. Everything here is a fact
 * about the search that was actually run: the terms, where each came from,
 * whether the case type resolved to a corpus category, which chain each term
 * produced, and which terms matched nothing at all. Nothing is inferred. */
function MethodCard({ locale, result }: { locale: Locale; result: CaseMapResult }) {
  return (
    <>
      <MetaLine>{t(locale, "cmMethodTermsLabel")}</MetaLine>
      <ul className="mt-2 mb-4 flex flex-wrap gap-2">
        {result.issues.map((issue) => (
          <li
            key={issue.term}
            className="rounded-full border px-2.5 py-1 text-xs"
            style={{
              borderColor: issue.searchedAndEmpty ? "var(--cm-line)" : "rgba(201,162,39,0.45)",
              color: issue.searchedAndEmpty ? "var(--cm-faint)" : "var(--mk-gold-soft)",
              background: issue.searchedAndEmpty ? "transparent" : "rgba(201,162,39,0.10)",
            }}
            title={originLabel(locale, issue.origin)}
          >
            {issue.term}
          </li>
        ))}
      </ul>

      {/* The case type ranks; it is not searched as a word. Saying so on the
          page is the fix for the bug that put articles 21 and 22 of the
          Criminal Act into every criminal case regardless of its facts. */}
      <p className="mb-1 text-xs" style={{ color: "var(--cm-faint)" }}>
        {t(locale, "cmCaseTypeLens")}
      </p>
      {result.caseTypeLens && (
        <p className="mb-4 text-xs" style={{ color: "var(--cm-text-2)" }}>
          {result.caseTypeLens.categoryNameAr
            ? `${t(locale, "cmCaseTypeLensOn")} ${result.caseTypeLens.categoryNameAr}`
            : t(locale, "cmCaseTypeLensNone")}
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {result.issues.map((issue) => (
          <Row key={`chain-${issue.term}`}>
            <p className="mb-1 text-sm font-semibold">{issue.term}</p>
            <MetaLine>{originLabel(locale, issue.origin)}</MetaLine>

            {issue.searchedAndEmpty ? (
              <p className="mt-2 text-sm" style={{ color: "var(--cm-faint)" }}>
                {t(locale, "cmIssueNothingFound")}
              </p>
            ) : (
              <dl className="mt-2 space-y-1.5 text-sm">
                <div>
                  <dt className="text-xs" style={{ color: "var(--cm-faint)" }}>
                    {t(locale, "cmMapLaw")}
                  </dt>
                  <dd style={{ color: "var(--cm-text-2)" }}>
                    {issue.topLaw
                      ? issue.topLaw.type === "article"
                        ? `${issue.topLaw.lawTitle ?? ""} — ${t(locale, "cmArticleLabel")} ${issue.topLaw.articleNumber ?? ""}`
                        : issue.topLaw.title
                      : t(locale, "cmNoLaws")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs" style={{ color: "var(--cm-faint)" }}>
                    {t(locale, "cmMapCase")}
                  </dt>
                  <dd style={{ color: "var(--cm-text-2)" }}>
                    {issue.topCase ? issue.topCase.title : t(locale, "cmNoCases")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs" style={{ color: "var(--cm-faint)" }}>
                    {t(locale, "cmMapPrinciple")}
                  </dt>
                  <dd style={{ color: "var(--cm-text-2)" }}>
                    {issue.topPrinciple ? issue.topPrinciple.title : t(locale, "cmNoPrinciples")}
                  </dd>
                </div>
              </dl>
            )}
          </Row>
        ))}
      </ul>

      {/* The facts as the engine read them — truncation included, so nobody
          concludes the whole statement was analysed when it was not. */}
      <div className="mt-5">
        <p className="mb-1 text-sm font-semibold">{t(locale, "cmSectionSummary")}</p>
        <MetaLine>{t(locale, "cmSummaryNote")}</MetaLine>
        <div
          className="mt-2 rounded-xl border p-3 text-sm leading-relaxed whitespace-pre-wrap"
          style={{ background: "var(--cm-surface-2)", borderColor: "var(--cm-line)", color: "var(--cm-text-2)" }}
        >
          {result.factsExcerpt}
          {result.factsIsTruncated && (
            <span className="mt-2 block text-xs" style={{ color: "var(--cm-faint)" }}>
              {t(locale, "cmSummaryTruncated")}
            </span>
          )}
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------- page */

export default async function CaseMapperPage(props: PageProps<"/case-mapper">) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();

  const facts = paramStr(searchParams.facts);
  const caseType = paramStr(searchParams.case_type);
  const court = paramStr(searchParams.court);
  const jurisdiction = paramStr(searchParams.jurisdiction);
  const incidentDate = paramStr(searchParams.incident_date);
  const keywords = paramStr(searchParams.keywords);
  const submitted = paramStr(searchParams.submitted) === "1";

  let result: CaseMapResult | null = null;
  let errored = false;

  if (submitted && facts.trim()) {
    try {
      const supabase = await createClient();
      result = await analyzeCase(supabase, {
        facts,
        caseType: caseType || undefined,
        court: court || undefined,
        jurisdiction: jurisdiction || undefined,
        incidentDate: incidentDate || undefined,
        keywords: keywords || undefined,
      });
    } catch {
      errored = true;
    }
  }

  const hasResult = Boolean(result);

  return (
    <div
      className="min-h-full"
      style={
        {
          background: "var(--cm-bg)",
          color: "var(--cm-text)",
          // Scoped palette — see the note at the top of this file.
          "--cm-bg": "#0A1A2F",
          "--cm-surface": "#102843",
          "--cm-surface-2": "#0C2138",
          "--cm-line": "#1F3A5A",
          "--cm-text": "#E9EDF3",
          "--cm-text-2": "#C6D2E0",
          "--cm-muted": "#94A6BC",
          "--cm-faint": "#7A8CA3",
        } as React.CSSProperties
      }
    >
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        {/* ------------------------------------------------------------ hero
            A <div>, not a <header>: a <header> that is not inside a sectioning
            element maps to the `banner` landmark, and the site already has one
            in the layout. Two banners is a screen-reader defect. */}
        <div className="mb-8 sm:mb-10">
          <p
            className="mb-3 text-[11px] font-semibold tracking-[0.18em]"
            style={{ color: "var(--mk-gold)" }}
            dir="ltr"
          >
            {t(locale, "cmEyebrow")}
          </p>
          <h1 className="mb-3 text-2xl font-bold sm:text-3xl">{t(locale, "cmPageTitle")}</h1>
          <p className="max-w-2xl text-sm leading-relaxed sm:text-base" style={{ color: "var(--cm-muted)" }}>
            {t(locale, "cmHeroSub")}
          </p>
        </div>

        {/* --------------------------------------------- facts + how it works */}
        <div className="grid gap-5 lg:grid-cols-5">
          {/* First in the DOM, so in RTL it sits on the right, as in the design. */}
          <Card className="lg:col-span-3">
            <CardTitle>{t(locale, "cmFactsCardTitle")}</CardTitle>
            <Muted className="mb-4">{t(locale, "cmFactsCardSub")}</Muted>

            <form action="/case-mapper" method="get">
              <input type="hidden" name="submitted" value="1" />

              <label htmlFor="facts" className="sr-only">
                {t(locale, "cmFactsLabel")}
              </label>
              <textarea
                id="facts"
                name="facts"
                rows={9}
                defaultValue={facts}
                placeholder={t(locale, "cmFactsPlaceholder2")}
                className="w-full rounded-xl border p-3 text-sm leading-relaxed outline-none focus:border-[var(--mk-gold)]"
                style={{
                  background: "var(--cm-surface-2)",
                  borderColor: "var(--cm-line)",
                  color: "var(--cm-text)",
                }}
              />

              {/* Privacy first, above the button, as in the design sheet. */}
              <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--cm-muted)" }}>
                {t(locale, "cmPrivacyNote")}
              </p>

              {/* The engine's other inputs. The design shows only the facts
                  box, so these are collapsed rather than dropped: the case
                  type is a ranking lens that measurably improves ordering,
                  and nothing here is reachable any other way from the UI.
                  Delete this <details> block to match the sheet exactly. */}
              <details className="mt-4">
                <summary
                  className="cursor-pointer text-xs font-medium"
                  style={{ color: "var(--mk-gold-soft)" }}
                >
                  {locale === "ar" ? "خيارات إضافية (اختيارية)" : "More options (optional)"}
                </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      { name: "case_type", value: caseType, key: "cmCaseType", type: "text" },
                      { name: "court", value: court, key: "cmCourt", type: "text" },
                      { name: "jurisdiction", value: jurisdiction, key: "cmJurisdiction", type: "text" },
                      { name: "incident_date", value: incidentDate, key: "cmIncidentDate", type: "date" },
                      { name: "keywords", value: keywords, key: "cmKeywords", type: "text" },
                    ] as const
                  ).map((f) => (
                    <label key={f.name} className="block text-xs">
                      <span className="mb-1 block" style={{ color: "var(--cm-muted)" }}>
                        {t(locale, f.key)}
                      </span>
                      <input
                        type={f.type}
                        name={f.name}
                        defaultValue={f.value}
                        className="w-full rounded-lg border px-2.5 py-2 text-sm outline-none focus:border-[var(--mk-gold)]"
                        style={{
                          background: "var(--cm-surface-2)",
                          borderColor: "var(--cm-line)",
                          color: "var(--cm-text)",
                        }}
                      />
                    </label>
                  ))}
                </div>
              </details>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="rounded-xl px-5 py-2.5 text-sm font-bold"
                  style={{ background: "var(--mk-gold)", color: "#0A1A2F" }}
                >
                  {t(locale, "cmAnalyzeBtn2")}
                </button>
                <span className="text-xs" style={{ color: "var(--cm-faint)" }}>
                  {t(locale, "cmGuidanceNote")}
                </span>
              </div>
            </form>
          </Card>

          <Card className="lg:col-span-2">
            <CardTitle>{t(locale, "cmHowTitle")}</CardTitle>
            <ol className="mt-4 space-y-4">
              <Step n={1} title={t(locale, "cmStep1Title")} body={t(locale, "cmStep1Body")} />
              <Step n={2} title={t(locale, "cmStep2Title")} body={t(locale, "cmStep2Body")} />
              <Step n={3} title={t(locale, "cmStep3Title")} body={t(locale, "cmStep3Body")} />
            </ol>
            <p
              className="mt-5 border-t pt-4 text-xs leading-relaxed"
              style={{ borderColor: "var(--cm-line)", color: "var(--cm-muted)" }}
            >
              {t(locale, "cmHowFooter")}
            </p>
          </Card>
        </div>

        {/* --------------------------------------------------------- notices */}
        {submitted && !facts.trim() && (
          <p
            className="mt-6 rounded-xl border px-4 py-3 text-sm"
            style={{ borderColor: "#7F2A22", background: "rgba(127,42,34,0.18)", color: "#F3C9C2" }}
          >
            {t(locale, "cmEmptyFacts")}
          </p>
        )}

        {errored && (
          <p
            className="mt-6 rounded-xl border px-4 py-3 text-sm"
            style={{ borderColor: "#7F2A22", background: "rgba(127,42,34,0.18)", color: "#F3C9C2" }}
          >
            {t(locale, "cmErrorState")}
          </p>
        )}

        {result && !result.hasAnyResults && (
          <p
            className="mt-6 rounded-xl border px-4 py-3 text-sm leading-relaxed"
            style={{ borderColor: "var(--cm-line)", background: "var(--cm-surface)", color: "var(--cm-text-2)" }}
          >
            {t(locale, "cmNoResultsAtAll")}
          </p>
        )}

        {/* --------------------------------------------------------- results */}
        <div className="mt-10 sm:mt-14">
          <h2 className="mb-1 text-xl font-bold sm:text-2xl">{t(locale, "cmResultsTitle")}</h2>
          {!hasResult && <Muted className="mb-6">{t(locale, "cmResultsSub")}</Muted>}

          {/* `items-start`: without it the grid stretches every card to the
              height of the tallest, and a case column holding one precedent
              beside a laws column holding six renders as a wall of empty
              navy. Cards size to their own content. */}
          <div
            className={`mt-5 grid items-start gap-5 ${
              hasResult ? "lg:grid-cols-2" : "md:grid-cols-3"
            }`}
          >
            {/* 1 — provisions (and the legal principles that came with them) */}
            <Card>
              <CardTag>{t(locale, "cmTagLaws")}</CardTag>
              <CardTitle>{t(locale, "cmCardLawsTitle")}</CardTitle>
              {!result ? (
                <Muted>{t(locale, "cmCardLawsBody")}</Muted>
              ) : result.laws.length === 0 ? (
                <Muted>{t(locale, "cmNoLaws")}</Muted>
              ) : (
                <ul className="mt-4 space-y-3">
                  {result.laws.map((law) => (
                    <LawRow key={law.id} locale={locale} law={law} />
                  ))}
                </ul>
              )}

              {result && result.principles.length > 0 && (
                <div className="mt-6 border-t pt-4" style={{ borderColor: "var(--cm-line)" }}>
                  <p className="mb-3 text-sm font-semibold">{t(locale, "cmSectionPrinciples")}</p>
                  <ul className="space-y-3">
                    {result.principles.map((p) => (
                      <PrincipleRow key={p.id} locale={locale} p={p} />
                    ))}
                  </ul>
                </div>
              )}
            </Card>

            {/* 2 — precedents */}
            <Card>
              <CardTag>{t(locale, "cmTagCases")}</CardTag>
              <CardTitle>{t(locale, "cmCardCasesTitle")}</CardTitle>
              {!result ? (
                <Muted>{t(locale, "cmCardCasesBody")}</Muted>
              ) : result.cases.length === 0 ? (
                <Muted>{t(locale, "cmNoCases")}</Muted>
              ) : (
                <ul className="mt-4 space-y-3">
                  {result.cases.map((c) => (
                    <CaseRow key={c.id} locale={locale} c={c} />
                  ))}
                </ul>
              )}
            </Card>

            {/* 3 — why these results */}
            <Card className={hasResult ? "lg:col-span-2" : undefined}>
              <CardTag>{t(locale, "cmTagMethod")}</CardTag>
              <CardTitle>{t(locale, "cmCardMethodTitle")}</CardTitle>
              {!result ? (
                <Muted>{t(locale, "cmCardMethodBody")}</Muted>
              ) : (
                <MethodCard locale={locale} result={result} />
              )}
            </Card>
          </div>
        </div>

        <p className="mt-10 text-xs leading-relaxed" style={{ color: "var(--cm-faint)" }}>
          {t(locale, "cmDisclaimer")}
        </p>
      </div>
    </div>
  );
}

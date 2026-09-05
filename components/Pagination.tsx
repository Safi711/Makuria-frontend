import Link from "next/link";
import { Locale, t } from "@/lib/i18n";

export function Pagination({
  basePath,
  page,
  pageSize,
  totalCount,
  locale,
  extraParams = {},
}: {
  basePath: string;
  page: number;
  pageSize: number;
  totalCount: number;
  locale: Locale;
  extraParams?: Record<string, string>;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const qs = (p: number) => {
    const params = new URLSearchParams(extraParams);
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  };

  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center justify-between gap-4 py-6" aria-label="pagination">
      <Link
        href={qs(Math.max(1, page - 1))}
        aria-disabled={page <= 1}
        className={`rounded-md border px-3 py-1.5 text-sm ${
          page <= 1
            ? "pointer-events-none opacity-40"
            : "hover:border-[var(--mk-gold)]"
        }`}
        style={{ borderColor: "var(--mk-border)" }}
      >
        {t(locale, "previous")}
      </Link>
      <span className="text-sm text-neutral-500">
        {t(locale, "page")} {page} {t(locale, "of")} {totalPages}
      </span>
      <Link
        href={qs(Math.min(totalPages, page + 1))}
        aria-disabled={page >= totalPages}
        className={`rounded-md border px-3 py-1.5 text-sm ${
          page >= totalPages
            ? "pointer-events-none opacity-40"
            : "hover:border-[var(--mk-gold)]"
        }`}
        style={{ borderColor: "var(--mk-border)" }}
      >
        {t(locale, "next")}
      </Link>
    </nav>
  );
}

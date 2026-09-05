import Link from "next/link";
import { Locale } from "@/lib/i18n";

const ITEMS: { href: string; label_ar: string; label_en: string; status: "shell" | "planned" }[] = [
  { href: "/workspace", label_ar: "نظرة عامة", label_en: "Overview", status: "shell" },
  { href: "/matters", label_ar: "الملفات القضائية", label_en: "Matters", status: "planned" },
  { href: "/case-mapper", label_ar: "خريطة القضية", label_en: "Case Mapper", status: "planned" },
  { href: "/quick-check", label_ar: "الفحص السريع", label_en: "Quick Check", status: "planned" },
  { href: "/practical-law", label_ar: "القانون العملي بالسودان", label_en: "Practical Law Sudan", status: "planned" },
  { href: "/alerts", label_ar: "التنبيهات", label_en: "Alerts", status: "planned" },
];

export function WorkspaceNav({ locale }: { locale: Locale }) {
  return (
    <nav className="w-full shrink-0 border-b pb-4 md:w-56 md:border-b-0 md:border-e md:pe-4 md:pb-0" style={{ borderColor: "var(--mk-border)" }}>
      <ul className="flex flex-wrap gap-2 md:flex-col md:gap-1">
        {ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm hover:bg-neutral-100"
            >
              <span>{locale === "ar" ? item.label_ar : item.label_en}</span>
              {item.status === "planned" && (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
                  {locale === "ar" ? "قريبًا" : "soon"}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

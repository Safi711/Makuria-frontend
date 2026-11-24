import Link from "next/link";
import type { Metadata } from "next";
import { getEditor } from "@/lib/equivalency/editor";

export const metadata: Metadata = {
  title: { default: "لوحة الإدارة", template: "%s — لوحة الإدارة" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { user, isEditor } = await getEditor();

  if (!user || !isEditor) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-xl font-bold">لوحة الإدارة</h1>
        <p className="mt-3 text-sm" style={{ color: "var(--cm-muted)" }}>
          هذه الصفحة لمحرري مرجع المعادلة فقط. حسابك ليس في قائمة المحررين.
        </p>
        <Link href="/equivalency" className="mt-6 inline-block underline">
          العودة إلى مرجع المعادلة
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--cm-muted)" }}>
        <span>لوحة الإدارة</span>
        <span>←</span>
        <Link href="/admin/equivalency" className="font-bold hover:text-[var(--mk-gold)]" style={{ color: "var(--cm-text)" }}>
          مرجع المعادلة
        </Link>
        <span className="ms-auto text-xs">{user.email}</span>
      </nav>
      {children}
    </div>
  );
}

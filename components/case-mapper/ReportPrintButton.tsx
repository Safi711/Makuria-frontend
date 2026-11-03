"use client";

/** «حفظ التقرير PDF» — opens the browser's print dialog, where the visitor
 * chooses «Save as PDF». Printing keeps Arabic shaping and the Amiri font
 * exactly as rendered, which a JavaScript PDF library does not. */
export function ReportPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="report-no-print rounded-xl px-6 py-2.5 text-sm font-bold"
      style={{ background: "#0b1930", color: "#fff" }}
    >
      حفظ التقرير PDF أو طباعته
    </button>
  );
}

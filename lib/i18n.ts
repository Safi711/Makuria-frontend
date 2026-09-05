export type Locale = "ar" | "en";

export const LOCALE_COOKIE = "makuria_locale";
export const DEFAULT_LOCALE: Locale = "ar";

export const dictionaries: Record<Locale, Record<string, string>> = {
  ar: {
    siteName: "مكوريا",
    siteTagline: "معهد مكوريا القانوني — منصة الذكاء القانوني السودانية",
    navHome: "الرئيسية",
    navLaws: "القوانين",
    navCases: "السوابق القضائية",
    navPrinciples: "المبادئ القانونية",
    navSearch: "البحث الذكي",
    navWorkspace: "مساحة المحامي",
    navLogin: "تسجيل الدخول",
    navLogout: "تسجيل الخروج",
    heroTitle: "أول منصة سودانية للذكاء القانوني",
    heroSubtitle:
      "قوانين، سوابق قضائية، ومبادئ قانونية موثّقة — بحث ذكي وتحقق من المصادر.",
    exploreLaws: "استعرض القوانين",
    exploreCases: "استعرض السوابق القضائية",
    searchPlaceholder: "ابحث في القوانين والسوابق والمواد بالكلمة المفتاحية",
    searchButton: "بحث",
    noResults: "لا توجد نتائج مطابقة",
    loadMore: "المزيد",
    previous: "السابق",
    next: "التالي",
    page: "صفحة",
    of: "من",
    verified: "موثّق",
    unverified: "غير موثّق — يتطلب مراجعة قانونية",
    comingSoonTitle: "قيد التطوير",
    comingSoonBody:
      "هذه الوحدة جزء من مساحة عمل المحامي في مكوريا وسيتم بناؤها في مرحلة لاحقة. لا توجد بيانات أو وظائف مُصطنعة هنا.",
    workspaceWelcome: "مرحبًا بك في مساحة عمل المحامي",
    workspaceEmpty: "لم يتم إنشاء أي ملفات قضايا بعد.",
    loginTitle: "تسجيل الدخول",
    signupTitle: "إنشاء حساب محامٍ",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    submit: "إرسال",
    noAccount: "ليس لديك حساب؟",
    haveAccount: "لديك حساب بالفعل؟",
    createAccount: "إنشاء حساب",
    signIn: "تسجيل الدخول",
    articlesCount: "مادة",
    lawNumber: "رقم القانون",
    yearIssued: "سنة الإصدار",
    court: "المحكمة",
    caseNumber: "رقم القضية",
    judgmentDate: "تاريخ الحكم",
    footerRights: "جميع الحقوق محفوظة",
    footerNotice:
      "المحتوى القانوني في هذه النسخة التجريبية مصدره نفس قاعدة بيانات مكوريا الإنتاجية — لا يوجد محتوى مُصطنع.",
  },
  en: {
    siteName: "Makuria",
    siteTagline: "Makuria Legal Institute — Sudanese Legal Intelligence Platform",
    navHome: "Home",
    navLaws: "Laws",
    navCases: "Judicial Precedents",
    navPrinciples: "Legal Principles",
    navSearch: "Smart Search",
    navWorkspace: "Lawyer Workspace",
    navLogin: "Log in",
    navLogout: "Log out",
    heroTitle: "Sudan's First AI-Powered Legal Intelligence Platform",
    heroSubtitle:
      "Verified laws, judicial precedents, and legal principles — smart search with source verification.",
    exploreLaws: "Browse Laws",
    exploreCases: "Browse Precedents",
    searchPlaceholder: "Search laws, cases, and articles by keyword",
    searchButton: "Search",
    noResults: "No matching results",
    loadMore: "Load more",
    previous: "Previous",
    next: "Next",
    page: "Page",
    of: "of",
    verified: "Verified",
    unverified: "Unverified — requires legal review",
    comingSoonTitle: "Coming Soon",
    comingSoonBody:
      "This module is part of the Makuria Lawyer Workspace and will be built in a later phase. No fabricated data or functionality lives here.",
    workspaceWelcome: "Welcome to your Lawyer Workspace",
    workspaceEmpty: "No matters have been created yet.",
    loginTitle: "Log in",
    signupTitle: "Create a lawyer account",
    email: "Email",
    password: "Password",
    submit: "Submit",
    noAccount: "Don't have an account?",
    haveAccount: "Already have an account?",
    createAccount: "Create account",
    signIn: "Log in",
    articlesCount: "articles",
    lawNumber: "Law No.",
    yearIssued: "Year issued",
    court: "Court",
    caseNumber: "Case No.",
    judgmentDate: "Judgment date",
    footerRights: "All rights reserved",
    footerNotice:
      "Legal content on this staging build is sourced from the same production Makuria database — nothing here is fabricated.",
  },
};

export function t(locale: Locale, key: string): string {
  return dictionaries[locale][key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key;
}

export function dirFor(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

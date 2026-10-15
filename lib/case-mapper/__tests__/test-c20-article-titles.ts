/**
 * C20 — Article-title guard.
 * For every (lawSlug, articleNumber) in CONCEPT_TO_ARTICLES and
 * DISCUSS_CONCEPT_TO_ARTICLES, fetch the article title from Supabase and
 * compare against the expected-title table seeded from DB on 2026-10-09.
 * Read-only. No schema / data change.
 */
import { createClient } from "@supabase/supabase-js";
import { CONCEPT_TO_ARTICLES, DISCUSS_CONCEPT_TO_ARTICLES } from "../analyze";

try { (process as any).loadEnvFile(".env.local"); } catch { /* ok */ }
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

// ── Expected titles seeded from DB 2026-10-09 ─────────────────────────────────
// key: "lawSlug:articleNumber"
const EXPECTED: Record<string, string> = {
  // criminal-law-1991
  "criminal-law-1991:12":  "حق الدفاع الشرعي",
  "criminal-law-1991:15":  "الضرورة",
  "criminal-law-1991:16":  "الحادث العرضي",
  "criminal-law-1991:19":  "تعريف الشروع",
  "criminal-law-1991:20":  "العقوبة على الشروع",
  "criminal-law-1991:50":  "تقويض النظام الدستوري",
  "criminal-law-1991:51":  "إثارة الحرب ضد الدولة",
  "criminal-law-1991:52":  "التعامل مع دولة معادية",
  "criminal-law-1991:53":  "التجسس على البلاد",
  "criminal-law-1991:54":  "السماح بهرب أسرى الحرب ومساعدتهم",
  "criminal-law-1991:55":  "إفشاء واستلام المعلومات والمستندات الرسمية",
  "criminal-law-1991:56":  "إفشاء المعلومات العسكرية",
  "criminal-law-1991:57":  "دخول وتصوير المناطق والأعمال العسكرية",
  "criminal-law-1991:57أ": "الإضرار بالاقتصاد الوطني",
  "criminal-law-1991:58":  "التحريض على التمرد",
  "criminal-law-1991:59":  "التحريض على الهرب من الخدمة العسكرية وإيواء الهارب",
  "criminal-law-1991:60":  "استعمال الزي والشارات العسكرية والتعامل فيها",
  "criminal-law-1991:61":  "التدريب غير المشروع",
  "criminal-law-1991:62":  "إثارة الشعور بالتذمر بين القوات النظامية والتحريض على ارتكاب ما يخل بالنظام",
  "criminal-law-1991:63":  "الدعوة لمعارضة السلطة العامة بالعنف أو القوة الجنائية",
  "criminal-law-1991:64":  "إثارة الكراهية ضد الطوائف أو بينها",
  "criminal-law-1991:65":  "منظمات وجماعات الإجرام والإرهاب",
  "criminal-law-1991:66":  "نشر الأخبار الكاذبة",
  "criminal-law-1991:67":  "الشغب",
  "criminal-law-1991:68":  "عقوبة الشغب",
  "criminal-law-1991:69":  "الإخلال بالسلام العام",
  "criminal-law-1991:70":  "تلويث موارد المياه",
  "criminal-law-1991:71":  "تلويث البيئة",
  "criminal-law-1991:72":  "تعريض طرق ووسائل المواصلات للخطر",
  "criminal-law-1991:73":  "التوقف عن الخدمة الذي يسبب خطراً على الحياة أو ضرراً للجمهور",
  "criminal-law-1991:74":  "الإهمال الذي يسبب خطراً على الناس أو الأموال",
  "criminal-law-1991:75":  "الامتناع عن المساعدة الضرورية",
  "criminal-law-1991:76":  "الإخلال بالالتزام القانوني تجاه شخص عاجز",
  "criminal-law-1991:77":  "الإزعاج العام",
  "criminal-law-1991:78":  "شرب الخمر والإزعاج",
  "criminal-law-1991:79":  "التعامل في الخمر",
  "criminal-law-1991:80":  "لعب الميسر أو إدارة أماكن للعب الميسر",
  "criminal-law-1991:82":  "بيع أطعمة ضارة بالصحة",
  "criminal-law-1991:83":  "غش الأطعمة والتعامل فيها",
  "criminal-law-1991:84":  "غش الأدوية والتعامل فيها",
  "criminal-law-1991:85":  "بيع الميتة",
  "criminal-law-1991:86":  "عرض طعام أو شراب محرم",
  "criminal-law-1991:87":  "القسوة على الحيوان",
  "criminal-law-1991:88":  "الرشوة",
  "criminal-law-1991:88أ": "إساءة استغلال الوظائف",
  "criminal-law-1991:89":  "الموظف العام الذي يخالف القانون بقصد الإضرار أو الحماية",
  "criminal-law-1991:90":  "الموظف العام الذي يسيء استعمال سلطة الإحالة إلى المحاكمة أو الاعتقال",
  "criminal-law-1991:91":  "الموظف العام الذي يمتنع عن القبض أو يساعد على الهرب",
  "criminal-law-1991:92":  "شراء الموظف العام أو مزايدته في مال بطريقة غير مشروعة",
  "criminal-law-1991:93":  "انتحال صفة الموظف العام",
  "criminal-law-1991:94":  "التخلف عن الحضور تلبية لأمر من موظف عام",
  "criminal-law-1991:95":  "منع تنفيذ التكليف بالحضور أو نزعه",
  "criminal-law-1991:96":  "الامتناع عن تسليم مستند أو تقديم بيان",
  "criminal-law-1991:97":  "تقديم بيان كاذب",
  "criminal-law-1991:98":  "الإجابة على الأسئلة أو التوقيع على الأقوال",
  "criminal-law-1991:99":  "اعتراض الموظف العام أثناء قيامه بوظيفته",
  "criminal-law-1991:100": "الامتناع عن مساعدة الموظف العام",
  "criminal-law-1991:101": "مخالفة أمر الإقامة",
  "criminal-law-1991:102": "مخالفة أمر بشأن مال من موظف عام",
  "criminal-law-1991:103": "تهديد الموظف العام",
  "criminal-law-1991:104": "شهادة الزور واختلاق البينة الباطلة",
  "criminal-law-1991:105": "استخدام بينة مع العلم ببطلانها",
  "criminal-law-1991:106": "إتلاف البينة أو إخفاؤها",
  "criminal-law-1991:107": "التستر على الجاني أو إيواؤه",
  "criminal-law-1991:108": "قبول جزاء لحماية الجاني من العقوبة",
  "criminal-law-1991:109": "مقاومة القبض المشروع أو تخليص المقبوض",
  "criminal-law-1991:110": "مقاومة الشخص عند القبض عليه أو تعطيل القبض عليه أو هربه",
  "criminal-law-1991:112": "الدعاوى لحماية مدين أو حرمان الدائنين",
  "criminal-law-1991:113": "انتحال شخصية الغير",
  "criminal-law-1991:114": "الاتهام الكاذب",
  "criminal-law-1991:115": "التأثير على سير العدالة",
  "criminal-law-1991:116": "إساءة الموظف العام عند مباشرته إجراءات قضائية",
  "criminal-law-1991:117": "تزييف العملة",
  "criminal-law-1991:118": "تزييف طوابع الإيرادات",
  "criminal-law-1991:119": "صنع أدوات التزييف وحيازتها",
  "criminal-law-1991:120": "صنع وتزييف الأختام والعلامات الرسمية",
  "criminal-law-1991:121": "التعامل بوحدات غير صحيحة للوزن أو الكيل أو القياس",
  "criminal-law-1991:122": "التزوير في المستندات",
  "criminal-law-1991:123": "عقوبة التزوير في المستندات",
  "criminal-law-1991:124": "تحريف مستند بوساطة موظف عام",
  "criminal-law-1991:125": "إهانة العقائد الدينية",
  "criminal-law-1991:126": "تكفير الأشخاص والطوائف والمجموعات",
  "criminal-law-1991:127": "تدنيس أماكن العبادة والتشويش عليها",
  "criminal-law-1991:128": "التعدي على الموتى والقبور",
  "criminal-law-1991:129": "القتل وأنواعه",
  "criminal-law-1991:130": "القتل العمد",
  "criminal-law-1991:131": "القتل شبه العمد",
  "criminal-law-1991:132": "القتل الخطأ",
  "criminal-law-1991:133": "الشروع في الانتحار",
  "criminal-law-1991:134": "تحريض الصغير أو المجنون على الانتحار",
  "criminal-law-1991:135": "الإجهاض",
  "criminal-law-1991:136": "الفعل المؤدي إلى الإجهاض",
  "criminal-law-1991:137": "تسبيب موت الجنين",
  "criminal-law-1991:138": "الجراح وأنواعها",
  "criminal-law-1991:139": "عقوبة تسبيب الجراح العمد",
  "criminal-law-1991:140": "عقوبة تسبيب الجراح شبه العمد",
  "criminal-law-1991:141": "عقوبة تسبيب الجراح الخطأ",
  "criminal-law-1991:141أ": "تشويه أعضاء الأنثى",
  "criminal-law-1991:142": "الأذى",
  "criminal-law-1991:143": "القوة الجنائية",
  "criminal-law-1991:144": "الإرهاب",
  "criminal-law-1991:145": "الزنا",
  "criminal-law-1991:146": "عقوبة الزنا",
  "criminal-law-1991:148": "اللواط",
  "criminal-law-1991:149": "الاغتصاب",
  "criminal-law-1991:150": "مواقعة المحارم",
  "criminal-law-1991:151": "الأفعال الفاحشة والتحرش الجنسي",
  "criminal-law-1991:152": "الأفعال الفاضحة",
  "criminal-law-1991:153": "المواد والعروض المخلة بالآداب العامة",
  "criminal-law-1991:154": "ممارسة الدعارة",
  "criminal-law-1991:155": "إدارة محل للدعارة",
  "criminal-law-1991:156": "الإغواء",
  "criminal-law-1991:157": "القذف",
  "criminal-law-1991:159": "إشانة السمعة",
  "criminal-law-1991:160": "الإساءة والسباب",
  "criminal-law-1991:161": "الاستدراج",
  "criminal-law-1991:162": "الخطف",
  "criminal-law-1991:163": "السخرة",
  "criminal-law-1991:164": "الحجز غير المشروع",
  "criminal-law-1991:165": "الاعتقال غير المشروع",
  "criminal-law-1991:166": "انتهاك الخصوصية",
  "criminal-law-1991:167": "الحرابة",
  "criminal-law-1991:168": "عقوبة الحرابة",
  "criminal-law-1991:170": "السرقة الحدية",
  "criminal-law-1991:171": "عقوبة السرقة الحدية",
  "criminal-law-1991:172": "مسقطات عقوبة الحد في السرقة الحدية",
  "criminal-law-1991:173": "عقوبة السرقة الحدية عند سقوط الحد",
  "criminal-law-1991:174": "السرقة",
  "criminal-law-1991:175": "النهب",
  "criminal-law-1991:176": "الابتزاز",
  "criminal-law-1991:177": "خيانة الأمانة",
  "criminal-law-1991:178": "الاحتيال",
  "criminal-law-1991:179": "إعطاء أو تظهير صك مردود",
  "criminal-law-1991:180": "التملك الجنائي",
  "criminal-law-1991:181": "استلام المال المسروق",
  "criminal-law-1991:182": "الإتلاف الجنائي",
  "criminal-law-1991:183": "التعدي الجنائي",
  "criminal-law-1991:184": "الترصد مع القصد الإجرامي",
  "criminal-law-1991:185": "صنع أداة لغرض إجرامي",
  "criminal-law-1991:186": "الجرائم ضد الإنسانية",
  "criminal-law-1991:187": "جرائم الإبادة الجماعية",
  "criminal-law-1991:188": "جرائم الحرب ضد الأشخاص",
  "criminal-law-1991:189": "جرائم الحرب ضد الممتلكات والحقوق الأخرى",
  "criminal-law-1991:190": "جرائم الحرب ضد العمليات الإنسانية",
  "criminal-law-1991:191": "جرائم الحرب الخاصة بأساليب القتال المحظورة",
  "criminal-law-1991:192": "جرائم الحرب الخاصة باستخدام وسائل وأسلحة محظورة",
  // narcotics-psychotropic-substances-act-1994
  "narcotics-psychotropic-substances-act-1994:12": "حظر التعامل في المخدرات والمؤثرات العقلية",
  "narcotics-psychotropic-substances-act-1994:15": "جريمة الاتجار في المخدرات والمؤثرات العقلية وعقوبتها",
  "narcotics-psychotropic-substances-act-1994:16": "جريمة تقديم المخدرات والمؤثرات العقلية وعقوبتها",
  "narcotics-psychotropic-substances-act-1994:20": "عقوبة تعاطى المخدرات والمؤثرات العقلية",
};

interface LawMeta {
  verified: boolean;
  status: string;
  source_url: string | null;
}

async function main() {
  // Collect unique (lawSlug, articleNumber) pairs from both maps.
  const pairs = new Set<string>();
  for (const entries of Object.values(CONCEPT_TO_ARTICLES)) {
    for (const e of entries) pairs.add(`${e.lawSlug}:${e.articleNumber}`);
  }
  for (const entries of Object.values(DISCUSS_CONCEPT_TO_ARTICLES)) {
    for (const e of entries) pairs.add(`${e.lawSlug}:${e.articleNumber}`);
  }

  const sorted = [...pairs].sort();

  // Batch query: articles + law metadata.
  const { data: rows, error } = await supabase
    .from("articles")
    .select("article_number, title_ar, laws!inner(slug, verified, status, source_url)")
    .in(
      "laws.slug",
      [...new Set(sorted.map((p) => p.split(":")[0]))]
    )
    .in(
      "article_number",
      [...new Set(sorted.map((p) => p.split(":").slice(1).join(":")))]
    );

  if (error) {
    console.error("Supabase error:", error.message);
    process.exit(1);
  }

  // Build lookup: key → { title_ar, law meta }
  const dbMap: Record<string, { title: string; law: LawMeta }> = {};
  for (const row of rows ?? []) {
    const law = (row as any).laws as { slug: string; verified: boolean; status: string; source_url: string | null };
    const key = `${law.slug}:${row.article_number}`;
    dbMap[key] = { title: row.title_ar, law };
  }

  let allPassed = true;
  console.log("C20 — Article-title guard (seeded 2026-10-09)\n" + "─".repeat(120));
  console.log(
    "key (law:art)".padEnd(55) + " | " +
    "PASS/FAIL".padEnd(9) + " | " +
    "verified".padEnd(8) + " | " +
    "status".padEnd(10) + " | " +
    "source_url"
  );
  console.log("─".repeat(120));

  for (const key of sorted) {
    const expected = EXPECTED[key];
    const db       = dbMap[key];

    if (!db) {
      console.log(`${key.padEnd(55)} | MISSING   | —        | —          | article not found in DB`);
      allPassed = false;
      continue;
    }

    const ok = db.title === expected;
    if (!ok) allPassed = false;

    const status = ok ? "✓ PASS   " : "✗ FAIL   ";
    const url    = db.law.source_url ?? "—";
    console.log(`${key.padEnd(55)} | ${status} | ${String(db.law.verified).padEnd(8)} | ${db.law.status.padEnd(10)} | ${url}`);
    if (!ok) {
      console.log(`  EXPECTED: ${expected}`);
      console.log(`  GOT:      ${db.title}`);
    }
  }

  console.log("─".repeat(120));
  const total = sorted.length;
  const missing = sorted.filter((k) => !dbMap[k]).length;
  console.log(`Total pairs: ${total}  Missing in DB: ${missing}  Mismatched titles: ${sorted.filter((k) => dbMap[k] && dbMap[k].title !== EXPECTED[k]).length}`);
  console.log(allPassed ? "ALL PASSED" : "FAILURES DETECTED — titles or articles changed");
  process.exit(allPassed ? 0 : 1);
}

main();

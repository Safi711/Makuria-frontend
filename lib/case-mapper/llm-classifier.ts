/**
 * LLM classification layer for analyzeCase.
 * Classifies facts into a closed concept list, "civil", or "abstain".
 * Article numbers come ONLY from CONCEPT_TO_ARTICLES in analyze.ts — never from the LLM.
 * API key must be passed by the caller; never log facts text.
 */

export type LLMClassification =
  | { type: "criminal"; concept: string }
  | { type: "civil" }
  | { type: "abstain" };

// Canonical concept names that must match CONCEPT_TO_ARTICLES keys exactly.
const CONCEPTS = [
  "سرقة", "سطو", "احتيال", "تزوير", "خيانة الأمانة",
  "قتل", "أذى", "مركبة", "مخدرات", "ابتزاز",
  "إتلاف جنائي", "تملك جنائي", "استلام مسروق",
  "حجز غير مشروع", "تعدٍّ", "انتحال",
] as const;

const CONCEPT_SET = new Set<string>(CONCEPTS);

const SYSTEM_PROMPT = `أنت محلل قانوني سوداني. مهمتك الوحيدة: تصنيف الوقائع إلى نوع جريمة جنائية من القائمة المغلقة، أو إعادة civil أو abstain.

القائمة المغلقة:
سرقة | سطو | احتيال | تزوير | خيانة الأمانة | قتل | أذى | مركبة | مخدرات | ابتزاز | إتلاف جنائي | تملك جنائي | استلام مسروق | حجز غير مشروع | تعدٍّ | انتحال

العناصر المطلوبة — أعد abstain إذا غاب أي عنصر من الوقائع:
- سرقة: (1) أخذ مال شخص آخر (2) بغير رضاه (3) بقصد حرمانه منه نهائياً
- سطو: (1) استخدام قوة أو تهديد بها (2) لأخذ مال الغير أو تسهيل ذلك
- احتيال: (1) خداع أو إيهام (2) تصرف الضحية بناءً على الخداع (3) كسب مادي أو خسارة
- تزوير: (1) تحريف أو تزوير وثيقة أو توقيع أو سجل رسمي
- خيانة الأمانة: (1) المال سُلّم للمتهم بصورة مشروعة (2) اختلسه أو رفض إعادته
- قتل: (1) فعل صادر من المتهم (2) وفاة شخص آخر نتيجة له
- أذى: (1) اعتداء جسدي على شخص آخر (2) تسبب في أذى أو ألم جسدي
- مركبة: (1) تشغيل مركبة (2) إصابة أو وفاة (3) إهمال أو تهور في القيادة
- مخدرات: (1) مادة مخدرة موجودة أو جرى التعامل بها
- ابتزاز: (1) تهديد أو إكراه (2) طلب مال أو تصرف تحت الإكراه
- إتلاف جنائي: (1) إتلاف أو تدمير ممتلكات (2) بصورة غير مشروعة
- تملك جنائي: (1) حيازة مال (2) مع العلم بأنه حُصّل بطريقة غير مشروعة
- استلام مسروق: (1) استلام أو اقتناء مال (2) مع العلم بأنه مسروق
- حجز غير مشروع: (1) حجز أو تقييد حرية شخص (2) بغير سند قانوني
- تعدٍّ: (1) دخول عقار أو البقاء فيه (2) بغير إذن أو حق
- انتحال: (1) ادعاء كاذب بلقب مهني أو صفة (2) بغير أهلية أو ترخيص

قواعد لازمة:
- نزاع مدني أو تجاري أو أسري أو عمالي → {"type":"civil"}
- غياب أي عنصر مطلوب أو وقائع غامضة أو ناقصة → {"type":"abstain"}
- جريمة محددة وعناصرها متوافرة → {"type":"criminal","concept":"<الاسم من القائمة بالضبط>"}
- لا تذكر أرقام مواد أو أسماء قوانين
- أخرج JSON صالحاً فقط، لا نص إضافي`;

export async function classifyWithLLM(
  facts: string,
  apiKey: string,
): Promise<LLMClassification> {
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required — set it before running");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 64,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `الوقائع:\n${facts}` }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    throw new Error(`Anthropic API ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json() as {
    content: Array<{ type: string; text: string }>;
  };
  const raw = data.content.find((b) => b.type === "text")?.text?.trim() ?? "";

  // Strip markdown fences if the model wraps the JSON
  const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(clean);
  } catch {
    return { type: "abstain" };
  }

  if (typeof parsed !== "object" || parsed === null) return { type: "abstain" };
  const p = parsed as Record<string, unknown>;

  if (p.type === "civil") return { type: "civil" };
  if (p.type === "abstain") return { type: "abstain" };
  if (
    p.type === "criminal" &&
    typeof p.concept === "string" &&
    CONCEPT_SET.has(p.concept)
  ) {
    return { type: "criminal", concept: p.concept };
  }

  // Unknown type or concept not in closed list → safe default
  return { type: "abstain" };
}

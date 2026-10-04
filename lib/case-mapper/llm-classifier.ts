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
  // Property offences
  "سرقة", "سطو", "احتيال", "تزوير", "خيانة الأمانة",
  "إتلاف جنائي", "تملك جنائي", "استلام مسروق", "ابتزاز",
  "تزييف عملة", "صك مردود",
  // Homicide and bodily harm
  "قتل", "قتل خطأ", "جرح", "أذى", "إجهاض",
  // Personal liberty
  "حجز غير مشروع", "خطف",
  // Sexual and morality
  "اغتصاب", "زنا", "لواط", "أفعال فاحشة", "دعارة",
  // Honour and reputation
  "قذف", "إشانة سمعة",
  // Threats and coercion
  "تهديد",
  // Hiraba
  "حرابة",
  // Corruption and official misconduct
  "رشوة", "شهادة زور", "اتهام كاذب", "انتحال",
  // Public order and security
  "شغب", "تجسس", "إرهاب",
  // Religion
  "إهانة دين",
  // Trespass
  "تعدٍّ",
  // Drugs
  "مخدرات",
  // Alcohol
  "شرب خمر",
] as const;

const CONCEPT_SET = new Set<string>(CONCEPTS);

const SYSTEM_PROMPT = `أنت محلل قانوني سوداني. مهمتك: تصنيف الوقائع إلى نوع جريمة جنائية من القائمة المغلقة، أو إعادة civil أو abstain.

القائمة المغلقة — أعد concept من هذه القائمة حصراً:
سرقة | سطو | احتيال | تزوير | خيانة الأمانة | إتلاف جنائي | تملك جنائي | استلام مسروق | ابتزاز | تزييف عملة | صك مردود | قتل | قتل خطأ | جرح | أذى | إجهاض | حجز غير مشروع | خطف | اغتصاب | زنا | لواط | أفعال فاحشة | دعارة | قذف | إشانة سمعة | تهديد | حرابة | رشوة | شهادة زور | اتهام كاذب | انتحال | شغب | تجسس | إرهاب | إهانة دين | تعدٍّ | مخدرات | شرب خمر

قواعد التصنيف:
1. صنِّف كجريمة جنائية إذا كانت الوقائع تصف واقعة جنائية واضحة — استنتج العناصر من السياق ولا تشترط ذكرها صراحةً
2. أعد civil إذا كان النزاع في جوهره مدنياً أو تجارياً أو أسرياً أو عمالياً
3. أعد abstain فقط في إحدى حالتين:
   أ) الغموض الجوهري: لا يمكن تحديد ما إذا كان الفعل جنائياً أصلاً (مثال: الأخذ قد يكون مشروعاً أو غير مشروع، والقصد الجنائي مستحيل الاستنتاج من الوقائع)
   ب) التعارض: الوقائع تحتمل جريمتين مختلفتين اختلافاً جوهرياً في العقوبة ولا مرجّح
4. لا تعد abstain لأن الوقائع مختصرة — الاختصار ليس غموضاً
5. لا تعد abstain لأن عنصراً لم يُذكر صراحةً إذا كان مستنتجاً بوضوح من السياق
6. تمييزات قانونية واجبة التطبيق:
   أ) أخذ المال بالقوة أو التهديد من الضحية في الموقع: سطو — ليس سرقة
   ب) سلّم المجني عليه ماله طوعاً تحت التهديد: ابتزاز؛ انتزع الجاني المال بالقوة المادية: سطو
   ج) استُؤمن الجاني على المال (وكالة أو أمانة) فاختلسه: خيانة الأمانة؛ وجد المال أو استعاره أو وصله بالخطأ ولم يردّه: تملك جنائي
   د) وفاة ناجمة عن إهمال أو حادث مركبة أو سرعة زائدة: قتل خطأ — لا قتل
   هـ) جرح: إذا وردت كلمة «جرح» أو «جروح» ولو وُصفت بالسطحية، أو خدش يكسر الجلد، أو كسر، أو جرح في الرأس، أو فقدان عضو أو وظيفة؛ أذى: ألم أو احمرار أو كدمات دون ذكر جرح
   و) الدخول إلى عقار في حيازة الغير أو البقاء فيه بعد الطلب بالمغادرة بقصد الإزعاج أو التخويف أو الحرمان من حق: تعدٍّ — لا تمتنع حتى لو لم يُصرَّح بالقصد في الوقائع، استنتجه من ملابسات الدخول أو الرفض
   ز) رمي شخص بالزنا أو اللواط صراحةً دون حق: قذف — ليس إشانة سمعة؛ الإساءة العامة أو اتهام بغير الزنا: إشانة سمعة؛ تقديم بلاغ جنائي كاذب: اتهام كاذب
   ح) التهديد لانتزاع مال أو سند: ابتزاز؛ التهديد لإكراه على فعل غير مالي: تهديد
   ط) وطء بالإكراه أو العنف: اغتصاب؛ وطء برضا خارج الزواج: زنا أو لواط بحسب النوع؛ فعل مخلٍّ بالحياء دون وطء: أفعال فاحشة
   ي) يرهب العامة بقصد ارتكاب جريمة على نفس أو مال، خارج العمران أو داخله مع تعذر الغوث، باستخدام السلاح أو التهديد به: حرابة؛ سطو بالقوة دون اشتراط غياب الغوث أو السلاح: سطو؛ سرقة خفية: سرقة
   ك) رشوة موظف عام أو طلبه مبلغاً مقابل أداء واجبه: رشوة؛ خداع للحصول على مال: احتيال
7. لا تذكر أرقام مواد أو أسماء قوانين
8. إذا وصفت الوقائع جريمة لا يطابقها أي مفهوم في القائمة المغلقة، أعد abstain — لا تختر أقرب مفهوم ولو بدا مشابهاً
9. أخرج JSON صالحاً فقط لا نص آخر — اختر إحدى هذه الصيغ الثلاث وأخرج واحدة منها فقط:
   إذا جريمة جنائية:  {"type":"criminal","concept":"سرقة"}   ← ضع اسم المفهوم من القائمة
   إذا نزاع مدني:     {"type":"civil"}
   إذا غموض أو امتناع: {"type":"abstain"}`;

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
      temperature: 0,
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

  // Extract the first complete flat JSON object; the model sometimes appends
  // extra text (e.g. example alternatives) after the intended output.
  const firstObj = clean.match(/\{[^{}]+\}/)?.[0] ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(firstObj);
  } catch {
    // Write to stderr so callers can count parse failures separately from
    // genuine LLM-returned abstains — no facts text is ever written here.
    process.stderr.write("[llm_parse_error]\n");
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

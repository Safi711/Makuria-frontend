# طلب التنفيذ — ختم أبو رنات | Implementation Request — Abu Rannat Seal
معهد مكوريا القانوني · 30 سبتمبر 2026 · صاحب القرار: صافي

> **شرط أساسي:** النشر على رابط معاينة فقط. لا نشر على makuria.legal قبل موافقة صافي المكتوبة.
> **Hard rule:** Preview deployment only. No production deploy to makuria.legal without Safi's written approval.

## العربية
1. نسخ مجلد `public/abu-rannat/` إلى مجلد public في المشروع (الختم الكحلي، الشفاف، الشارة، نسخة PDF).
2. صفحة أبو رنات: وضع `seal-navy.png` أعلى الصفحة كهوية للمستشار.
3. ختم نهاية التحليل (بحركة): استخدام المكوّن `components/AbuRannatStamp.tsx` داخل نتيجة المستشار، ويظهر **فقط** بعد اكتمال التحليل وربطه بالقوانين والسوابق وفحص الإحالات. لا يظهر أبداً عند الفشل أو النتائج الناقصة أو أثناء التحميل. العبارة التوضيحية ظاهرة دائماً تحته. يحترم إعداد "تقليل الحركة".
4. صورة المشاركة (Open Graph) لصفحة أبو رنات: `seal-navy.png`.
5. لا تغييرات أخرى في الصفحة أو قاعدة البيانات. لا تغيير لمسار /case-mapper الآن.
6. رابط معاينة فقط يُرسل لصافي.

## English
1. Copy `public/abu-rannat/` into the project's public folder.
2. Abu Rannat page: place `seal-navy.png` at the top as the advisor's identity.
3. Animated end-of-analysis stamp: use `components/AbuRannatStamp.tsx` in the advisor result. Render **only** when the analysis is complete, linked to laws/precedents, and citations are verified. Never on failure, partial results, or while streaming. Disclaimer always visible. Respects prefers-reduced-motion.
4. Open Graph image for the Abu Rannat page: `seal-navy.png`.
5. No other page or database changes. Do not rename /case-mapper now.
6. Preview URL only, sent to Safi.

## اختبارات المعاينة | Preview checks
- تحليل ناجح: الختم ينزل مرة واحدة بحركة أقل من ثانية.
- تحليل فاشل أو ناقص: لا يظهر الختم.
- الجوال: الختم والعبارة واضحان ولا يخرجان عن الشاشة.
- تقليل الحركة مفعّل: الختم ثابت بلا حركة.
- مشاركة رابط الصفحة على واتساب: تظهر صورة الختم.

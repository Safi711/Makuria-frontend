// factsMatchMoneyDemand verification (Commit 37).
import { factsMatchMoneyDemand } from "../kw-matcher.mjs";

// [text, expected, note]
const tests = [
  // ── POSITIVES ────────────────────────────────────────────────────────────────
  ["لو ما دفعت ليهو خمسة مليون",
    true,  "M1  مليون (EXTRA) → money noun fires"],
  ["طلب منه مبلغاً مقابل السكوت",
    true,  "M2  مبلغ (MONEY_NOUN) + طلب + منه within 2 → both checks fire"],
  ["هدده بنشر صورها إن لم تحوّل له",
    true,  "M3  تحوّل → تحول (DEMAND_VERB) → demand verb fires"],
  ["سلّم السند وإلا",
    true,  "M4  سند (EXTRA) + سلّم → سلم (DEMAND_VERB) → both fire"],
  ["جيب القروش بكرة",
    true,  "M5  قروش (EXTRA) + جيب (DEMAND_VERB) → both fire"],
  ["ادفع لي ألف جنيه وإلا",
    true,  "M6  ادفع (DEMAND_VERB) + ألف + جنيه (EXTRA) → fire"],
  ["طالب منها توقيع على الورقة",
    true,  "M7  طالب + منها within 2 → ordered check (3) fires; also توقيع/ورقة"],
  ["يجيب الشيك بكرة",
    true,  "M8  شيك (EXTRA) + يجيب (DEMAND_VERB) → fire"],
  ["أعطني الفلوس",
    true,  "M9  اعطني (DEMAND_VERB) + الفلوس → فلوس (MONEY_NOUN) → fire"],
  ["يطلب منه حوالة مالية",
    true,  "M10 يطلب + منه within 2 → ordered (3) fires; also حوالة (EXTRA)"],
  ["هدده بكشف الأسرار إن لم يسلم الأوراق والتنازل عن حقه",
    true,  "M11 يسلم (DEMAND_VERB) + تنازل (EXTRA) → fire"],
  ["أرغمه على دفع عشرة آلاف جنيه",
    true,  "M12 آلاف (EXTRA) + جنيه (EXTRA) → fire"],
  // ── NEGATIVES ────────────────────────────────────────────────────────────────
  ["حأوريك النجوم في عز الضهر",
    false, "N1  threat only, no money/demand token → no fire"],
  ["لو جيت الحلة دي تاني",
    false, "N2  جيت ≠ جيب; no money token → no fire"],
  ["هدده بالضرب",
    false, "N3  physical threat, no money/demand → no fire"],
  ["مسكه من هدومه",
    false, "N4  physical act, no money/demand → no fire"],
  ["دفعه في صدره",
    false, "N5  دفعه (push) — exact-match guard: دفعه ≠ دفع → no fire"],
  ["قال له سأبلغ الشرطة إن لم يعتذر",
    false, "N6  reporting threat, no money/document → no fire"],
  ["ضربه بعصا على رأسه",
    false, "N7  assault, no money/demand → no fire"],
  ["لم يقبض أجره منذ شهرين",
    false, "N8  wage dispute — no demand verb, no money noun → no fire"],
  ["مسكه من هدومه وهدده بالفضيحة",
    false, "N9  threat only, no money/document demand → no fire"],
  ["قال ليهو حأوريك لو شفتك هنا تاني",
    false, "N10 bare threat, no money/document → no fire"],
];

function runSuite(tests, fn) {
  let allPassed = true;
  console.log("\nfactsMatchMoneyDemand positives/negatives\n" + "─".repeat(72));
  for (const [text, expected, note] of tests) {
    const got = fn(text);
    const ok  = got === expected;
    if (!ok) allPassed = false;
    console.log(`${ok ? "✓" : "✗"} [${expected ? "DEMAND  " : "NO DEMA "}] got=${got}  "${text}"  (${note})`);
  }
  console.log("─".repeat(72));
  console.log(allPassed ? "ALL PASSED" : "FAILURES — stop before committing");
  return allPassed;
}

const p = runSuite(tests, factsMatchMoneyDemand);
process.exit(p ? 0 : 1);

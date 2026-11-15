"use client";
/**
 * AbuRannatStamp — ختم نهاية التحليل
 * Render ONLY when the analysis is complete AND citations are verified.
 * Never render on failure, partial results, or while streaming.
 *
 * Usage:
 *   {analysisComplete && citationsVerified && <AbuRannatStamp locale="ar" />}
 *
 * Drawn as a hand stamp (wooden handle + face). The face carries the Abu Rannat
 * badge only; it does not imitate any official seal.
 */
import { useId } from "react";
import styles from "./AbuRannatStamp.module.css";

const INK = "#E3C06A";

export default function AbuRannatStamp({ locale = "ar" }: { locale?: "ar" | "en" }) {
  const id = useId().replace(/:/g, "");
  const ringText =
    locale === "en" ? "ABU RANNAT · LEGAL ADVISOR" : "أبو رنات · المستشار القانوني الذكي";
  const alt = locale === "en" ? "Abu Rannat stamp — Makuria" : "ختم أبو رنات — مكوريا";
  const doneText = locale === "en" ? "Analysis complete; citations checked" : "اكتمل التحليل وفُحصت الإحالات";
  const noteText =
    locale === "en"
      ? "A digital mark after the answer and its citations were checked. It is not legal approval of the case."
      : "توقيع علامة رقمية بعد اكتمال الإجابة وفحص إحالاتها، وليس اعتماداً قانونياً للدعوى.";

  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <div className={styles.stage}>
        <svg
          className={styles.press}
          viewBox="0 0 140 200"
          width={140}
          height={200}
          role="img"
          aria-label={alt}
        >
          <defs>
            <linearGradient id={`${id}-wood`} x1="0" x2="1">
              <stop offset="0" stopColor="#7A4B22" />
              <stop offset=".45" stopColor="#C58B4E" />
              <stop offset="1" stopColor="#6B3F1C" />
            </linearGradient>
            <path id={`${id}-ring`} d="M30,152 a40,40 0 0,0 80,0" />
          </defs>

          {/* handle */}
          <circle cx="70" cy="34" r="26" fill={`url(#${id}-wood)`} />
          <rect x="59" y="54" width="22" height="44" rx="9" fill={`url(#${id}-wood)`} />
          <ellipse cx="70" cy="100" rx="38" ry="9" fill={`url(#${id}-wood)`} />
          <rect x="31" y="98" width="78" height="10" rx="5" fill={`url(#${id}-wood)`} />

          {/* face */}
          <g className={styles.faceInk}>
            <circle cx="70" cy="152" r="47" fill="none" stroke={INK} strokeWidth="2.5" />
            <circle cx="70" cy="152" r="34" fill="none" stroke={INK} strokeWidth="1" />
            <text fill={INK} fontSize="8" fontWeight="700" letterSpacing=".3">
              <textPath href={`#${id}-ring`} startOffset="50%" textAnchor="middle">
                {ringText}
              </textPath>
            </text>
            <image
              href="/abu-rannat/badge.png"
              x="40"
              y="122"
              width="60"
              height="60"
              preserveAspectRatio="xMidYMid meet"
            />
          </g>
        </svg>
      </div>
      <p className={styles.done}>
        <span aria-hidden="true">✅ </span>
        {doneText}
      </p>
      <p className={styles.note}>{noteText}</p>
    </div>
  );
}

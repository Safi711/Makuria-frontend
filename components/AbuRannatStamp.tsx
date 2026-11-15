"use client";
/**
 * AbuRannatStamp — ختم نهاية التحليل
 * Render ONLY when the analysis is complete AND citations are verified.
 * Never render on failure, partial results, or while streaming.
 *
 * Usage:
 *   {analysisComplete && citationsVerified && <AbuRannatStamp locale="ar" />}
 *
 * A hand stamp (wooden handle, rubber face with the Abu Rannat badge) lifts,
 * presses onto the paper, leaves a navy impression, then lifts away. The
 * impression stays. It does not imitate any official seal.
 */
import { useId } from "react";
import styles from "./AbuRannatStamp.module.css";

const INK = "#B8860B";
const GOLD = "#E3C06A";

export default function AbuRannatStamp({ locale = "ar" }: { locale?: "ar" | "en" }) {
  const id = useId().replace(/:/g, "");
  const isEn = locale === "en";
  const top = isEn ? "ABU RANNAT" : "أبو رنات";
  const bottom = isEn ? "LEGAL ADVISOR" : "المستشار القانوني الذكي";
  const center = isEn ? "DONE" : "اكتمل";
  const alt = isEn ? "Abu Rannat stamp: analysis complete" : "ختم أبو رنات: اكتمل التحليل";
  const doneText = isEn ? "Analysis complete; citations checked" : "اكتمل التحليل وفُحصت الإحالات";
  const noteText = isEn
    ? "A digital mark after the answer and its citations were checked. It is not legal approval of the case."
    : "توقيع علامة رقمية بعد اكتمال الإجابة وفحص إحالاتها، وليس اعتماداً قانونياً للدعوى.";

  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <div className={styles.paper}>
        <svg className={styles.svg} viewBox="0 -30 240 300" role="img" aria-label={alt}>
          <defs>
            <linearGradient id={`${id}-wood`} x1="0" x2="1">
              <stop offset="0" stopColor="#4A2A12" />
              <stop offset=".45" stopColor="#8A5328" />
              <stop offset="1" stopColor="#3A2010" />
            </linearGradient>
            <filter id={`${id}-ink`} x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="1.4" />
            </filter>
            <path id={`${id}-top`} d="M58,190 a62,62 0 0,1 124,0" />
            <path id={`${id}-bottom`} d="M50,190 a70,70 0 0,0 140,0" />
          </defs>

          {/* printed impression: stays after the stamp lifts */}
          <g className={styles.impression} filter={`url(#${id}-ink)`}>
            <circle cx="120" cy="190" r="74" fill="none" stroke={INK} strokeWidth="4" />
            <circle cx="120" cy="190" r="60" fill="none" stroke={INK} strokeWidth="2" />
            <text fill={INK} fontSize="15" fontWeight="700">
              <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">{top}</textPath>
            </text>
            <text fill={INK} fontSize="11" fontWeight="700">
              <textPath href={`#${id}-bottom`} startOffset="50%" textAnchor="middle">{bottom}</textPath>
            </text>
            <text x="120" y="202" fill={INK} fontSize="34" fontWeight="800" textAnchor="middle">
              {center}
            </text>
          </g>

          {/* the tool: handle + rubber face with the badge */}
          <g className={styles.tool}>
            <circle cx="120" cy="62" r="28" fill={`url(#${id}-wood)`} />
            <rect x="105" y="84" width="30" height="62" rx="10" fill={`url(#${id}-wood)`} />
            <circle cx="120" cy="190" r="70" fill="#14233F" stroke={GOLD} strokeWidth="3" />
            <circle cx="120" cy="190" r="58" fill="none" stroke={GOLD} strokeWidth="1" opacity=".6" />
            <image href="/abu-rannat/badge.png" x="90" y="160" width="60" height="60" preserveAspectRatio="xMidYMid meet" />
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

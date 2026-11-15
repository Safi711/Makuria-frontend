"use client";
/**
 * AbuRannatStamp — ختم نهاية التحليل
 * Render ONLY when the analysis is complete AND citations are verified.
 * Never render on failure, partial results, or while streaming.
 *
 * Usage:
 *   {analysisComplete && citationsVerified && <AbuRannatStamp locale="ar" />}
 *
 * A royal-blue handle with gold lettering and a gold base lowers onto the
 * paper, presses once, and lifts away. The gold-ringed impression stays.
 * It is an original mark and does not imitate any official seal.
 */
import { useId } from "react";
import styles from "./AbuRannatStamp.module.css";

const BLUE = "#1B3A8C";
const GOLD_RING = "#C9A24A";

export default function AbuRannatStamp({ locale = "ar" }: { locale?: "ar" | "en" }) {
  const id = useId().replace(/:/g, "");
  const isEn = locale === "en";
  const top = isEn ? "ABU RANNAT" : "أبو رنات";
  const center = isEn ? "DONE" : "اكتمل";
  const alt = isEn ? "Abu Rannat stamp: analysis complete" : "ختم أبو رنات: اكتمل التحليل";
  const doneText = isEn ? "Analysis complete; citations checked" : "اكتمل التحليل وفُحصت الإحالات";
  const noteText = isEn
    ? "A digital mark after the answer and its citations were checked. It is not legal approval of the case."
    : "توقيع علامة رقمية بعد اكتمال الإجابة وفحص إحالاتها، وليس اعتماداً قانونياً للدعوى.";

  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <div className={styles.paper}>
        <svg className={styles.svg} viewBox="0 -140 400 560" role="img" aria-label={alt}>
          <defs>
            <radialGradient id={`${id}-paper`} cx="40%" cy="30%" r="80%">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#F3F1EC" />
            </radialGradient>
            <radialGradient id={`${id}-blue`} cx="35%" cy="28%" r="75%">
              <stop offset="0" stopColor="#3F6FE0" />
              <stop offset=".45" stopColor="#1A3FA8" />
              <stop offset="1" stopColor="#0A1F66" />
            </radialGradient>
            <linearGradient id={`${id}-neck`} x1="0" x2="1">
              <stop offset="0" stopColor="#06164A" />
              <stop offset=".4" stopColor="#2A56C8" />
              <stop offset="1" stopColor="#06164A" />
            </linearGradient>
            <linearGradient id={`${id}-gold`} x1="0" x2="1">
              <stop offset="0" stopColor="#6E5220" />
              <stop offset=".22" stopColor="#E6C77A" />
              <stop offset=".5" stopColor="#B9913E" />
              <stop offset=".8" stopColor="#F0D690" />
              <stop offset="1" stopColor="#5E4319" />
            </linearGradient>
            <linearGradient id={`${id}-goldTop`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#F6E3A6" />
              <stop offset="1" stopColor="#B68D3B" />
            </linearGradient>
            <radialGradient id={`${id}-rubber`} cx="50%" cy="40%" r="60%">
              <stop offset="0" stopColor="#2A2A2E" />
              <stop offset="1" stopColor="#050506" />
            </radialGradient>
            <filter id={`${id}-ink`} x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" />
            </filter>
            <filter id={`${id}-soft`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>

          <rect x="0" y="-140" width="400" height="560" fill={`url(#${id}-paper)`} />

          {/* printed impression: drawn before the tool, so the tool covers it until it lifts */}
          <g className={styles.impression} filter={`url(#${id}-ink)`}>
            <g transform="translate(200 390) scale(1 .75) translate(-200 -390)">
              <circle cx="200" cy="390" r="92" fill="none" stroke={GOLD_RING} strokeWidth="4" />
              <circle cx="200" cy="390" r="82" fill="none" stroke={GOLD_RING} strokeWidth="1.5" />
              <text x="200" y="338" textAnchor="middle" fontFamily="serif" fontSize="30" fontWeight="700" fill={BLUE}>
                {top}
              </text>
              <text x="200" y="408" textAnchor="middle" fontFamily="serif" fontSize="58" fontWeight="800" fill={BLUE}>
                {center}
              </text>
              <text x="200" y="444" textAnchor="middle" fontFamily="Georgia, serif" fontSize="15" letterSpacing=".5" fill={BLUE}>
                makuria.legal
              </text>
            </g>
          </g>

          <ellipse className={styles.shadow} cx="212" cy="396" rx="100" ry="18" fill="#3A2E10" filter={`url(#${id}-soft)`} />

          {/* the tool: bulb handle, neck, gold collar, gold base, rubber face */}
          <g className={styles.tool}>
            <circle cx="200" cy="170" r="72" fill={`url(#${id}-blue)`} />
            <ellipse cx="172" cy="130" rx="26" ry="14" fill="#FFFFFF" opacity=".28" />
            <text x="200" y="182" textAnchor="middle" fontFamily="serif" fontSize="27" fontWeight="700" fill={`url(#${id}-goldTop)`}>
              {top}
            </text>
            <rect x="176" y="222" width="48" height="66" rx="16" fill={`url(#${id}-neck)`} />
            <rect x="150" y="280" width="100" height="16" rx="6" fill={`url(#${id}-gold)`} />
            <rect x="120" y="294" width="160" height="82" rx="8" fill={`url(#${id}-gold)`} />
            <ellipse cx="200" cy="294" rx="80" ry="14" fill={`url(#${id}-goldTop)`} />
            <ellipse cx="200" cy="376" rx="80" ry="14" fill={`url(#${id}-rubber)`} />
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

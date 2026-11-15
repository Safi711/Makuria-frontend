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
        <svg className={styles.svg} viewBox="0 30 400 310" role="img" aria-label={alt}>
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
              <feDisplacementMap in="SourceGraphic" in2="n" scale="1.4" />
            </filter>
            <filter id={`${id}-soft`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>

          <rect x="0" y="30" width="400" height="310" fill={`url(#${id}-paper)`} />

          {/* impression on the right, flattened to the paper plane; drawn under the tool */}
          <g className={styles.impression} filter={`url(#${id}-ink)`}>
            <g transform="translate(262 290) scale(1 .76) translate(-262 -290)">
              <circle cx="262" cy="290" r="50" fill="none" stroke={GOLD_RING} strokeWidth="3.5" />
              <circle cx="262" cy="290" r="43" fill="none" stroke={GOLD_RING} strokeWidth="1.3" />
              <text x="262" y="268" textAnchor="middle" fontFamily="serif" fontSize="13" fontWeight="700" fill={BLUE}>
                {top}
              </text>
              <text x="262" y="302" textAnchor="middle" fontFamily="serif" fontSize="28" fontWeight="800" fill={BLUE}>
                {center}
              </text>
              <text x="262" y="317" textAnchor="middle" fontFamily="Georgia, serif" fontSize="8" letterSpacing=".4" fill={BLUE}>
                makuria.legal
              </text>
            </g>
          </g>

          {/* the tool, drawn with its rubber face centred on the contact point (0,0) */}
          <g className={styles.tool}>
            <g transform="scale(.62)">
              <ellipse cx="6" cy="4" rx="92" ry="14" fill="#000" opacity=".18" filter={`url(#${id}-soft)`} />
              <circle cx="0" cy="-250" r="72" fill={`url(#${id}-blue)`} />
              <ellipse cx="-28" cy="-290" rx="26" ry="14" fill="#FFFFFF" opacity=".28" />
              <text x="0" y="-238" textAnchor="middle" fontFamily="serif" fontSize="27" fontWeight="700" fill={`url(#${id}-goldTop)`}>
                {top}
              </text>
              <rect x="-24" y="-184" width="48" height="76" rx="16" fill={`url(#${id}-neck)`} />
              <rect x="-50" y="-112" width="100" height="16" rx="6" fill={`url(#${id}-gold)`} />
              <rect x="-80" y="-96" width="160" height="82" rx="8" fill={`url(#${id}-gold)`} />
              {/* engraved label on the front of the base, following its curve */}
              <path id={`${id}-baseArc`} d="M-66,-56 Q0,-42 66,-56" fill="none" />
              <text fontFamily="Georgia, serif" fontSize="16" fontWeight="700" letterSpacing="1" textAnchor="middle" transform="translate(0 1)" fill="#FFF3C4" opacity=".55">
                <textPath href={`#${id}-baseArc`} startOffset="50%">Makuria.legal</textPath>
              </text>
              <text fontFamily="Georgia, serif" fontSize="16" fontWeight="700" letterSpacing="1" textAnchor="middle" transform="translate(0 -.6)" fill="#2A1C05" opacity=".5">
                <textPath href={`#${id}-baseArc`} startOffset="50%">Makuria.legal</textPath>
              </text>
              <text fontFamily="Georgia, serif" fontSize="16" fontWeight="700" letterSpacing="1" textAnchor="middle" fill={BLUE}>
                <textPath href={`#${id}-baseArc`} startOffset="50%">Makuria.legal</textPath>
              </text>
              <ellipse cx="0" cy="-96" rx="80" ry="14" fill={`url(#${id}-goldTop)`} />
              <path d="M-80,-14 A80,14 0 0 0 80,-14 Z" fill={`url(#${id}-rubber)`} />
            </g>
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

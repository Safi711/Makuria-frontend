"use client";
/**
 * AbuRannatStamp — ختم نهاية التحليل
 * Render ONLY when the analysis is complete AND citations are verified.
 * Never render on failure, partial results, or while streaming.
 *
 * Usage (inside the analysis card, after the results and before the
 * clarification questions):
 *   {analysisComplete && citationsVerified && <AbuRannatStamp locale="ar" />}
 *
 * The stage has a transparent background and reserves its height up front,
 * so nothing below it moves. The animation plays once, when the stage first
 * becomes visible. Under reduced motion the final state is shown without
 * animation.
 *
 * It is an original mark and does not imitate any official seal.
 */
import { useEffect, useId, useRef, useState } from "react";
import styles from "./AbuRannatStamp.module.css";

const BLUE = "#1B3A8C";
// The impression sits on the dark card, so its ink is lighter than the
// blue used on the gold base, to stay legible.
const INK = "#5B8CFF";
const GOLD_RING = "#C9A24A";

type Phase = "idle" | "run" | "static";

export default function AbuRannatStamp({ locale = "ar" }: { locale?: "ar" | "en" }) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");

  const isEn = locale === "en";
  const top = isEn ? "ABU RANNAT" : "أبو رنات";
  const center = isEn ? "DONE" : "اكتمل";
  const alt = isEn ? "Abu Rannat stamp: analysis complete" : "ختم أبو رنات: اكتمل التحليل";
  const doneText = isEn ? "Analysis complete; citations checked" : "اكتمل التحليل وفُحصت الإحالات";
  const noteText = isEn
    ? "A digital mark after the answer and its citations were checked. It is not legal approval of the case."
    : "توقيع علامة رقمية بعد اكتمال الإجابة وفحص إحالاتها، وليس اعتماداً قانونياً للدعوى.";

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setPhase("static");
      return;
    }
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setPhase("run");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.6)) {
          setPhase("run");
          io.disconnect();
        }
      },
      { threshold: [0, 0.6] },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <div ref={ref} className={`${styles.stage} ${styles[phase]}`}>
        <svg className={styles.svg} viewBox="0 30 400 310" role="img" aria-label={alt}>
          <defs>
            <radialGradient id={`${id}-blue`} cx="35%" cy="28%" r="75%">
              <stop offset="0" stopColor="#3F6FE0" />
              <stop offset=".45" stopColor="#1A3FA8" />
              <stop offset="1" stopColor="#0A1F66" />
            </radialGradient>
            <radialGradient id={`${id}-headShade`} cx="38%" cy="32%" r="70%">
              <stop offset=".55" stopColor="#030A24" stopOpacity="0" />
              <stop offset="1" stopColor="#030A24" stopOpacity=".75" />
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
            <filter id={`${id}-spec`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
            <filter id={`${id}-contact`} x="-50%" y="-100%" width="200%" height="300%">
              <feGaussianBlur stdDeviation="1.5" />
            </filter>
            <path id={`${id}-baseArc`} d="M-66,-56 Q0,-42 66,-56" fill="none" />
          </defs>

          {/* printed impression: under the tool, so the tool covers it until it lifts */}
          <g className={styles.impression} filter={`url(#${id}-ink)`}>
            <g transform="translate(262 290) scale(1 .76) translate(-262 -290)">
              <circle cx="262" cy="290" r="50" fill="none" stroke={GOLD_RING} strokeWidth="3.5" />
              <circle cx="262" cy="290" r="43" fill="none" stroke={GOLD_RING} strokeWidth="1.3" />
              <text x="262" y="268" textAnchor="middle" fontFamily="serif" fontSize="13" fontWeight="700" fill={INK}>
                {top}
              </text>
              <text x="262" y="302" textAnchor="middle" fontFamily="serif" fontSize="28" fontWeight="800" fill={INK}>
                {center}
              </text>
              <text x="262" y="317" textAnchor="middle" fontFamily="Georgia, serif" fontSize="8" letterSpacing=".4" fill={INK}>
                makuria.legal
              </text>
            </g>
          </g>

          {/* the tool: its contact point is (0,0) in its own space */}
          <g className={styles.tool}>
            <g className={styles.press}>
              <g transform="scale(.62)">
                <ellipse className={styles.shadow} cx="6" cy="4" rx="92" ry="14" fill="#000" opacity=".18" filter={`url(#${id}-soft)`} />
                <ellipse cx="0" cy="-212" rx="61" ry="54" fill={`url(#${id}-blue)`} />
                <ellipse cx="0" cy="-212" rx="61" ry="54" fill={`url(#${id}-headShade)`} />
                <ellipse cx="-22" cy="-238" rx="24" ry="13" fill="#FFFFFF" opacity=".38" filter={`url(#${id}-spec)`} />
                <text x="0" y="-204" textAnchor="middle" fontFamily="serif" fontSize="24" fontWeight="700" fill={`url(#${id}-goldTop)`}>
                  {top}
                </text>
                <rect x="-24" y="-164" width="48" height="52" rx="16" fill={`url(#${id}-neck)`} />
                <ellipse cx="0" cy="-158" rx="26" ry="5" fill="#000" opacity=".4" filter={`url(#${id}-contact)`} />
                <rect x="-50" y="-112" width="100" height="16" rx="6" fill={`url(#${id}-gold)`} />
                <rect x="-80" y="-96" width="160" height="82" rx="8" fill={`url(#${id}-gold)`} />
                {/* engraved label on the front of the base, following its curve */}
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

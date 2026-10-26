"use client";
/**
 * AbuRannatStamp — ختم نهاية التحليل
 * Render ONLY when the analysis is complete AND citations are verified.
 * Never render on failure, partial results, or while streaming.
 *
 * Usage:
 *   {analysisComplete && citationsVerified && <AbuRannatStamp />}
 *
 * Motion (Safi's choice, 2026-09-30): when the analysis finishes, the page
 * scrolls down to the seal, THEN the seal stamps, THEN the ✓ is drawn.
 *
 * The earlier version played its animation the moment it mounted. The seal
 * sits below the results, so the stamp had already landed off-screen and the
 * reader only ever saw a still badge — the motion was there but never seen.
 * Now the animation waits until the seal is actually on screen.
 */
import { useEffect, useRef, useState } from "react";
import styles from "./AbuRannatStamp.module.css";

export default function AbuRannatStamp() {
  const ref = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // 1) bring the seal into view once the results have painted
    const scrollTimer = window.setTimeout(() => {
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    }, 450);

    // 2) stamp only when the seal is really visible
    let observer: IntersectionObserver | null = null;
    let fallbackTimer = 0;
    if (typeof IntersectionObserver === "undefined") {
      // very old browsers: stamp right after the scroll instead
      fallbackTimer = window.setTimeout(() => setPlay(true), 900);
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            setPlay(true);
            observer?.disconnect();
          }
        },
        { threshold: 0.6 },
      );
      observer.observe(el);
    }

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(fallbackTimer);
      observer?.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`${styles.wrap} ${play ? styles.play : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className={styles.stage}>
        <span className={styles.ring} aria-hidden="true" />
        <img
          src="/abu-rannat/badge.png"
          alt="ختم أبو رنات — مكوريا"
          width={120}
          height={120}
          className={styles.stamp}
        />
      </div>
      <p className={styles.done}>
        <svg
          className={styles.check}
          width="22"
          height="22"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10.5" className={styles.checkCircle} />
          <path d="M7 12.5l3.2 3.2L17.2 8.6" className={styles.checkMark} />
        </svg>
        اكتمل التحليل وفُحصت الإحالات
      </p>
      <p className={styles.note}>
        توقيع علامة رقمية بعد اكتمال الإجابة وفحص إحالاتها، وليس اعتماداً قانونياً للدعوى.
      </p>
    </div>
  );
}

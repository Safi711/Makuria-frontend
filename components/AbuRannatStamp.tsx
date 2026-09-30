"use client";
/**
 * AbuRannatStamp — ختم نهاية التحليل
 * Render ONLY when the analysis is complete AND citations are verified.
 * Never render on failure, partial results, or while streaming.
 *
 * Usage:
 *   {analysisComplete && citationsVerified && <AbuRannatStamp />}
 */
import styles from "./AbuRannatStamp.module.css";

export default function AbuRannatStamp() {
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
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
      <p className={styles.done}>اكتمل التحليل وفُحصت الإحالات</p>
      <p className={styles.note}>
        توقيع علامة رقمية بعد اكتمال الإجابة وفحص إحالاتها، وليس اعتماداً قانونياً للدعوى.
      </p>
    </div>
  );
}

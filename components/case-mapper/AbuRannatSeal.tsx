/**
 * خاتم أبو رنات — the advisor's emblem.
 *
 * Drawn here as vector geometry, from scratch. It replaces a photograph that
 * was in Safi's first version of this design and that had to go for two
 * reasons, the second larger than the first:
 *
 *  1. The photograph was a BBC archive image — the microphone in it carries
 *     their mark — so its rights are not ours. On a site whose whole promise is
 *     «كل نصّ ومصدره», the one picture on the front could not be a borrowed one.
 *
 *  2. A man's face beside an answer box says those are his answers. The page
 *     carries a line stating the opposite — «الإجابات تصدر عن أداة بحث، ولا
 *     تُنسب إليه» — and a portrait would have argued against it louder than the
 *     line argued for it. A seal names a person without speaking for him.
 *
 * Safi's revised design chose scales above an open book, which says more than
 * scales alone: a judgment rests on a text. That is the corpus this tool reads.
 *
 * Vector, not an image file: crisp from 24px to a banner, a few hundred bytes,
 * and it recolours with the theme instead of carrying its own baked-in navy.
 */
export function AbuRannatSeal({
  size = 120,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="خاتم أبو رنات — ميزان فوق كتاب مفتوح"
    >
      {/* the seal body */}
      <circle cx="60" cy="60" r="56" fill="#14243F" stroke="#E6C769" strokeWidth="2.2" />
      <circle cx="60" cy="60" r="48" fill="none" stroke="#3A4C68" strokeWidth="0.9" />

      <g
        stroke="#F5E6AE"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* scales: finial, post, beam, and the two drops */}
        <circle cx="60" cy="30" r="3.6" fill="#F5E6AE" stroke="none" />
        <path d="M60 33.5V63" strokeWidth="3.4" />
        <path d="M25 39h70" strokeWidth="3.8" />
        <path d="M34 39v13M86 39v13" strokeWidth="1.8" />

        {/* the two pans — a flat rim and a shallow bowl beneath it */}
        <path d="M22 52h24" strokeWidth="2.4" />
        <path d="M22 52a12 9 0 0 0 24 0" strokeWidth="2.4" />
        <path d="M74 52h24" strokeWidth="2.4" />
        <path d="M74 52a12 9 0 0 0 24 0" strokeWidth="2.4" />

        {/* the open book */}
        <path
          d="M60 78c-8-6-22-8-34-5v15c12-3 26-1 34 4z"
          strokeWidth="2.4"
        />
        <path
          d="M60 78c8-6 22-8 34-5v15c-12-3-26-1-34 4z"
          strokeWidth="2.4"
        />
      </g>
    </svg>
  );
}

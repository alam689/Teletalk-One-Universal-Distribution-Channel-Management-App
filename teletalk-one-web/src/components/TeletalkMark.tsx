/**
 * Teletalk brand furniture for the sign-in panel.
 *
 * NOTE FOR HANDOVER: `TeletalkMark` is a hand-drawn approximation of the
 * three-blade swoosh, not the official asset. Replace the paths with the real
 * SVG from Brand/Corporate Affairs before anything ships externally — the
 * proportions here are close, not exact.
 */

/**
 * One blade, drawn at the origin spanning 100 × 62 local units.
 *
 * Four features, each of which I got wrong at least once:
 *
 *  1. TAIL — a DIAGONAL cut, not a vertical one. It runs from (14,18) at the
 *     top down-and-LEFT to (0,62), so the tail's bottom point sits left of its
 *     top point. A vertical cut reads as a chopped-off rectangle.
 *  2. CREST — the top edge rises to a peak at ~46% along, then FALLS to the
 *     tip. The tip is not the highest point; it sits level with the tail. That
 *     fall is what makes the mark read as a wave rather than a swoosh.
 *  3. TIP — the lower edge leaves it steeply down-left (control at 74,41),
 *     hooking the point rather than tapering symmetrically into it.
 *  4. BODY — ~71% of the blade's height at mid-span, matching the reference.
 *     Early versions were far too lean; the first diagonal-tail draft
 *     overcorrected to 79%.
 *
 * Control points sit above y=0 (-5, -11) because they are not on the curve —
 * a cubic travels only about a quarter of the way toward them. Gentler values
 * left the crest at y≈8.5, which made every blade render short.
 */
const BLADE = 'M14 18 C 24 -5 62 -11 100 30 C 74 41 32 49 0 62 Z'

/**
 * The three-blade swoosh.
 *
 * Blades grow DOWNWARD — smallest at top-left, largest at bottom — and their
 * aspect flattens as they shrink, so each gets its own x/y scale rather than a
 * uniform one. Transforms are traced from the brand mark; the bounding boxes
 * of adjacent blades overlap while the shapes do not, which is what produces
 * the interlocking negative space.
 *
 * All three are SOLID: the real mark has no opacity fade.
 * Decorative; always paired with the text wordmark.
 */
export function TeletalkMark({ size = 96 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="currentColor">
        <g transform="translate(13.6 4.4) scale(0.345 0.2935)">
          <path d={BLADE} />
        </g>
        <g transform="translate(29.1 19.0) scale(0.549 0.5484)">
          <path d={BLADE} />
        </g>
        <g transform="translate(23.6 49.8) scale(0.636 0.7339)">
          <path d={BLADE} />
        </g>
      </g>
    </svg>
  )
}

/**
 * The gold filigree burst from the brand plate. Purely decorative — gold on
 * green is 3.7:1 and must never carry text.
 */
export function BrandSpark({ size = 220 }: { size?: number }) {
  const rays = [
    [50, 50, 6, 4],
    [50, 50, 22, 0],
    [50, 50, 40, 2],
    [50, 50, 56, 10],
    [50, 50, 68, 24],
    [50, 50, 74, 42],
    [50, 50, 72, 60],
    [50, 50, 62, 76],
    [50, 50, 46, 86],
    [50, 50, 28, 90],
    [50, 50, 10, 88],
  ] as const

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="tt-spark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F7E3A1" />
          <stop offset="55%" stopColor="#D8B45C" />
          <stop offset="100%" stopColor="#B8912F" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <g stroke="url(#tt-spark)" strokeWidth="0.7" strokeLinecap="round">
        {rays.map(([x1, y1, x2, y2], i) => (
          <path key={i} d={`M${x1} ${y1} Q ${(x1 + x2) / 2 - 4} ${(y1 + y2) / 2} ${x2} ${y2}`} />
        ))}
      </g>
      <g fill="url(#tt-spark)">
        {rays.map(([, , x2, y2], i) => (
          <circle key={i} cx={x2} cy={y2} r={i % 3 === 0 ? 1.5 : 0.9} />
        ))}
      </g>
    </svg>
  )
}

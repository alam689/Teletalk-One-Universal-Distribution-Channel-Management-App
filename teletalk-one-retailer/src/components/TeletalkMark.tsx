import Svg, { G, Path } from 'react-native-svg'

/**
 * The three-blade Teletalk swoosh, ported from the portal's `TeletalkMark`.
 *
 * NOTE FOR HANDOVER: this is a hand-drawn approximation, not the official
 * asset. Replace the paths with the real SVG from Brand/Corporate Affairs
 * before anything ships externally — the proportions here are close, not
 * exact. The portal carries the identical caveat against the identical paths.
 */

/**
 * One blade, drawn at the origin spanning 100 × 62 local units.
 *
 * Four features, each of which the portal got wrong at least once:
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
 */
const BLADE = 'M14 18 C 24 -5 62 -11 100 30 C 74 41 32 49 0 62 Z'

/**
 * Blades grow DOWNWARD — smallest at top-left, largest at bottom — and their
 * aspect flattens as they shrink, so each gets its own x/y scale rather than a
 * uniform one. The bounding boxes of adjacent blades overlap while the shapes
 * do not, which is what produces the interlocking negative space.
 *
 * Decorative, and always paired with the wordmark beside it.
 */
export function TeletalkMark({ size = 96, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <G fill={color}>
        <G transform="translate(13.6 4.4) scale(0.345 0.2935)">
          <Path d={BLADE} />
        </G>
        <G transform="translate(29.1 19.0) scale(0.549 0.5484)">
          <Path d={BLADE} />
        </G>
        <G transform="translate(23.6 49.8) scale(0.636 0.7339)">
          <Path d={BLADE} />
        </G>
      </G>
    </Svg>
  )
}

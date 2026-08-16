import Svg, { Path } from 'react-native-svg'

/**
 * Duotone icon set — the portal's glyphs, drawn with `react-native-svg`.
 *
 * Each glyph is a filled MASS plus stroked DETAIL. The mass is what makes a SIM
 * read as a SIM rather than as a wireframe at 22px on a counter phone in
 * daylight — line-only icons of this size all collapse into the same grey
 * scribble. The path data is copied from the web set unchanged, because the two
 * apps have to look like one product.
 *
 * RN has no `currentColor`, so the colour is an explicit prop. Every caller
 * passes a theme token; nothing passes a hex.
 */

interface Glyph {
  /** Filled silhouette, rendered under the linework at low opacity. */
  fill?: string
  /** Stroked detail on top. */
  line: string
}

const G = {
  // --- SIM & customer -------------------------------------------------
  sim: { fill: 'M7 3h6l4 4v14H7z', line: 'M7 3h6l4 4v14H7z M11 11h6 M11 15h6 M11 7h2' },
  simSwap: { fill: 'M6 3h6l4 4v6H6z', line: 'M6 3h6l4 4v6H6z M10 7h2 M4 18h11 M12 15l3 3-3 3' },
  number: {
    fill: 'M4 4h16v16H4z',
    line: 'M4 4h16v16H4z M4 9.5h16 M4 14.5h16 M10 4.5l-1 15 M16 4.5l-1 15',
  },
  search: {
    fill: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z',
    line: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M20 20l-4.5-4.5',
  },
  person: {
    fill: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 3.6-6 8-6s8 2 8 6z',
    line: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M4 21c0-4 3.6-6 8-6s8 2 8 6',
  },

  // --- MNP ------------------------------------------------------------
  portIn: { fill: 'M4 4h3v16H4z', line: 'M20 12H9 M13 7l-4 5 4 5 M4 4v16' },
  portOut: { fill: 'M17 4h3v16h-3z', line: 'M4 12h11 M11 7l4 5-4 5 M20 4v16' },
  clock: {
    fill: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    line: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5.3l3.2 2',
  },

  // --- Recharge & sales ------------------------------------------------
  bolt: { fill: 'M13 3L5 13h6l-1 8 8-10h-6z', line: 'M13 3L5 13h6l-1 8 8-10h-6z' },
  card: { fill: 'M3 6h18v12H3z', line: 'M3 6h18v12H3z M3 10.5h18 M6.5 14.5h4' },
  box: {
    fill: 'M4 8l8-4 8 4v9l-8 4-8-4z',
    line: 'M4 8l8-4 8 4v9l-8 4-8-4z M4 8l8 4 8-4 M12 12v9',
  },

  // --- Stock ------------------------------------------------------------
  boxes: {
    fill: 'M3 4h7v7H3z M14 4h7v7h-7z M3 13h7v7H3z M14 13h7v7h-7z',
    line: 'M3 4h7v7H3z M14 4h7v7h-7z M3 13h7v7H3z M14 13h7v7h-7z',
  },
  truck: {
    fill: 'M3 7h11v9H3z M14 10h4l3 3v3h-7z',
    line: 'M3 7h11v9H3z M14 10h4l3 3v3h-7z M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4 M18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  },
  return: {
    fill: 'M4 9h11a5 5 0 0 1 0 10H9v-3h6a2 2 0 0 0 0-4H4z',
    line: 'M4 9h11a5 5 0 0 1 0 10H9 M8 5L4 9l4 4',
  },
  list: {
    fill: 'M8 5h13v2H8z M8 11h13v2H8z M8 17h13v2H8z',
    line: 'M8 6h13 M8 12h13 M8 18h13 M3.5 6h.01 M3.5 12h.01 M3.5 18h.01',
  },
  check: {
    fill: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    line: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M8 12.2l2.7 2.8L16 9.5',
  },
  invoice: { fill: 'M6 3h9l3 3v15H6z', line: 'M6 3h9l3 3v15H6z M15 3v3h3 M9 10h6 M9 14h6 M9 18h4' },

  // --- Money ------------------------------------------------------------
  coin: {
    fill: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    line: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 6.6v10.8 M14.8 9.8c0-1.3-1.3-2.3-2.8-2.3s-2.8.9-2.8 2.1 1.2 1.8 2.8 2.1 2.8.8 2.8 2.1-1.3 2.3-2.8 2.3-2.8-1-2.8-2.3',
  },
  wallet: {
    fill: 'M3 7h17a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H3z',
    line: 'M3 7h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3z M3 7V5h13 M17 13h.02',
  },
  chart: {
    fill: 'M7 12h3v6H7z M11.5 8h3v10h-3z M16 14h3v4h-3z',
    line: 'M4 20V4 M4 20h16 M8 18v-5 M12.5 18V9 M17 18v-3',
  },
  target: {
    fill: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    line: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9 M12 11.4v1.2',
  },

  // --- Campaign & support ------------------------------------------------
  megaphone: {
    fill: 'M4 10v4h4l7 4V6l-7 4z',
    line: 'M4 10v4h4l7 4V6l-7 4z M18 9.2a3.6 3.6 0 0 1 0 5.6 M7 14.5V19',
  },
  gift: {
    fill: 'M3 11h18v9H3z',
    line: 'M3 11h18v9H3z M2.5 7h19v4h-19z M12 7v13 M12 7C9 7 7 3.2 9.6 3.2S12 7 12 7 M12 7c3 0 5-3.8 2.4-3.8S12 7 12 7',
  },
  ticket: {
    fill: 'M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z',
    line: 'M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z M14 7v10',
  },
  bell: {
    fill: 'M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z',
    line: 'M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6 M10 19.2a2.2 2.2 0 0 0 4 0',
  },
  help: {
    fill: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    line: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M9.6 9.5a2.5 2.5 0 0 1 4.6 1.3c0 1.7-2.2 2-2.2 3.4 M12 17.2h.02',
  },
  store: { fill: 'M4 9h16v11H4z', line: 'M4 9h16v11H4z M3 9l1.6-5h14.8L21 9 M9 20v-6h6v6' },

  // --- Chrome ------------------------------------------------------------
  home: {
    fill: 'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
    line: 'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  },
  grid: {
    fill: 'M4 4h6.5v6.5H4z M13.5 4H20v6.5h-6.5z M4 13.5h6.5V20H4z M13.5 13.5H20V20h-6.5z',
    line: 'M4 4h6.5v6.5H4z M13.5 4H20v6.5h-6.5z M4 13.5h6.5V20H4z M13.5 13.5H20V20h-6.5z',
  },
  /* Each theme glyph shows the theme you will GET, not the one you are in — a
     moon on a light screen means "go dark", the convention every OS uses. */
  moon: {
    fill: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z',
    line: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z',
  },
  sun: {
    fill: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    line: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M19.1 4.9l-1.4 1.4 M6.3 17.7l-1.4 1.4',
  },
  globe: {
    fill: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    line: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M3 12h18 M12 3c2.5 2.6 2.5 15.4 0 18 M12 3c-2.5 2.6-2.5 15.4 0 18',
  },
  lock: { fill: 'M6 11h12v9H6z', line: 'M6 11h12v9H6z M9 11V8.2a3 3 0 0 1 6 0V11 M12 14.6v2.2' },
  chevron: { line: 'M9.5 6l6 6-6 6' },
  back: { line: 'M14.5 6l-6 6 6 6' },
  logout: { fill: 'M6 4h8v16H6z', line: 'M14 4H6v16h8 M11 12h10 M18 8l3.2 4-3.2 4' },
  key: {
    fill: 'M15 3a6 6 0 1 0 0 12 6 6 0 0 0 0-12z',
    line: 'M15 3a6 6 0 1 0-4.2 10.2L4 20v3h3l1-1v-2h2v-2h2l1.8-1.8A6 6 0 0 0 15 3 M16.6 7.4h.02',
  },
  user: {
    fill: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 3.6-6 8-6s8 2 8 6z',
    line: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M4 21c0-4 3.6-6 8-6s8 2 8 6',
  },
  shield: {
    fill: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    line: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12.2l2.2 2.3L15.5 10',
  },
  /** Queued, not sent. The cloud with the up arrow, not a tick. */
  cloud: {
    fill: 'M7 19h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.5 1.4A3.5 3.5 0 0 0 7 19z',
    line: 'M7 19h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.5 1.4A3.5 3.5 0 0 0 7 19 M12 16.5v-6 M9.5 13l2.5-2.5 2.5 2.5',
  },
  alert: {
    fill: 'M12 3.5L22 20H2z',
    line: 'M12 3.5L22 20H2z M12 9.5v4.2 M12 17h.02',
  },
  plus: { line: 'M12 5v14 M5 12h14' },
  close: { line: 'M6 6l12 12 M18 6L6 18' },
  refresh: {
    line: 'M20 12a8 8 0 1 1-2.3-5.6 M20 4v4.5h-4.5',
  },
} satisfies Record<string, Glyph>

export type IconName = keyof typeof G

/** `M`-separated subpaths. RN's Path takes one `d` each. */
function paths(d: string): string[] {
  return d.split(' M').map((seg, i) => (i === 0 ? seg : `M${seg}`))
}

export interface IconProps {
  name: IconName
  size?: number
  /** A theme token. There is no `currentColor` here, so it is always explicit. */
  color: string
}

export function Icon({ name, size = 22, color }: IconProps) {
  const glyph: Glyph = G[name]
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {glyph.fill
        ? paths(glyph.fill).map((d, i) => (
            <Path key={`f${i}`} d={d} fill={color} fillOpacity={0.18} />
          ))
        : null}
      {paths(glyph.line).map((d, i) => (
        <Path
          key={`l${i}`}
          d={d}
          stroke={color}
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  )
}

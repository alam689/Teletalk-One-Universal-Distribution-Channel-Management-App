/**
 * Duotone icon set.
 *
 * Each glyph is a filled MASS plus stroked DETAIL. The mass is what makes a
 * SIM read as a SIM rather than as a wireframe at 22px on a counter phone in
 * daylight — line-only icons of this size all collapse into the same grey
 * scribble. The mass inherits `currentColor` at low alpha, so a single colour
 * per category still drives both layers.
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
  number: { fill: 'M4 4h16v16H4z', line: 'M4 4h16v16H4z M4 9.5h16 M4 14.5h16 M10 4.5l-1 15 M16 4.5l-1 15' },
  transfer: { fill: 'M4 6h13v4H4z M7 14h13v4H7z', line: 'M4 8h13l-3-3 M20 16H7l3 3' },
  migrate: { fill: 'M8 12h8l-4-6z', line: 'M12 21V6 M6 12l6-6 6 6' },
  search: { fill: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', line: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M20 20l-4.5-4.5' },
  person: { fill: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 3.6-6 8-6s8 2 8 6z', line: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M4 21c0-4 3.6-6 8-6s8 2 8 6' },

  // --- MNP ------------------------------------------------------------
  portIn: { fill: 'M4 4h3v16H4z', line: 'M20 12H9 M13 7l-4 5 4 5 M4 4v16' },
  portOut: { fill: 'M17 4h3v16h-3z', line: 'M4 12h11 M11 7l4 5-4 5 M20 4v16' },
  clock: { fill: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', line: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5.3l3.2 2' },

  // --- Recharge & sales ------------------------------------------------
  bolt: { fill: 'M13 3L5 13h6l-1 8 8-10h-6z', line: 'M13 3L5 13h6l-1 8 8-10h-6z' },
  card: { fill: 'M3 6h18v12H3z', line: 'M3 6h18v12H3z M3 10.5h18 M6.5 14.5h4' },
  box: { fill: 'M4 8l8-4 8 4v9l-8 4-8-4z', line: 'M4 8l8-4 8 4v9l-8 4-8-4z M4 8l8 4 8-4 M12 12v9' },

  // --- Stock ------------------------------------------------------------
  boxes: { fill: 'M3 4h7v7H3z M14 4h7v7h-7z M3 13h7v7H3z M14 13h7v7h-7z', line: 'M3 4h7v7H3z M14 4h7v7h-7z M3 13h7v7H3z M14 13h7v7h-7z' },
  truck: { fill: 'M3 7h11v9H3z M14 10h4l3 3v3h-7z', line: 'M3 7h11v9H3z M14 10h4l3 3v3h-7z M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4 M18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4' },
  return: { fill: 'M4 9h11a5 5 0 0 1 0 10H9v-3h6a2 2 0 0 0 0-4H4z', line: 'M4 9h11a5 5 0 0 1 0 10H9 M8 5L4 9l4 4' },
  list: { fill: 'M8 5h13v2H8z M8 11h13v2H8z M8 17h13v2H8z', line: 'M8 6h13 M8 12h13 M8 18h13 M3.5 6h.01 M3.5 12h.01 M3.5 18h.01' },
  check: { fill: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', line: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M8 12.2l2.7 2.8L16 9.5' },

  // --- Lifting & distribution -------------------------------------------
  invoice: { fill: 'M6 3h9l3 3v15H6z', line: 'M6 3h9l3 3v15H6z M15 3v3h3 M9 10h6 M9 14h6 M9 18h4' },
  route: { fill: 'M6 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M18 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', line: 'M6 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5 M18 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5 M18 9v3a4 4 0 0 1-4 4h-4a4 4 0 0 0-4 4' },
  bank: { fill: 'M3 9.5h18v9H3z', line: 'M3 10h18 M6 10v8 M10 10v8 M14 10v8 M18 10v8 M2.5 20.5h19 M12 3.2l9 5.3H3z' },
  scale: { fill: 'M2 14l2-5 2 5z M18 14l2-5 2 5z', line: 'M12 4v16 M6 20.5h12 M4 9h16 M4 9l-2 5h4z M20 9l-2 5h4z M12 4.5l-8 4 M12 4.5l8 4' },

  // --- Finance ----------------------------------------------------------
  coin: { fill: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', line: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 6.6v10.8 M14.8 9.8c0-1.3-1.3-2.3-2.8-2.3s-2.8.9-2.8 2.1 1.2 1.8 2.8 2.1 2.8.8 2.8 2.1-1.3 2.3-2.8 2.3-2.8-1-2.8-2.3' },
  wallet: { fill: 'M3 7h17a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H3z', line: 'M3 7h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3z M3 7V5h13 M17 13h.02' },

  // --- Reporting ---------------------------------------------------------
  chart: { fill: 'M7 12h3v6H7z M11.5 8h3v10h-3z M16 14h3v4h-3z', line: 'M4 20V4 M4 20h16 M8 18v-5 M12.5 18V9 M17 18v-3' },
  target: { fill: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', line: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9 M12 11.4v1.2' },

  // --- Campaign & service -------------------------------------------------
  megaphone: { fill: 'M4 10v4h4l7 4V6l-7 4z', line: 'M4 10v4h4l7 4V6l-7 4z M18 9.2a3.6 3.6 0 0 1 0 5.6 M7 14.5V19' },
  gift: { fill: 'M3 11h18v9H3z', line: 'M3 11h18v9H3z M2.5 7h19v4h-19z M12 7v13 M12 7C9 7 7 3.2 9.6 3.2S12 7 12 7 M12 7c3 0 5-3.8 2.4-3.8S12 7 12 7' },
  ticket: { fill: 'M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z', line: 'M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z M14 7v10' },
  bell: { fill: 'M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z', line: 'M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6 M10 19.2a2.2 2.2 0 0 0 4 0' },
  help: { fill: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', line: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M9.6 9.5a2.5 2.5 0 0 1 4.6 1.3c0 1.7-2.2 2-2.2 3.4 M12 17.2h.02' },

  // --- Channel ------------------------------------------------------------
  store: { fill: 'M4 9h16v11H4z', line: 'M4 9h16v11H4z M3 9l1.6-5h14.8L21 9 M9 20v-6h6v6' },
  users: { fill: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5z', line: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7 M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5 M16.5 5.2a3 3 0 0 1 0 6.6 M18 14.6c2.5.6 4 2.4 4 5' },
  map: { fill: 'M3 6l6-2v14l-6 2z M15 6l6-2v14l-6 2z', line: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z M9 4v14 M15 6v14' },
  pin: { fill: 'M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z', line: 'M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11 M12 12.4a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5' },
  poster: { fill: 'M4 4h16v12H4z', line: 'M4 4h16v12H4z M12 16v5 M8 21h8 M8 8h8 M8 11.4h5' },
  device: { fill: 'M7 3h10v18H7z', line: 'M7 3h10v18H7z M10.5 18.4h3 M9.6 6.6h4.8' },

  // --- Chrome --------------------------------------------------------------
  home: { fill: 'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z', line: 'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z' },
  grid: { fill: 'M4 4h6.5v6.5H4z M13.5 4H20v6.5h-6.5z M4 13.5h6.5V20H4z M13.5 13.5H20V20h-6.5z', line: 'M4 4h6.5v6.5H4z M13.5 4H20v6.5h-6.5z M4 13.5h6.5V20H4z M13.5 13.5H20V20h-6.5z' },
  contrast: { fill: 'M12 3v18a9 9 0 0 0 0-18z', line: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 3v18' },
  /* Theme toggle. Each one shows the theme you will GET, not the one you are
     in — a moon on a light screen means "go dark", which is the convention
     every OS uses. */
  moon: {
    fill: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z',
    line: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z',
  },
  sun: {
    fill: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    line: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M19.1 4.9l-1.4 1.4 M6.3 17.7l-1.4 1.4',
  },
  globe: { fill: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', line: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M3 12h18 M12 3c2.5 2.6 2.5 15.4 0 18 M12 3c-2.5 2.6-2.5 15.4 0 18' },
  lock: { fill: 'M6 11h12v9H6z', line: 'M6 11h12v9H6z M9 11V8.2a3 3 0 0 1 6 0V11 M12 14.6v2.2' },
  chevron: { line: 'M9.5 6l6 6-6 6' },
  logout: { fill: 'M6 4h8v16H6z', line: 'M14 4H6v16h8 M11 12h10 M18 8l3.2 4-3.2 4' },
  key: { fill: 'M15 3a6 6 0 1 0 0 12 6 6 0 0 0 0-12z', line: 'M15 3a6 6 0 1 0-4.2 10.2L4 20v3h3l1-1v-2h2v-2h2l1.8-1.8A6 6 0 0 0 15 3 M16.6 7.4h.02' },
  user: { fill: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 3.6-6 8-6s8 2 8 6z', line: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M4 21c0-4 3.6-6 8-6s8 2 8 6' },
  shield: { fill: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', line: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12.2l2.2 2.3L15.5 10' },
} satisfies Record<string, Glyph>

export type IconName = keyof typeof G

function paths(d: string) {
  return d.split(' M').map((seg, i) => (i === 0 ? seg : `M${seg}`))
}

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const glyph: Glyph = G[name]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {glyph.fill &&
        paths(glyph.fill).map((d, i) => (
          <path key={`f${i}`} d={d} fill="currentColor" opacity="0.18" />
        ))}
      {paths(glyph.line).map((d, i) => (
        <path
          key={`l${i}`}
          d={d}
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}

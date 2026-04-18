// ============================================================
//  YobaleemaLogo — Reproduction fidèle du logo SVG
//  Props: size (number), variant ('dark' | 'light' | 'mono')
// ============================================================

export default function YobaleemaLogo({ size = 38, variant = 'dark', textSize = 22 }) {
  const brown      = variant === 'light' ? '#C8630A' : '#8B3A00'
  const brownMid   = variant === 'light' ? '#A34800' : '#A34800'
  const brownLight = variant === 'light' ? '#E8A855' : '#C8630A'
  const textColor  = variant === 'light' ? '#C8630A' : '#8B3A00'
  const subColor   = variant === 'light' ? 'rgba(250,245,240,0.7)' : '#1E1C1A'

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      {/* Icône SVG — deux cubes liés avec flèche montante */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Cube bas-gauche */}
        <g transform="translate(1,17) rotate(-15)">
          {/* Face principale */}
          <rect x="0" y="0" width="11" height="11" rx="1.5" fill={brown} />
          {/* Face supérieure (plus claire) */}
          <rect x="0" y="0" width="11" height="3.5" rx="1" fill={brownMid} />
          {/* Face latérale droite (plus claire) */}
          <rect x="7.5" y="0" width="3.5" height="11" rx="1" fill={brownLight} />
          {/* Lignes de ruban */}
          <line x1="0" y1="5.5" x2="11" y2="5.5" stroke={brownMid} strokeWidth="0.8" opacity="0.5" />
          <line x1="5.5" y1="0" x2="5.5" y2="11" stroke={brownMid} strokeWidth="0.8" opacity="0.5" />
        </g>

        {/* Connecteur entre les deux cubes */}
        <line
          x1="14.5" y1="19.5"
          x2="20"   y2="13"
          stroke={brown}
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Cube haut-droit */}
        <g transform="translate(18,4) rotate(-15)">
          <rect x="0" y="0" width="11" height="11" rx="1.5" fill={brown} />
          <rect x="0" y="0" width="11" height="3.5" rx="1" fill={brownMid} />
          <rect x="7.5" y="0" width="3.5" height="11" rx="1" fill={brownLight} />
          <line x1="0" y1="5.5" x2="11" y2="5.5" stroke={brownMid} strokeWidth="0.8" opacity="0.5" />
          <line x1="5.5" y1="0" x2="5.5" y2="11" stroke={brownMid} strokeWidth="0.8" opacity="0.5" />
        </g>

        {/* Flèche montante */}
        <line x1="27" y1="8" x2="27" y2="1.5" stroke={brown} strokeWidth="2.5" strokeLinecap="round" />
        <polyline
          points="23.5,5 27,1.5 30.5,5"
          fill="none"
          stroke={brown}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Texte YOBALEEMA */}
      <span
        style={{
          fontFamily: '"Barlow Condensed", sans-serif',
          fontWeight: 700,
          fontSize: textSize,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: textColor,
          lineHeight: 1,
        }}
      >
        YOBA<span style={{ color: subColor }}>LEEMA</span>
      </span>
    </div>
  )
}

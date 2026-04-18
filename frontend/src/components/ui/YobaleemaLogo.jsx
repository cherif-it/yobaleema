// ================================================================
//  YobaleemaLogo.jsx — SVG fidèle au logo Yobaleema
// ================================================================
export default function YobaleemaLogo({ size = 36, textSize = 21, variant = 'dark' }) {
  const b  = variant === 'light' ? '#C8630A' : '#8B3A00'
  const bm = '#A34800'
  const bl = variant === 'light' ? '#E8A855' : '#C8630A'
  const tc = variant === 'light' ? '#C8630A' : '#8B3A00'
  const sc = variant === 'light' ? 'rgba(250,245,240,0.75)' : '#1E1C1A'

  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:10 }}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden>
        <g transform="translate(1,17) rotate(-15)">
          <rect x="0" y="0" width="11" height="11" rx="1.5" fill={b}/>
          <rect x="0" y="0" width="11" height="3.5" rx="1" fill={bm}/>
          <rect x="7.5" y="0" width="3.5" height="11" rx="1" fill={bl}/>
          <line x1="0" y1="5.5" x2="11" y2="5.5" stroke={bm} strokeWidth="0.8" opacity="0.5"/>
          <line x1="5.5" y1="0" x2="5.5" y2="11" stroke={bm} strokeWidth="0.8" opacity="0.5"/>
        </g>
        <line x1="14.5" y1="19.5" x2="20" y2="13" stroke={b} strokeWidth="2.5" strokeLinecap="round"/>
        <g transform="translate(18,4) rotate(-15)">
          <rect x="0" y="0" width="11" height="11" rx="1.5" fill={b}/>
          <rect x="0" y="0" width="11" height="3.5" rx="1" fill={bm}/>
          <rect x="7.5" y="0" width="3.5" height="11" rx="1" fill={bl}/>
          <line x1="0" y1="5.5" x2="11" y2="5.5" stroke={bm} strokeWidth="0.8" opacity="0.5"/>
          <line x1="5.5" y1="0" x2="5.5" y2="11" stroke={bm} strokeWidth="0.8" opacity="0.5"/>
        </g>
        <line x1="27" y1="8" x2="27" y2="1.5" stroke={b} strokeWidth="2.5" strokeLinecap="round"/>
        <polyline points="23.5,5 27,1.5 30.5,5" fill="none" stroke={b} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span style={{ fontFamily:'"Barlow Condensed",sans-serif', fontWeight:700, fontSize:textSize, letterSpacing:'0.14em', textTransform:'uppercase', color:tc, lineHeight:1 }}>
        YOBA<span style={{ color:sc }}>LEEMA</span>
      </span>
    </div>
  )
}

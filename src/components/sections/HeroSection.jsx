import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import Reveal from '@/components/ui/Reveal'

// ============================================================
//  HeroSection — Section hero page d'accueil
// ============================================================

function FloatingCard({ className, children, delay = 0 }) {
  return (
    <motion.div
      className={`absolute bg-yoba-white rounded-xl p-4 shadow-card-lg z-10 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6 }}
    >
      {children}
    </motion.div>
  )
}

// SVG logo animé intégré dans le hero droit
function RouteAnimation() {
  return (
    <svg
      viewBox="0 0 300 420"
      fill="none"
      className="relative z-[3] w-[75%] max-w-[340px]"
    >
      {/* Ville départ */}
      <circle cx="150" cy="50"  r="9"  fill="#E8A855" />
      <circle cx="150" cy="50"  r="20" fill="#E8A855" opacity=".18" />
      <circle cx="150" cy="50"  r="32" fill="#E8A855" opacity=".07" />
      {/* Ville arrivée */}
      <circle cx="150" cy="370" r="9"  fill="rgba(255,255,255,0.9)" />
      <circle cx="150" cy="370" r="20" fill="rgba(255,255,255,0.15)" />
      {/* Relais */}
      <circle cx="90"  cy="180" r="5"  fill="rgba(255,255,255,0.4)" />
      <circle cx="210" cy="270" r="5"  fill="rgba(255,255,255,0.4)" />
      {/* Route fond */}
      <path
        d="M150 50 C165 110 105 145 90 180 C70 220 140 250 210 270 C240 280 200 330 150 370"
        stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeDasharray="6 5"
      />
      {/* Route animée */}
      <path
        id="rp"
        d="M150 50 C165 110 105 145 90 180 C70 220 140 250 210 270 C240 280 200 330 150 370"
        stroke="#E8A855" strokeWidth="2.5" strokeDasharray="36 280" strokeLinecap="round"
      >
        <animate attributeName="stroke-dashoffset" from="0" to="-316" dur="2.8s" repeatCount="indefinite" />
      </path>
      {/* Colis animé */}
      <g>
        <animateMotion dur="2.8s" repeatCount="indefinite">
          <mpath href="#rp" />
        </animateMotion>
        <rect x="-9" y="-9" width="18" height="18" rx="4" fill="#C8630A" />
        <rect x="-9" y="-9" width="18" height="5"  rx="2" fill="#A34800" />
        <line x1="-9" y1="-4" x2="9"  y2="-4" stroke="#8B3A00" strokeWidth="1" />
        <line x1="0"  y1="-9" x2="0"  y2="9"  stroke="#8B3A00" strokeWidth="1" />
      </g>
      {/* Labels */}
      <text x="168" y="54"  fill="rgba(255,255,255,0.9)" fontSize="12" fontFamily="Barlow Condensed,sans-serif" fontWeight="700">PARIS</text>
      <text x="168" y="374" fill="rgba(255,255,255,0.8)" fontSize="12" fontFamily="Barlow Condensed,sans-serif" fontWeight="700">LYON</text>
      <text x="95"  y="176" fill="rgba(255,255,255,0.5)" fontSize="10" fontFamily="Barlow,sans-serif">Orléans</text>
      <text x="215" y="266" fill="rgba(255,255,255,0.5)" fontSize="10" fontFamily="Barlow,sans-serif">Mâcon</text>
    </svg>
  )
}

export default function HeroSection() {
  return (
    <section className="min-h-screen grid" style={{ gridTemplateColumns: '55% 45%' }}>

      {/* ── Gauche ── */}
      <div
        className="relative flex flex-col justify-center bg-yoba-white
                   px-20 pb-20 grid-pattern"
        style={{ paddingTop: 140 }}
      >
        {/* Fond grille */}
        <div className="absolute inset-0 pointer-events-none grid-pattern" />

        <Reveal delay={0}>
          <div className="section-label mb-7">Covoiturage de colis</div>
        </Reveal>

        <Reveal delay={0.1}>
          <h1
            className="font-condensed font-extrabold uppercase text-yoba-charcoal mb-8 leading-[0.95]"
            style={{ fontSize: 'clamp(52px,6vw,88px)', letterSpacing: '-0.01em' }}
          >
            Vos colis<br />
            <em className="not-italic text-brown-light">voyagent</em><br />
            autrement
          </h1>
        </Reveal>

        <Reveal delay={0.2}>
          <p className="section-desc mb-12">
            Yobaleema met en relation expéditeurs et particuliers qui font déjà le trajet.
            Jusqu'à 3× moins cher, livré de main en main.
          </p>
        </Reveal>

        <Reveal delay={0.3}>
          <div className="flex items-center gap-5 flex-wrap mb-16">
            <Link to="/envoyer" className="btn-primary">
              Envoyer un colis →
            </Link>
            <a href="#fonctionnement" className="btn-outline">
              Voir comment ↓
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.4}>
          <div className="flex gap-12 pt-10 border-t border-brown/10">
            {[
              { num: '12K+',  lbl: 'Colis livrés' },
              { num: '4,8★',  lbl: 'Note moyenne' },
              { num: '−65%',  lbl: 'vs La Poste'  },
            ].map(s => (
              <div key={s.lbl}>
                <div
                  className="font-condensed font-extrabold text-brown leading-none mb-1"
                  style={{ fontSize: 40, letterSpacing: '-0.02em' }}
                >
                  {s.num}
                </div>
                <div className="text-2xs font-bold tracking-[0.08em] uppercase text-yoba-gray-dark">
                  {s.lbl}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      {/* ── Droite ── */}
      <div className="relative bg-brown overflow-hidden flex items-center justify-center">
        {/* Dot pattern */}
        <div className="absolute inset-0 dot-pattern" />

        {/* Grand Y en fond */}
        <div
          className="absolute right-[-40px] top-1/2 -translate-y-[55%]
                     font-condensed font-extrabold leading-none pointer-events-none select-none"
          style={{ fontSize: 500, color: 'rgba(255,255,255,0.04)' }}
        >
          Y
        </div>

        {/* Carte flottante haut */}
        <FloatingCard className="top-[16%] left-[5%] animate-float-a" delay={0.6}>
          <p className="text-2xs font-bold tracking-widest uppercase text-yoba-gray-dark">
            Trajet disponible
          </p>
          <p className="text-sm font-bold text-yoba-charcoal mt-1">Paris → Lyon</p>
          <div className="flex gap-3 items-center mt-1.5">
            <span className="text-xs text-yoba-gray-dark">Demain · 14h</span>
            <span className="text-xs font-extrabold text-brown">18 €</span>
          </div>
          <div className="inline-flex items-center gap-1.5 mt-2 bg-brown-pale text-brown
                          text-[10px] font-bold px-2.5 py-1 rounded-full">
            <span className="text-[6px] animate-blink">●</span>
            En route
          </div>
        </FloatingCard>

        {/* Animation route SVG */}
        <RouteAnimation />

        {/* Carte flottante bas */}
        <FloatingCard className="bottom-[16%] right-[5%] animate-float-b" delay={0.8}>
          <p className="text-2xs font-bold tracking-widest uppercase text-yoba-gray-dark">
            Livraison confirmée ✓
          </p>
          <p className="text-sm font-bold text-yoba-charcoal mt-1">Reçu par Aminata K.</p>
          <p className="text-brown-light text-sm mt-1">★★★★★</p>
          <p className="text-xs text-yoba-gray-dark">"Super rapide et soigneux !"</p>
        </FloatingCard>
      </div>
    </section>
  )
}

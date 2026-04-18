import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import Reveal from '@/components/ui/Reveal'

// ============================================================
//  TrustBar
// ============================================================
export function TrustBar() {
  const items = [
    { icon: '🔒', text: 'Paiement sécurisé & séquestre' },
    { icon: '🛡️', text: 'Assurance colis jusqu\'à 500 €' },
    { icon: '🪪', text: 'Identité vérifiée pour tous' },
    { icon: '🌿', text: '−72 % d\'émissions CO₂' },
    { icon: '⚡', text: 'Matching en moins de 4 h' },
  ]
  return (
    <div className="flex items-center justify-between gap-6 flex-wrap overflow-x-auto
                    bg-brown-pale border-y border-brown/15 px-20 py-4"
         style={{ padding: '14px 80px' }}>
      {items.map(item => (
        <div key={item.text} className="trust-item">
          <span className="text-lg">{item.icon}</span>
          <span className="text-xs font-bold tracking-[0.04em] text-brown">{item.text}</span>
        </div>
      ))}
    </div>
  )
}

// ============================================================
//  HowItWorksSection
// ============================================================
const STEPS = [
  {
    num: '01',
    title: 'Décrivez votre colis',
    desc: 'Dimensions, poids, destination et plage horaire. Ajoutez des photos pour rassurer le transporteur.',
    screen: (
      <div className="p-3.5">
        <p className="text-[10px] font-extrabold text-brown tracking-widest uppercase mb-3">📦 Nouveau colis</p>
        {[['Départ','Paris, 75011'],['Arrivée','Lyon, 69001'],['Dimensions','40×30×20 cm · 5 kg'],['Valeur','120 €']].map(([l,v]) => (
          <div key={l} className="bg-yoba-gray rounded-lg p-2.5 mb-2">
            <p className="text-[8px] font-bold tracking-widest uppercase text-yoba-gray-dark">{l}</p>
            <p className="text-[11px] font-semibold text-yoba-charcoal mt-0.5">{v}</p>
          </div>
        ))}
        <div className="bg-brown text-white rounded-lg text-center py-2.5 mt-2.5 text-[10px] font-extrabold tracking-widest uppercase">
          Publier mon colis →
        </div>
      </div>
    ),
  },
  {
    num: '02',
    title: 'Recevez des propositions',
    desc: 'Notre algorithme géospatial vous propose des transporteurs vérifiés qui passent déjà par votre trajet.',
    screen: (
      <div className="p-3.5">
        <p className="text-[10px] font-extrabold text-brown tracking-widest uppercase mb-3">✅ 3 transporteurs</p>
        {[
          { init:'TK', bg:'#F0D5B8', color:'#8B3A00', name:'Thomas K.', route:'Demain · 14h', price:'18€' },
          { init:'SB', bg:'#D4E5DE', color:'#2D4A3E', name:'Sophie B.',  route:'Demain · 09h', price:'22€' },
          { init:'MR', bg:'#FAEEDA', color:'#633806', name:'Marc R.',    route:'Après-demain', price:'16€' },
        ].map(c => (
          <div key={c.init} className="bg-white border border-brown/10 rounded-lg p-2.5 mb-1.5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-extrabold flex-shrink-0"
                 style={{ background: c.bg, color: c.color }}>{c.init}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-yoba-charcoal">{c.name} <span className="text-brown-light text-[8px]">★★★★★</span></p>
              <p className="text-[8px] text-yoba-gray-dark truncate">{c.route}</p>
            </div>
            <span className="text-[12px] font-extrabold text-brown">{c.price}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    num: '03',
    title: 'Payez en sécurité',
    desc: 'Les fonds sont bloqués en séquestre jusqu\'à la confirmation de livraison par QR code.',
    screen: (
      <div className="p-3.5">
        <p className="text-[10px] font-extrabold text-brown tracking-widest uppercase mb-3">🔒 Paiement</p>
        {[['Transporteur','Thomas K. ⭐⭐⭐⭐⭐'],['Transport','18,00 € (séquestre)'],['Assurance','+ 2,00 € (option)']].map(([l,v]) => (
          <div key={l} className="bg-yoba-gray rounded-lg p-2.5 mb-2">
            <p className="text-[8px] font-bold tracking-widest uppercase text-yoba-gray-dark">{l}</p>
            <p className="text-[11px] font-semibold text-yoba-charcoal mt-0.5">{v}</p>
          </div>
        ))}
        <div className="bg-brown-pale rounded-lg p-2.5 mt-2 text-[9px] font-bold text-brown">
          🔒 Fonds bloqués jusqu'à livraison confirmée
        </div>
        <div className="bg-brown text-white rounded-lg text-center py-2.5 mt-2.5 text-[10px] font-extrabold tracking-widest uppercase">
          Confirmer — 20,00 €
        </div>
      </div>
    ),
  },
  {
    num: '04',
    title: 'Suivez en temps réel',
    desc: 'GPS live, QR code de remise unique, notifications push à chaque étape clé du trajet.',
    screen: (
      <div className="p-3.5">
        <p className="text-[10px] font-extrabold text-brown tracking-widest uppercase mb-3">📍 En route</p>
        <div className="bg-brown-pale rounded-lg p-2.5 mb-2">
          <p className="text-[8px] font-bold tracking-widest uppercase text-yoba-gray-dark">Statut</p>
          <p className="text-[11px] font-bold text-brown mt-0.5">Thomas est à 87 km</p>
        </div>
        <div className="bg-white border border-brown/10 rounded-lg p-2.5 flex items-center gap-2 mb-3">
          <span className="text-lg">🚗</span>
          <div>
            <p className="text-[10px] font-bold text-yoba-charcoal">ETA 16h30</p>
            <p className="text-[8px] text-yoba-gray-dark">Autoroute A6 · Lyon dans 1h20</p>
          </div>
        </div>
        <div className="flex gap-1">
          {['done','done','now','todo'].map((s,i) => (
            <div key={i} className="flex-1 h-1 rounded-sm"
                 style={{ background: s==='done'?'#8B3A00':s==='now'?'#C8630A':'#C8C5BF' }} />
          ))}
        </div>
        <p className="text-[8px] text-yoba-gray-dark mt-1">Collecté · Pris en charge · En route · Livré</p>
      </div>
    ),
  },
]

export function HowItWorksSection() {
  const [active, setActive] = useState(0)

  return (
    <section id="fonctionnement" className="bg-yoba-white py-24 px-20" style={{ padding: '100px 80px' }}>
      <Reveal><div className="section-label">Comment ça marche</div></Reveal>
      <Reveal delay={0.1}>
        <h2 className="section-title">Simple comme<br /><em>un covoiturage</em></h2>
      </Reveal>
      <Reveal delay={0.2}>
        <p className="section-desc">En quelques minutes, trouvez un transporteur qui fait déjà votre trajet.</p>
      </Reveal>

      <div className="grid gap-20 mt-18" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 72 }}>

        {/* Étapes */}
        <div>
          {STEPS.map((step, i) => (
            <Reveal key={step.num} delay={i * 0.08}>
              <div
                onClick={() => setActive(i)}
                className={`flex gap-6 px-6 py-7 cursor-pointer transition-all duration-250 rounded-r-lg
                  border-l-[3px] mb-1
                  ${active === i
                    ? 'border-brown bg-brown-ultra'
                    : 'border-transparent hover:bg-brown/[0.04]'}`}
              >
                <span
                  className="font-condensed font-extrabold text-5xl leading-none flex-shrink-0 w-14 transition-colors duration-250"
                  style={{ color: active === i ? '#8B3A00' : '#C8C5BF' }}
                >
                  {step.num}
                </span>
                <div>
                  <p className="text-base font-bold text-yoba-charcoal mb-2">{step.title}</p>
                  <p className="text-sm font-light leading-relaxed text-yoba-gray-dark">{step.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Phone mockup */}
        <Reveal delay={0.2}>
          <div className="sticky top-28 bg-yoba-gray rounded-2xl p-10 flex items-center justify-center
                          min-h-[420px] border border-brown/[0.08]">
            <div className="w-[196px] bg-yoba-charcoal rounded-[34px] p-2.5 shadow-phone">
              <div className="bg-yoba-white rounded-[26px] overflow-hidden" style={{ aspectRatio: '9/19' }}>
                <div className="h-6 bg-yoba-charcoal flex items-center justify-center">
                  <div className="w-14 h-4 bg-black rounded-full" />
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                  >
                    {STEPS[active].screen}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ============================================================
//  FeaturesSection
// ============================================================
const FEATURES = [
  {
    icon: '🎯',
    title: 'Matching géospatial',
    desc: 'Notre algorithme PostGIS analyse des centaines de trajets pour trouver celui dont le détour est inférieur à 15 %, avec compatibilité horaire automatique et score de fiabilité intégré.',
    tag: 'Technologie propriétaire',
    featured: true,
  },
  { icon: '🔒', title: 'Séquestre Stripe',      desc: 'Votre argent est bloqué jusqu\'à la livraison confirmée. Libéré automatiquement par QR code.',             tag: 'Stripe Connect' },
  { icon: '📍', title: 'GPS temps réel',         desc: 'Géolocalisation du transporteur, QR code de remise unique, notifications push à chaque étape.' },
  { icon: '🪪', title: 'Identité vérifiée',      desc: 'CNI + selfie obligatoires pour tout transporteur. Vérification Onfido en 2 minutes.' },
  { icon: '💬', title: 'Messagerie sécurisée',   desc: 'Discutez sans exposer votre numéro. Historique conservé pour chaque envoi.' },
  { icon: '⭐', title: 'Double notation',         desc: 'Expéditeurs et transporteurs se notent mutuellement après chaque livraison.' },
  { icon: '🛡️', title: 'Assurance intégrée',    desc: 'Option assurance jusqu\'à 500 € pour 2 € seulement. Remboursement sous 48 h en cas de litige.', tag: 'Optionnelle' },
]

export function FeaturesSection() {
  return (
    <section id="fonctionnalites" className="bg-yoba-gray py-24" style={{ padding: '100px 80px' }}>
      <Reveal><div className="section-label">Fonctionnalités</div></Reveal>
      <Reveal delay={0.1}><h2 className="section-title">Conçu pour<br /><em>la confiance</em></h2></Reveal>
      <Reveal delay={0.2}><p className="section-desc">Chaque détail est pensé pour sécuriser l'expédition de bout en bout.</p></Reveal>

      <div className="grid gap-5 mt-16" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 64 }}>
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.06}>
            {f.featured ? (
              <div className="bg-brown rounded-xl p-8 relative overflow-hidden"
                   style={{ gridRow: 'span 2' }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-6"
                     style={{ background: 'rgba(255,255,255,0.15)' }}>
                  {f.icon}
                </div>
                <h3 className="font-condensed font-extrabold text-xl uppercase text-white mb-2.5">{f.title}</h3>
                <p className="text-sm font-light leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>{f.desc}</p>
                {f.tag && (
                  <span className="inline-block mt-4 text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded"
                        style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
                    {f.tag}
                  </span>
                )}
                {/* Grand Y décoratif */}
                <div className="absolute -right-6 -bottom-12 font-condensed font-extrabold leading-none
                                pointer-events-none select-none"
                     style={{ fontSize: 180, color: 'rgba(255,255,255,0.05)' }}>Y</div>
              </div>
            ) : (
              <div className="feat-card group">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-6 bg-brown-pale">
                  {f.icon}
                </div>
                <h3 className="font-condensed font-extrabold text-xl uppercase text-yoba-charcoal mb-2.5">{f.title}</h3>
                <p className="text-sm font-light leading-relaxed text-yoba-gray-dark">{f.desc}</p>
                {f.tag && (
                  <span className="inline-block mt-4 text-[10px] font-bold tracking-widest uppercase
                                   px-3 py-1 rounded bg-brown-pale text-brown">
                    {f.tag}
                  </span>
                )}
              </div>
            )}
          </Reveal>
        ))}
      </div>
    </section>
  )
}

// ============================================================
//  PricingSection
// ============================================================
const PLANS = [
  {
    name: 'Expéditeur',
    price: '0€',
    unit: 'inscription gratuite',
    features: ['15 % de commission par envoi','Matching automatique','Messagerie in-app','Suivi GPS','Assurance optionnelle'],
    cta: 'Créer un compte',
    href: '/inscription',
  },
  {
    name: 'Transporteur Pro',
    price: '9,90€',
    unit: '/ mois — sans engagement',
    popular: true,
    features: ['Priorité dans les résultats','Badge Transporteur Vérifié','Paiement prioritaire J+0','−5 % de commission','Support téléphonique dédié','Statistiques & revenus détaillés'],
    cta: 'Devenir Pro',
    href: '/inscription',
  },
  {
    name: 'Business / API',
    price: 'Sur',
    unit: 'devis — intégration & volume',
    features: ['Accès API REST complet','Volume agreements','Dashboard entreprise','Facturation mensuelle B2B','Account manager dédié'],
    cta: 'Nous contacter',
    href: 'mailto:pro@yobaleema.fr',
  },
]

export function PricingSection() {
  return (
    <section id="tarifs" className="bg-yoba-charcoal py-24" style={{ padding: '100px 80px' }}>
      <Reveal><div className="section-label" style={{ color: '#F0D5B8' }}>Tarifs</div></Reveal>
      <Reveal delay={0.1}>
        <h2 className="section-title" style={{ color: '#FAFAF8' }}>
          3× moins cher<br /><em style={{ color: '#C8630A' }}>que la poste</em>
        </h2>
      </Reveal>
      <Reveal delay={0.2}>
        <p className="section-desc" style={{ color: 'rgba(250,245,240,0.55)' }}>
          Aucun abonnement pour les expéditeurs. Commission de 15 % uniquement à l'envoi.
        </p>
      </Reveal>

      <div className="grid gap-5 mt-16" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 64 }}>
        {PLANS.map((plan, i) => (
          <Reveal key={plan.name} delay={i * 0.1}>
            <div
              className={`relative rounded-xl p-9 transition-transform duration-300 hover:-translate-y-1
                ${plan.popular
                  ? 'bg-brown border-brown'
                  : 'border'}`}
              style={plan.popular
                ? { background: '#8B3A00', borderColor: '#8B3A00' }
                : { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }
              }
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2
                                bg-white text-brown text-[10px] font-extrabold
                                tracking-[0.1em] uppercase px-4 py-1.5 rounded whitespace-nowrap">
                  ⚡ Le plus populaire
                </div>
              )}

              <p className="text-[11px] font-bold tracking-[0.12em] uppercase mb-5"
                 style={{ color: plan.popular ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.45)' }}>
                {plan.name}
              </p>

              <p className="font-condensed font-extrabold leading-none mb-1.5"
                 style={{ fontSize: 56, letterSpacing: '-0.03em', color: 'white' }}>
                {plan.price}
              </p>
              <p className="text-sm mb-7"
                 style={{ color: plan.popular ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.4)' }}>
                {plan.unit}
              </p>

              <ul className="flex flex-col gap-3">
                {plan.features.map(f => (
                  <li key={f} className="text-sm flex items-start gap-2.5"
                      style={{ color: plan.popular ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)' }}>
                    <span className="font-bold flex-shrink-0"
                          style={{ color: plan.popular ? 'white' : '#C8630A' }}>—</span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                to={plan.href}
                className="block text-center mt-8 py-3.5 rounded-md font-condensed font-extrabold
                           text-sm tracking-[0.1em] uppercase transition-all duration-200"
                style={plan.popular
                  ? { background: 'white', color: '#8B3A00' }
                  : { background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }
                }
              >
                {plan.cta}
              </Link>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

// ============================================================
//  TestimonialsSection
// ============================================================
const TESTIMONIALS = [
  { stars: 5, text: "J'avais peur au début, mais l'expérience a été parfaite. Mon colis est arrivé le lendemain à Lyon pour 14 € au lieu des 28 € de Colissimo. La transporteuse était super sympa.", name: 'Marie-Laure D.', role: 'Expéditrice, Paris 11e', init: 'ML', bg: '#F0D5B8', color: '#8B3A00' },
  { stars: 5, text: "Je fais Paris-Bordeaux tous les mois pour voir ma famille. Grâce à Yobaleema, je gagne 40 à 80 € à chaque aller. Ça couvre l'essence et plus !", name: 'Thomas K.', role: 'Transporteur Pro, Paris', init: 'TK', bg: '#D4E5DE', color: '#2D4A3E' },
  { stars: 5, text: "Le système de QR code est vraiment bien fait. Scan à la récupération, scan à la livraison, paiement débloqué automatiquement. Zéro friction.", name: 'Aminata S.', role: 'Transporteuse, Lyon', init: 'AS', bg: '#FAEEDA', color: '#633806' },
]

export function TestimonialsSection() {
  return (
    <section id="avis" className="bg-brown-ultra py-24" style={{ padding: '100px 80px' }}>
      <Reveal><div className="section-label">Ils nous font confiance</div></Reveal>
      <Reveal delay={0.1}>
        <h2 className="section-title">Des milliers<br /><em>d'expéditions réussies</em></h2>
      </Reveal>

      <div className="grid gap-5 mt-16" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 64 }}>
        {TESTIMONIALS.map((t, i) => (
          <Reveal key={t.name} delay={i * 0.1}>
            <div className="bg-white rounded-xl p-7 border border-brown/[0.08] relative">
              {/* Guillemet décoratif */}
              <div className="absolute top-5 right-6 font-condensed font-extrabold leading-[0.8]
                              text-brown-pale text-7xl pointer-events-none select-none">
                "
              </div>
              <div className="text-brown-light text-base tracking-widest mb-4">
                {'★'.repeat(t.stars)}
              </div>
              <p className="text-sm font-light leading-relaxed text-yoba-gray-dark mb-6">{t.text}</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center
                                font-condensed font-extrabold text-sm flex-shrink-0"
                     style={{ background: t.bg, color: t.color }}>
                  {t.init}
                </div>
                <div>
                  <p className="text-sm font-bold text-yoba-charcoal">{t.name}</p>
                  <p className="text-xs text-yoba-gray-dark">{t.role}</p>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

// ============================================================
//  CTASection
// ============================================================
export function CTASection() {
  return (
    <section className="relative bg-brown text-center overflow-hidden py-28" style={{ padding: '120px 80px' }}>
      {/* Grand Y décoratif */}
      <div className="absolute right-[-60px] top-1/2 -translate-y-[55%] pointer-events-none select-none
                      font-condensed font-extrabold leading-none"
           style={{ fontSize: 560, color: 'rgba(255,255,255,0.04)' }}>Y</div>

      <Reveal>
        <div className="section-label justify-center" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Rejoignez la communauté
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <h2 className="section-title mt-2 mb-5 relative z-10" style={{ color: 'white' }}>
          Faites voyager<br />
          <em style={{ color: 'rgba(255,255,255,0.7)' }}>vos colis autrement</em>
        </h2>
      </Reveal>

      <Reveal delay={0.2}>
        <p className="section-desc mx-auto mb-12 relative z-10"
           style={{ color: 'rgba(255,255,255,0.65)' }}>
          Inscription gratuite. Premier envoi en 5 minutes. Aucune carte bancaire requise.
        </p>
      </Reveal>

      <Reveal delay={0.3}>
        <div className="flex items-center justify-center gap-5 flex-wrap relative z-10">
          <Link to="/inscription" className="btn-white">Envoyer mon premier colis →</Link>
          <Link to="/inscription" className="btn-ghost-white">Proposer un trajet</Link>
        </div>
      </Reveal>
    </section>
  )
}

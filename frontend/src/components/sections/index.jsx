// ================================================================
//  sections/index.jsx — Toutes les sections de la landing page
// ================================================================

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Reveal from '@/components/ui/Reveal'

// ---- TrustBar ----
export function TrustBar() {
  return (
    <div style={{ background:'#F0D5B8', borderTop:'1px solid rgba(139,58,0,0.15)', borderBottom:'1px solid rgba(139,58,0,0.15)', padding:'14px 80px' }}
         className="flex items-center justify-between gap-6 flex-wrap overflow-x-auto">
      {[['🔒','Paiement sécurisé & séquestre'],['🛡️','Assurance colis jusqu\'à 500 €'],['🪪','Identité vérifiée pour tous'],['🌿','−72 % d\'émissions CO₂'],['⚡','Matching en moins de 4 h']].map(([icon,text]) => (
        <div key={text} className="flex items-center gap-2.5 whitespace-nowrap">
          <span className="text-lg">{icon}</span>
          <span className="text-xs font-bold tracking-[0.04em] text-brown">{text}</span>
        </div>
      ))}
    </div>
  )
}

// ---- HowItWorksSection ----
const STEPS = [
  { num:'01', title:'Décrivez votre colis',    desc:'Dimensions, poids, destination et plage horaire. Ajoutez des photos pour rassurer le transporteur.',
    screen: <div className="p-3.5"><p className="text-[10px] font-extrabold text-brown tracking-widest uppercase mb-3">📦 Nouveau colis</p>{[['Départ','Paris, 75011'],['Arrivée','Lyon, 69001'],['Dimensions','40×30×20 cm · 5 kg'],['Valeur','120 €']].map(([l,v]) => (<div key={l} className="bg-yoba-gray rounded-lg p-2.5 mb-2"><p className="text-[8px] font-bold tracking-widest uppercase text-yoba-gray-dark">{l}</p><p className="text-[11px] font-semibold text-yoba-charcoal mt-0.5">{v}</p></div>))}<div className="bg-brown text-white rounded-lg text-center py-2.5 mt-2.5 text-[10px] font-extrabold tracking-widest uppercase">Publier →</div></div> },
  { num:'02', title:'Recevez des propositions', desc:'Notre algorithme géospatial Haversine trouve les transporteurs dont le détour ne dépasse pas 15 % de leur trajet.',
    screen: <div className="p-3.5"><p className="text-[10px] font-extrabold text-brown tracking-widest uppercase mb-3">✅ 3 transporteurs</p>{[{init:'TK',bg:'#F0D5B8',c:'#8B3A00',name:'Thomas K.',r:'Demain · 14h',p:'18€'},{init:'SB',bg:'#D4E5DE',c:'#2D4A3E',name:'Sophie B.',r:'Demain · 09h',p:'22€'},{init:'MR',bg:'#FAEEDA',c:'#633806',name:'Marc R.',r:'Après-demain',p:'16€'}].map(m=><div key={m.init} className="bg-white border border-brown/10 rounded-lg p-2.5 mb-1.5 flex items-center gap-2"><div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-extrabold flex-shrink-0" style={{background:m.bg,color:m.c}}>{m.init}</div><div className="flex-1 min-w-0"><p className="text-[10px] font-bold text-yoba-charcoal">{m.name}</p><p className="text-[8px] text-yoba-gray-dark">{m.r}</p></div><span className="text-[12px] font-extrabold text-brown">{m.p}</span></div>)}</div> },
  { num:'03', title:'Payez en sécurité',        desc:'Paiement séquestre Stripe : les fonds sont bloqués jusqu\'à la confirmation de livraison par QR code.',
    screen: <div className="p-3.5"><p className="text-[10px] font-extrabold text-brown tracking-widest uppercase mb-3">🔒 Paiement</p>{[['Transporteur','Thomas K. ⭐⭐⭐⭐⭐'],['Transport','18,00 € (séquestre)'],['Assurance','+ 2,00 €']].map(([l,v])=><div key={l} className="bg-yoba-gray rounded-lg p-2.5 mb-2"><p className="text-[8px] font-bold tracking-widest uppercase text-yoba-gray-dark">{l}</p><p className="text-[11px] font-semibold text-yoba-charcoal mt-0.5">{v}</p></div>)}<div className="bg-brown-pale rounded-lg p-2.5 mt-2 text-[9px] font-bold text-brown">🔒 Fonds bloqués jusqu'à livraison</div><div className="bg-brown text-white rounded-lg text-center py-2.5 mt-2.5 text-[10px] font-extrabold tracking-widest uppercase">Confirmer — 20,00 €</div></div> },
  { num:'04', title:'Suivez en temps réel',     desc:'GPS live via WebSocket, QR code de remise, notifications push à chaque étape clé de la livraison.',
    screen: <div className="p-3.5"><p className="text-[10px] font-extrabold text-brown tracking-widest uppercase mb-3">📍 En route</p><div className="bg-brown-pale rounded-lg p-2.5 mb-2"><p className="text-[8px] font-bold tracking-widest uppercase text-yoba-gray-dark">Statut</p><p className="text-[11px] font-bold text-brown mt-0.5">Thomas est à 87 km</p></div><div className="bg-white border border-brown/10 rounded-lg p-2.5 flex items-center gap-2 mb-3"><span className="text-lg">🚗</span><div><p className="text-[10px] font-bold text-yoba-charcoal">ETA 16h30</p><p className="text-[8px] text-yoba-gray-dark">A6 · Lyon dans 1h20</p></div></div><div className="flex gap-1">{['done','done','now','todo'].map((s,i)=><div key={i} className="flex-1 h-1 rounded-sm" style={{background:s==='done'?'#8B3A00':s==='now'?'#C8630A':'#C8C5BF'}}/>)}</div><p className="text-[8px] text-yoba-gray-dark mt-1">Collecté · Pris en charge · En route · Livré</p></div> },
]

export function HowItWorksSection() {
  const [active, setActive] = useState(0)
  return (
    <section id="fonctionnement" style={{ background:'white', padding:'100px 80px' }}>
      <Reveal><div className="section-label">Comment ça marche</div></Reveal>
      <Reveal delay={0.1}><h2 className="section-title">Simple comme<br /><em>un covoiturage</em></h2></Reveal>
      <Reveal delay={0.2}><p className="section-desc">En quelques minutes, trouvez un transporteur qui fait déjà votre trajet.</p></Reveal>
      <div className="grid gap-20 mt-18" style={{ gridTemplateColumns:'1fr 1fr', marginTop:72 }}>
        <div>
          {STEPS.map((s, i) => (
            <Reveal key={s.num} delay={i*0.08}>
              <div onClick={() => setActive(i)}
                   className={`flex gap-6 px-6 py-7 cursor-pointer transition-all duration-250 rounded-r-lg border-l-[3px] mb-1 ${active===i ? 'border-brown bg-brown-ultra' : 'border-transparent hover:bg-brown/[0.04]'}`}>
                <span className="font-condensed font-extrabold text-5xl leading-none flex-shrink-0 w-14 transition-colors" style={{ color:active===i?'#8B3A00':'#C8C5BF' }}>{s.num}</span>
                <div><p className="text-base font-bold text-yoba-charcoal mb-2">{s.title}</p><p className="text-sm font-light leading-relaxed text-yoba-gray-dark">{s.desc}</p></div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.2}>
          <div className="sticky top-28 bg-yoba-gray rounded-2xl p-10 flex items-center justify-center min-h-[420px] border border-brown/[0.08]">
            <div className="w-[196px] bg-yoba-charcoal rounded-[34px] p-2.5 shadow-phone">
              <div className="bg-yoba-white rounded-[26px] overflow-hidden" style={{ aspectRatio:'9/19' }}>
                <div className="h-6 bg-yoba-charcoal flex items-center justify-center"><div className="w-14 h-4 bg-black rounded-full" /></div>
                <AnimatePresence mode="wait">
                  <motion.div key={active} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-8 }} transition={{ duration:0.25 }}>
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

// ---- FeaturesSection ----
const FEATS = [
  { icon:'🎯', title:'Matching géospatial', desc:'Algorithme Haversine — trouve les transporteurs dont le détour reste sous 15 %. Calcul temps réel, cache Redis 5 min, événement RabbitMQ automatique.', tag:'7 microservices', featured:true },
  { icon:'🔒', title:'Séquestre Stripe',    desc:'Fonds bloqués jusqu\'à livraison confirmée par QR code. Libération automatique.', tag:'Stripe Connect' },
  { icon:'📍', title:'GPS temps réel',      desc:'WebSocket Socket.io dans le gateway. Position Redis TTL 2h pour reconnexions.' },
  { icon:'🪪', title:'Identité vérifiée',   desc:'CNI + selfie obligatoires. Vérification Onfido en 2 minutes.' },
  { icon:'💬', title:'Messagerie sécurisée',desc:'In-app via notification-service. Aucun numéro exposé.' },
  { icon:'⭐', title:'Double notation',      desc:'Expéditeurs et transporteurs se notent après chaque livraison. Moyenne recalculée en temps réel.' },
  { icon:'🛡️', title:'Assurance intégrée', desc:'Option 2 € = couverture jusqu\'à 500 €. Remboursement sous 48h.', tag:'Optionnelle' },
]

export function FeaturesSection() {
  return (
    <section id="fonctionnalites" style={{ background:'#E8E6E2', padding:'100px 80px' }}>
      <Reveal><div className="section-label">Fonctionnalités</div></Reveal>
      <Reveal delay={0.1}><h2 className="section-title">Conçu pour<br /><em>la confiance</em></h2></Reveal>
      <Reveal delay={0.2}><p className="section-desc">Chaque détail est pensé pour sécuriser l'expédition de bout en bout — côté frontend et backend.</p></Reveal>
      <div className="grid gap-5 mt-16" style={{ gridTemplateColumns:'repeat(3,1fr)', marginTop:64 }}>
        {FEATS.map((f,i) => (
          <Reveal key={f.title} delay={i*0.06}>
            {f.featured ? (
              <div style={{ background:'#8B3A00', gridRow:'span 2' }} className="rounded-xl p-8 relative overflow-hidden">
                <div style={{ background:'rgba(255,255,255,0.15)' }} className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-6">{f.icon}</div>
                <h3 className="font-condensed font-extrabold text-xl uppercase text-white mb-2.5">{f.title}</h3>
                <p className="text-sm font-light leading-relaxed" style={{ color:'rgba(255,255,255,0.65)' }}>{f.desc}</p>
                {f.tag && <span style={{ background:'rgba(255,255,255,0.15)', color:'white' }} className="inline-block mt-4 text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded">{f.tag}</span>}
                <div className="absolute -right-6 -bottom-12 font-condensed font-extrabold leading-none pointer-events-none select-none" style={{ fontSize:180, color:'rgba(255,255,255,0.05)' }}>Y</div>
              </div>
            ) : (
              <div className="bg-yoba-white rounded-xl p-8 border border-brown/[0.08] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-card-lg relative overflow-hidden group">
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-brown scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100" />
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-6 bg-brown-pale">{f.icon}</div>
                <h3 className="font-condensed font-extrabold text-xl uppercase text-yoba-charcoal mb-2.5">{f.title}</h3>
                <p className="text-sm font-light leading-relaxed text-yoba-gray-dark">{f.desc}</p>
                {f.tag && <span className="inline-block mt-4 text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded bg-brown-pale text-brown">{f.tag}</span>}
              </div>
            )}
          </Reveal>
        ))}
      </div>
    </section>
  )
}

// ---- PricingSection ----
const PLANS = [
  { name:'Expéditeur',      price:'0€',    unit:'inscription gratuite',         features:['15 % de commission par envoi','Matching automatique','Messagerie in-app','Suivi GPS','Assurance optionnelle'], cta:'Créer un compte', href:'/inscription' },
  { name:'Transporteur Pro',price:'9,90€', unit:'/ mois — sans engagement',     features:['Priorité dans les résultats','Badge Transporteur Vérifié','Paiement prioritaire J+0','−5 % de commission','Support téléphonique dédié','Statistiques & revenus détaillés'], cta:'Devenir Pro', href:'/inscription', popular:true },
  { name:'Business / API',  price:'Sur',   unit:'devis — intégration & volume', features:['Accès API REST complet','Volume agreements','Dashboard entreprise','Facturation mensuelle B2B','Account manager dédié'], cta:'Nous contacter', href:'mailto:pro@yobaleema.fr' },
]

export function PricingSection() {
  return (
    <section id="tarifs" style={{ background:'#1E1C1A', padding:'100px 80px' }}>
      <Reveal><div className="section-label" style={{ color:'#F0D5B8' }}>Tarifs</div></Reveal>
      <Reveal delay={0.1}><h2 className="section-title" style={{ color:'#FAFAF8' }}>3× moins cher<br /><em style={{ color:'#C8630A' }}>que la poste</em></h2></Reveal>
      <Reveal delay={0.2}><p className="section-desc" style={{ color:'rgba(250,245,240,0.55)' }}>Aucun abonnement pour les expéditeurs. Commission de 15 % uniquement à l'envoi.</p></Reveal>
      <div className="grid gap-5 mt-16" style={{ gridTemplateColumns:'repeat(3,1fr)', marginTop:64 }}>
        {PLANS.map((p,i) => (
          <Reveal key={p.name} delay={i*0.1}>
            <div className="relative rounded-xl p-9 transition-transform duration-300 hover:-translate-y-1"
                 style={p.popular ? { background:'#8B3A00', borderColor:'#8B3A00' } : { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)' }}>
              {p.popular && <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-white text-brown text-[10px] font-extrabold tracking-[0.1em] uppercase px-4 py-1.5 rounded whitespace-nowrap">⚡ Le plus populaire</div>}
              <p className="text-[11px] font-bold tracking-[0.12em] uppercase mb-5" style={{ color:p.popular?'rgba(255,255,255,0.75)':'rgba(255,255,255,0.45)' }}>{p.name}</p>
              <p className="font-condensed font-extrabold leading-none mb-1.5" style={{ fontSize:56, letterSpacing:'-0.03em', color:'white' }}>{p.price}</p>
              <p className="text-sm mb-7" style={{ color:p.popular?'rgba(255,255,255,0.6)':'rgba(255,255,255,0.4)' }}>{p.unit}</p>
              <ul className="flex flex-col gap-3">
                {p.features.map(f => <li key={f} className="text-sm flex items-start gap-2.5" style={{ color:p.popular?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.6)' }}><span className="font-bold flex-shrink-0" style={{ color:p.popular?'white':'#C8630A' }}>—</span>{f}</li>)}
              </ul>
              <Link to={p.href} className="block text-center mt-8 py-3.5 rounded-md font-condensed font-extrabold text-sm tracking-[0.1em] uppercase transition-all duration-200"
                    style={p.popular ? { background:'white', color:'#8B3A00' } : { background:'rgba(255,255,255,0.08)', color:'white', border:'1px solid rgba(255,255,255,0.15)' }}>
                {p.cta}
              </Link>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

// ---- TestimonialsSection ----
export function TestimonialsSection() {
  const tests = [
    { stars:5, text:"J'avais peur au début, mais l'expérience a été parfaite. Mon colis est arrivé le lendemain à Lyon pour 14 € au lieu des 28 € de Colissimo.", name:'Marie-Laure D.', role:'Expéditrice, Paris 11e', init:'ML', bg:'#F0D5B8', c:'#8B3A00' },
    { stars:5, text:"Je fais Paris-Bordeaux tous les mois. Grâce à Yobaleema, je gagne 40 à 80 € à chaque aller. Ça couvre l'essence et plus !", name:'Thomas K.', role:'Transporteur Pro', init:'TK', bg:'#D4E5DE', c:'#2D4A3E' },
    { stars:5, text:"Le système de QR code est vraiment bien fait. Scan à la récupération, scan à la livraison, paiement débloqué automatiquement.", name:'Aminata S.', role:'Transporteuse, Lyon', init:'AS', bg:'#FAEEDA', c:'#633806' },
  ]
  return (
    <section id="avis" style={{ background:'#FAF0E6', padding:'100px 80px' }}>
      <Reveal><div className="section-label">Ils nous font confiance</div></Reveal>
      <Reveal delay={0.1}><h2 className="section-title">Des milliers<br /><em>d'expéditions réussies</em></h2></Reveal>
      <div className="grid gap-5 mt-16" style={{ gridTemplateColumns:'repeat(3,1fr)', marginTop:64 }}>
        {tests.map((t,i) => (
          <Reveal key={t.name} delay={i*0.1}>
            <div className="bg-white rounded-xl p-7 border border-brown/[0.08] relative">
              <div className="absolute top-5 right-6 font-condensed font-extrabold leading-[0.8] pointer-events-none select-none text-brown-pale text-7xl">"</div>
              <div className="text-brown-light text-base tracking-widest mb-4">{'★'.repeat(t.stars)}</div>
              <p className="text-sm font-light leading-relaxed text-yoba-gray-dark mb-6">{t.text}</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-condensed font-extrabold text-sm flex-shrink-0" style={{ background:t.bg, color:t.c }}>{t.init}</div>
                <div><p className="text-sm font-bold text-yoba-charcoal">{t.name}</p><p className="text-xs text-yoba-gray-dark">{t.role}</p></div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

// ---- CTASection ----
export function CTASection() {
  return (
    <section style={{ background:'#8B3A00', padding:'120px 80px', textAlign:'center', position:'relative', overflow:'hidden' }}>
      <div className="absolute right-[-60px] top-1/2 -translate-y-[55%] pointer-events-none select-none font-condensed font-extrabold leading-none" style={{ fontSize:560, color:'rgba(255,255,255,0.04)' }}>Y</div>
      <Reveal><div className="section-label justify-center" style={{ color:'rgba(255,255,255,0.6)' }}>Rejoignez la communauté</div></Reveal>
      <Reveal delay={0.1}><h2 className="section-title mt-2 mb-5 relative z-10" style={{ color:'white' }}>Faites voyager<br /><em style={{ color:'rgba(255,255,255,0.7)' }}>vos colis autrement</em></h2></Reveal>
      <Reveal delay={0.2}><p className="section-desc mx-auto mb-12 relative z-10" style={{ color:'rgba(255,255,255,0.65)' }}>Architecture microservices — 7 services, 6 bases PostgreSQL, RabbitMQ, Redis, WebSocket. Prêt à scaler.</p></Reveal>
      <Reveal delay={0.3}>
        <div className="flex items-center justify-center gap-5 flex-wrap relative z-10">
          <Link to="/inscription" className="btn-white">Envoyer mon premier colis →</Link>
          <Link to="/inscription" className="btn-ghost-white">Proposer un trajet</Link>
        </div>
      </Reveal>
    </section>
  )
}

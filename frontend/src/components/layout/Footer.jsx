import YobaleemaLogo from '@/components/ui/YobaleemaLogo'

const cols = {
  Produit:    [['Comment ça marche','/#fonctionnement'],['Tarifs','/#tarifs'],['Application mobile','#'],['API Business','#']],
  Confiance:  [['Assurance colis','#'],['Vérification identité','#'],['Centre de sécurité','#'],['Résoudre un litige','#']],
  Entreprise: [['À propos','#'],['Blog','#'],['Recrutement','#'],['Contact','mailto:contact@yobaleema.fr']],
}

export default function Footer() {
  return (
    <footer style={{ background:'#1E1C1A', padding:'80px 80px 40px' }} className="text-[rgba(250,245,240,0.5)]">
      <div className="grid gap-16 mb-16" style={{ gridTemplateColumns:'2fr 1fr 1fr 1fr' }}>
        <div>
          <YobaleemaLogo size={30} textSize={19} variant="light" />
          <p className="text-sm font-light leading-relaxed mt-4 mb-7">La plateforme de covoiturage de colis entre particuliers. Simple, économique, écologique.</p>
          <div className="flex gap-2.5">
            {['𝕏','in','f','◉'].map(s => (
              <a key={s} href="#"
                 style={{ background:'rgba(255,255,255,0.07)', color:'rgba(250,245,240,0.5)' }}
                 className="w-9 h-9 rounded flex items-center justify-center text-sm font-bold hover:bg-brown hover:text-white transition-all">
                {s}
              </a>
            ))}
          </div>
        </div>
        {Object.entries(cols).map(([col, links]) => (
          <div key={col}>
            <h4 className="text-[11px] font-extrabold tracking-[0.14em] uppercase mb-5" style={{ color:'rgba(250,245,240,0.8)' }}>{col}</h4>
            {links.map(([label, href]) => (
              <a key={label} href={href} className="block text-sm mb-3 hover:text-brown-light transition-colors duration-200">{label}</a>
            ))}
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center pt-8 text-xs" style={{ borderTop:'1px solid rgba(255,255,255,0.07)' }}>
        <span>© 2026 Yobaleema SAS — Paris, France</span>
        <div className="flex gap-6">
          {['Confidentialité','CGU','Mentions légales'].map(l => (
            <a key={l} href="#" className="hover:text-brown-light transition-colors">{l}</a>
          ))}
        </div>
      </div>
    </footer>
  )
}

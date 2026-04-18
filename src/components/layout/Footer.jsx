import { Link } from 'react-router-dom'
import YobaleemaLogo from '@/components/ui/YobaleemaLogo'

const footerLinks = {
  Produit: [
    { label: 'Comment ça marche', href: '/#fonctionnement' },
    { label: 'Tarifs',            href: '/#tarifs' },
    { label: 'Application mobile',href: '#' },
    { label: 'API Business',      href: '#' },
    { label: 'Nouveautés',        href: '#' },
  ],
  Confiance: [
    { label: 'Assurance colis',       href: '#' },
    { label: 'Vérification identité', href: '#' },
    { label: 'Centre de sécurité',    href: '#' },
    { label: 'Résoudre un litige',    href: '#' },
  ],
  Entreprise: [
    { label: 'À propos',   href: '#' },
    { label: 'Blog',       href: '#' },
    { label: 'Presse',     href: '#' },
    { label: 'Recrutement',href: '#' },
    { label: 'Contact',    href: 'mailto:contact@yobaleema.fr' },
  ],
}

export default function Footer() {
  return (
    <footer className="bg-yoba-charcoal pt-20 pb-10 px-15" style={{ padding: '80px 80px 40px' }}>
      <div className="grid gap-16 mb-16" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>

        {/* Brand */}
        <div>
          <YobaleemaLogo size={32} textSize={20} variant="light" />
          <p className="text-sm font-light leading-relaxed mt-4 mb-7"
             style={{ color: 'rgba(250,245,240,0.5)' }}>
            La plateforme de covoiturage de colis entre particuliers.
            Simple, économique, écologique.
          </p>
          <div className="flex gap-2.5">
            {['𝕏','in','f','◉'].map(s => (
              <a key={s} href="#"
                 className="w-9 h-9 rounded flex items-center justify-center
                            text-sm font-bold transition-all duration-200
                            hover:bg-brown hover:text-white"
                 style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(250,245,240,0.5)' }}>
                {s}
              </a>
            ))}
          </div>
        </div>

        {/* Link columns */}
        {Object.entries(footerLinks).map(([col, links]) => (
          <div key={col}>
            <h4 className="text-2xs font-extrabold tracking-[0.14em] uppercase mb-5"
                style={{ color: 'rgba(250,245,240,0.8)' }}>
              {col}
            </h4>
            {links.map(link => (
              <a key={link.label} href={link.href}
                 className="block text-sm mb-3 transition-colors duration-200
                            hover:text-brown-light"
                 style={{ color: 'rgba(250,245,240,0.45)' }}>
                {link.label}
              </a>
            ))}
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="flex justify-between items-center pt-8 text-xs"
           style={{ borderTop: '1px solid rgba(255,255,255,0.07)', color: 'rgba(250,245,240,0.35)' }}>
        <span>© 2026 Yobaleema SAS — Paris, France</span>
        <div className="flex gap-6">
          {['Confidentialité','CGU','Mentions légales'].map(l => (
            <a key={l} href="#" className="hover:text-brown-light transition-colors duration-200">{l}</a>
          ))}
        </div>
      </div>
    </footer>
  )
}

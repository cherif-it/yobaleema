import { Link } from 'react-router-dom'
import YobaleemaLogo from '@/components/ui/YobaleemaLogo'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-yoba-gray flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-8">
        <YobaleemaLogo size={36} textSize={22} />
      </div>
      <div className="font-condensed font-extrabold text-yoba-charcoal mb-4"
           style={{ fontSize: 'clamp(80px,15vw,180px)', letterSpacing: '-0.04em', lineHeight: 1, color: '#8B3A00' }}>
        404
      </div>
      <h1 className="font-condensed font-extrabold text-3xl uppercase text-yoba-charcoal mb-3">
        Page introuvable
      </h1>
      <p className="text-sm font-light text-yoba-gray-dark mb-8 max-w-sm">
        Cette page n'existe pas ou a été déplacée. Retournez à l'accueil pour continuer.
      </p>
      <Link to="/" className="btn-primary">← Retour à l'accueil</Link>
    </div>
  )
}

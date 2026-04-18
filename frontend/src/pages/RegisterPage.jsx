import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import useAuthStore from '@/store/authStore'
import YobaleemaLogo from '@/components/ui/YobaleemaLogo'

const schema = z.object({
  firstName: z.string().min(2, 'Prénom requis'),
  lastName:  z.string().min(2, 'Nom requis'),
  email:     z.string().min(1, 'Email requis').email('Email invalide'),
  password:  z.string().min(8, '8 caractères minimum'),
  role:      z.enum(['sender', 'carrier', 'both'], { errorMap: () => ({ message: 'Choisissez un rôle' }) }),
})

// inputType sépare le type HTML du spread de register() pour éviter tout écrasement
function Input({ inputType = 'text', error, ...rest }) {
  const [show, setShow] = useState(false)
  const isPwd = inputType === 'password'
  return (
    <div className="relative">
      <input
        {...rest}
        type={isPwd ? (show ? 'text' : 'password') : inputType}
        className={`w-full bg-white border rounded-lg px-4 py-3.5 text-sm text-yoba-charcoal
                    placeholder-yoba-gray-dark/50 outline-none transition-all duration-200
                    focus:border-brown focus:ring-2 focus:ring-brown/10
                    ${error ? 'border-red-400' : 'border-brown/15'}`}
      />
      {isPwd && (
        <button type="button" onClick={() => setShow(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-yoba-gray-dark">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      )}
    </div>
  )
}

function FieldWrap({ label, error, children }) {
  return (
    <div className="mb-4">
      <label className="block text-[11px] font-bold tracking-widest uppercase text-yoba-charcoal mb-2">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

export default function RegisterPage() {
  const { register: registerUser, isLoading, error, clearError } = useAuthStore()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { role: 'both' },
  })

  const onSubmit = async (data) => {
    clearError()
    const res = await registerUser(data)
    if (res.ok) navigate('/dashboard')
  }

  const ROLES = [
    { value: 'sender',  label: "📦 J'envoie des colis",    desc: 'Je cherche des transporteurs' },
    { value: 'carrier', label: "🚗 Je propose des trajets", desc: 'Je transporte des colis' },
    { value: 'both',    label: "🔄 Les deux à la fois",     desc: 'Expéditeur & transporteur' },
  ]

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Gauche brand */}
      <div className="hidden lg:flex flex-col justify-between bg-brown p-10 relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern" />
        <div className="absolute right-[-40px] top-1/2 -translate-y-1/2 font-condensed font-extrabold leading-none pointer-events-none select-none"
             style={{ fontSize: 480, color: 'rgba(255,255,255,0.04)' }}>Y</div>
        <div className="relative z-10"><YobaleemaLogo size={32} textSize={19} variant="light" /></div>
        <div className="relative z-10">
          <p className="font-condensed font-extrabold uppercase leading-[0.95] text-white mb-4"
             style={{ fontSize: 'clamp(32px,3vw,44px)', letterSpacing: '-0.01em' }}>
            Rejoignez<br /><em className="not-italic" style={{ color: '#E8A855' }}>12 400</em><br />utilisateurs
          </p>
          <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Gratuit, sans engagement. Premier envoi en 5 minutes.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 relative z-10">
          {[{ n:'12K+', l:'Colis livrés' }, { n:'4,8★', l:'Note moy.' }, { n:'−65%', l:'vs La Poste' }].map(s => (
            <div key={s.l} className="rounded-xl p-4 border"
                 style={{ background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.1)' }}>
              <p className="font-condensed font-extrabold text-[28px] leading-none"
                 style={{ color: '#E8A855', letterSpacing: '-0.03em' }}>{s.n}</p>
              <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Droite formulaire */}
      <div className="flex flex-col justify-center bg-yoba-gray px-8 py-12 lg:px-20 overflow-y-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-yoba-gray-dark hover:text-brown transition-colors mb-10">
          <ArrowLeft size={16} /> Retour au site
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <h1 className="font-condensed font-extrabold text-4xl uppercase text-yoba-charcoal mb-2"
              style={{ letterSpacing: '-0.01em' }}>Bienvenue ! 🎉</h1>
          <p className="text-sm font-light text-yoba-gray-dark mb-6">Créez votre compte Yobaleema gratuitement</p>

          {/* Tabs */}
          <div className="flex bg-white border border-brown/10 rounded-lg p-1 mb-6">
            <Link to="/connexion"
                  className="flex-1 py-2.5 text-center text-yoba-gray-dark font-condensed font-bold text-sm tracking-widest uppercase hover:text-brown transition-colors">
              Connexion
            </Link>
            <button className="flex-1 py-2.5 rounded-md bg-brown text-white font-condensed font-bold text-sm tracking-widest uppercase">
              Inscription
            </button>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 font-medium">{error}</div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* Prénom + Nom */}
            <div className="grid grid-cols-2 gap-3">
              <FieldWrap label="Prénom" error={errors.firstName?.message}>
                {/* Props statiques d'abord, spread de register() en dernier */}
                <Input inputType="text" placeholder="Aminata" autoComplete="given-name"
                       error={errors.firstName?.message} {...register('firstName')} />
              </FieldWrap>
              <FieldWrap label="Nom" error={errors.lastName?.message}>
                <Input inputType="text" placeholder="Koné" autoComplete="family-name"
                       error={errors.lastName?.message} {...register('lastName')} />
              </FieldWrap>
            </div>

            <FieldWrap label="Adresse email" error={errors.email?.message}>
              <Input inputType="email" placeholder="vous@example.com" autoComplete="email"
                     error={errors.email?.message} {...register('email')} />
            </FieldWrap>

            <FieldWrap label="Mot de passe" error={errors.password?.message}>
              <Input inputType="password" placeholder="8 caractères minimum" autoComplete="new-password"
                     error={errors.password?.message} {...register('password')} />
            </FieldWrap>

            {/* Rôle */}
            <div className="mb-5">
              <label className="block text-[11px] font-bold tracking-widest uppercase text-yoba-charcoal mb-2">Je suis</label>
              <div className="grid gap-2">
                {ROLES.map(r => (
                  <label key={r.value}
                         className="flex items-center gap-3 p-3 bg-white border border-brown/15 rounded-lg
                                    cursor-pointer hover:border-brown transition-colors
                                    has-[:checked]:border-brown has-[:checked]:bg-brown-ultra">
                    {/* type="radio" défini explicitement, pas via spread */}
                    <input type="radio" value={r.value} {...register('role')} className="accent-brown" />
                    <div>
                      <p className="text-sm font-semibold text-yoba-charcoal">{r.label}</p>
                      <p className="text-xs text-yoba-gray-dark">{r.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
              {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role.message}</p>}
            </div>

            <button type="submit" disabled={isLoading}
                    className="w-full btn-primary justify-center disabled:opacity-60 disabled:cursor-not-allowed">
              {isLoading ? 'Création…' : 'Créer mon compte gratuit →'}
            </button>
          </form>

          <p className="text-xs text-center text-yoba-gray-dark mt-5">
            En créant un compte, vous acceptez nos{' '}
            <a href="#" className="text-brown font-semibold hover:underline">CGU</a> et notre{' '}
            <a href="#" className="text-brown font-semibold hover:underline">politique de confidentialité</a>.
          </p>
        </motion.div>
      </div>
    </div>
  )
}

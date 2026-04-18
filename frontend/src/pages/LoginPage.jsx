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
  email:    z.string().min(1, 'Email requis').email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

// ⚠️  inputType (pas "type") pour éviter le conflit avec le spread de register()
function Field({ label, inputType = 'text', error, rightEl, ...rest }) {
  const [show, setShow] = useState(false)
  const isPwd = inputType === 'password'
  return (
    <div className="mb-5">
      <div className="flex justify-between items-center mb-2">
        <label className="text-[11px] font-bold tracking-widest uppercase text-yoba-charcoal">{label}</label>
        {rightEl}
      </div>
      <div className="relative">
        <input
          {...rest}                                              {/* ref, name, onChange, onBlur de register() */}
          type={isPwd ? (show ? 'text' : 'password') : inputType}  {/* type appliqué EN DERNIER */}
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
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function BrandPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between bg-brown p-10 relative overflow-hidden">
      <div className="absolute inset-0 dot-pattern" />
      <div className="absolute right-[-40px] top-1/2 -translate-y-1/2 font-condensed font-extrabold
                      leading-none pointer-events-none select-none"
           style={{ fontSize: 480, color: 'rgba(255,255,255,0.04)' }}>Y</div>
      <div className="relative z-10"><YobaleemaLogo size={32} textSize={19} variant="light" /></div>
      <div className="relative z-10">
        <p className="font-condensed font-extrabold uppercase leading-[0.95] text-white mb-4"
           style={{ fontSize: 'clamp(32px,3vw,44px)', letterSpacing: '-0.01em' }}>
          Vos colis voyagent<br />
          <em className="not-italic" style={{ color: '#E8A855' }}>avec les gens</em><br />
          qui y vont déjà
        </p>
        <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Rejoignez 12 400 utilisateurs qui font voyager leurs colis autrement.
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
  )
}

export default function LoginPage() {
  const { login, isLoading, error, clearError } = useAuthStore()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (data) => {
    clearError()
    const res = await login(data.email, data.password)
    if (res.ok) navigate('/dashboard')
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <BrandPanel />
      <div className="flex flex-col justify-center bg-yoba-gray px-8 py-12 lg:px-20 overflow-y-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-yoba-gray-dark hover:text-brown transition-colors mb-10">
          <ArrowLeft size={16} /> Retour au site
        </Link>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <h1 className="font-condensed font-extrabold text-4xl uppercase text-yoba-charcoal mb-2"
              style={{ letterSpacing: '-0.01em' }}>Bon retour 👋</h1>
          <p className="text-sm font-light text-yoba-gray-dark mb-8">Connectez-vous à votre compte Yobaleema</p>

          {/* Tabs */}
          <div className="flex bg-white border border-brown/10 rounded-lg p-1 mb-7">
            <button className="flex-1 py-2.5 rounded-md bg-brown text-white font-condensed font-bold text-sm tracking-widest uppercase">
              Connexion
            </button>
            <Link to="/inscription"
                  className="flex-1 py-2.5 text-center text-yoba-gray-dark font-condensed font-bold text-sm tracking-widest uppercase hover:text-brown transition-colors">
              Inscription
            </Link>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 font-medium">{error}</div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* inputType en premier, puis le spread de register() — le type ne sera jamais écrasé */}
            <Field
              label="Adresse email"
              inputType="email"
              placeholder="vous@example.com"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <Field
              label="Mot de passe"
              inputType="password"
              placeholder="••••••••"
              autoComplete="current-password"
              error={errors.password?.message}
              rightEl={<a href="#" className="text-[11px] text-brown hover:underline">Mot de passe oublié ?</a>}
              {...register('password')}
            />
            <button type="submit" disabled={isLoading}
                    className="w-full btn-primary justify-center mt-1 disabled:opacity-60 disabled:cursor-not-allowed">
              {isLoading ? 'Connexion…' : 'Se connecter →'}
            </button>
          </form>

          <p className="text-xs text-center text-yoba-gray-dark mt-6">
            Pas encore de compte ?{' '}
            <Link to="/inscription" className="text-brown font-semibold hover:underline">Créer un compte gratuit</Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}

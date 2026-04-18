import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, MapPin, Scale, Euro, ChevronRight, ChevronLeft } from 'lucide-react'
import { parcelAPI } from '@/services/api'

// ---- Schéma complet ----
const schema = z.object({
  pickupAddress:   z.string().min(5, 'Adresse requise'),
  pickupCity:      z.string().min(2, 'Ville requise'),
  pickupLat:       z.number().default(48.8566),
  pickupLng:       z.number().default(2.3522),
  deliveryAddress: z.string().min(5, 'Adresse requise'),
  deliveryCity:    z.string().min(2, 'Ville requise'),
  deliveryLat:     z.number().default(45.7640),
  deliveryLng:     z.number().default(4.8357),
  weightKg:        z.number({ invalid_type_error: 'Requis' }).positive(),
  widthCm:         z.number({ invalid_type_error: 'Requis' }).positive(),
  heightCm:        z.number({ invalid_type_error: 'Requis' }).positive(),
  depthCm:         z.number({ invalid_type_error: 'Requis' }).positive(),
  declaredValue:   z.number({ invalid_type_error: 'Requis' }).min(0),
  isFragile:       z.boolean().default(false),
  description:     z.string().optional(),
  pickupFrom:      z.string().min(1, 'Requis'),
  pickupTo:        z.string().min(1, 'Requis'),
  insuranceOpted:  z.boolean().default(false),
})

const STEPS = [
  { title: 'Origine & Destination', icon: MapPin },
  { title: 'Caractéristiques',       icon: Scale },
  { title: 'Disponibilité & Prix',   icon: Euro },
]

function Field({ label, error, children, hint }) {
  return (
    <div className="mb-5">
      <label className="block text-[11px] font-bold tracking-widest uppercase text-yoba-charcoal mb-2">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-yoba-gray-dark mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function Input({ error, ...props }) {
  return (
    <input
      {...props}
      className={`w-full bg-white border rounded-lg px-4 py-3.5 text-sm
                  text-yoba-charcoal placeholder-yoba-gray-dark/50
                  outline-none transition-all duration-200
                  focus:border-brown focus:ring-2 focus:ring-brown/10
                  ${error ? 'border-red-400' : 'border-brown/15'}`}
    />
  )
}

export default function SendParcelPage() {
  const [step, setStep]       = useState(0)
  const [loading, setLoading] = useState(false)
  const navigate              = useNavigate()

  const { register, handleSubmit, watch, trigger, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      pickupLat: 48.8566, pickupLng: 2.3522,
      deliveryLat: 45.7640, deliveryLng: 4.8357,
      isFragile: false, insuranceOpted: false,
    },
  })

  const watchFields = watch()

  // Valider uniquement les champs de l'étape courante avant de passer
  const stepFields = [
    ['pickupAddress','pickupCity','deliveryAddress','deliveryCity'],
    ['weightKg','widthCm','heightCm','depthCm','declaredValue'],
    ['pickupFrom','pickupTo'],
  ]

  const nextStep = async () => {
    const valid = await trigger(stepFields[step])
    if (valid) setStep(s => Math.min(s + 1, STEPS.length - 1))
  }

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const res = await parcelAPI.create({
        ...data,
        weightKg:      Number(data.weightKg),
        widthCm:       Number(data.widthCm),
        heightCm:      Number(data.heightCm),
        depthCm:       Number(data.depthCm),
        declaredValue: Number(data.declaredValue),
      })
      navigate(`/colis/${res.data.id}`)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-yoba-gray pt-24 px-6 pb-16">
      <div className="max-w-2xl mx-auto">

        {/* En-tête */}
        <div className="mb-8">
          <div className="section-label">Nouvelle expédition</div>
          <h1 className="section-title">Envoyer<br /><em>un colis</em></h1>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-0 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex items-center flex-1">
              <div className={`flex items-center gap-2.5 flex-shrink-0
                ${i <= step ? 'text-brown' : 'text-yoba-gray-mid'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center
                                 font-condensed font-extrabold text-sm transition-all
                                 ${i < step  ? 'bg-brown text-white'
                                 : i === step ? 'bg-brown-pale text-brown border-2 border-brown'
                                 :              'bg-white text-yoba-gray-mid border border-yoba-gray-mid'}`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className="text-[11px] font-bold tracking-wider uppercase hidden sm:block">
                  {s.title}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px mx-3"
                     style={{ background: i < step ? '#8B3A00' : '#C8C5BF' }} />
              )}
            </div>
          ))}
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-2xl border border-brown/[0.08] p-8 shadow-card">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <AnimatePresence mode="wait">

              {/* ── Step 0 : Adresses ── */}
              {step === 0 && (
                <motion.div key="s0" initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }}
                            exit={{ opacity:0, x:-20 }} transition={{ duration: 0.2 }}>
                  <h2 className="font-condensed font-extrabold text-xl uppercase text-yoba-charcoal mb-6">
                    D'où part votre colis ?
                  </h2>
                  <div className="bg-brown-ultra rounded-xl p-5 mb-6">
                    <p className="text-[11px] font-bold tracking-widest uppercase text-brown mb-4">📍 Adresse de collecte</p>
                    <Field label="Adresse complète" error={errors.pickupAddress?.message}>
                      <Input {...register('pickupAddress')} type="text" placeholder="12 rue de la Paix" error={errors.pickupAddress?.message} />
                    </Field>
                    <Field label="Ville" error={errors.pickupCity?.message}>
                      <Input {...register('pickupCity')} type="text" placeholder="Paris" error={errors.pickupCity?.message} />
                    </Field>
                  </div>
                  <div className="bg-brown-ultra rounded-xl p-5">
                    <p className="text-[11px] font-bold tracking-widest uppercase text-brown mb-4">🏁 Adresse de livraison</p>
                    <Field label="Adresse complète" error={errors.deliveryAddress?.message}>
                      <Input {...register('deliveryAddress')} type="text" placeholder="5 place Bellecour" error={errors.deliveryAddress?.message} />
                    </Field>
                    <Field label="Ville" error={errors.deliveryCity?.message}>
                      <Input {...register('deliveryCity')} type="text" placeholder="Lyon" error={errors.deliveryCity?.message} />
                    </Field>
                  </div>
                </motion.div>
              )}

              {/* ── Step 1 : Dimensions ── */}
              {step === 1 && (
                <motion.div key="s1" initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }}
                            exit={{ opacity:0, x:-20 }} transition={{ duration: 0.2 }}>
                  <h2 className="font-condensed font-extrabold text-xl uppercase text-yoba-charcoal mb-6">
                    Caractéristiques du colis
                  </h2>
                  <Field label="Poids (kg)" error={errors.weightKg?.message}>
                    <Input {...register('weightKg', { valueAsNumber: true })} type="number" step="0.1" min="0.1" placeholder="5.0" error={errors.weightKg?.message} />
                  </Field>
                  <p className="text-[11px] font-bold tracking-widest uppercase text-yoba-charcoal mb-3">
                    Dimensions (cm)
                  </p>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[['widthCm','Largeur'],['heightCm','Hauteur'],['depthCm','Profondeur']].map(([name, label]) => (
                      <Field key={name} label={label} error={errors[name]?.message}>
                        <Input {...register(name, { valueAsNumber: true })} type="number" step="0.1" min="0.1" placeholder="40" error={errors[name]?.message} />
                      </Field>
                    ))}
                  </div>
                  <Field label="Valeur déclarée (€)" error={errors.declaredValue?.message}
                         hint="Utilisée pour le calcul de l'assurance">
                    <Input {...register('declaredValue', { valueAsNumber: true })} type="number" step="1" min="0" placeholder="120" error={errors.declaredValue?.message} />
                  </Field>
                  <div className="flex items-center gap-3 p-4 bg-yoba-gray rounded-xl mt-2">
                    <input type="checkbox" id="fragile" {...register('isFragile')} className="accent-brown w-4 h-4" />
                    <label htmlFor="fragile" className="text-sm font-medium text-yoba-charcoal cursor-pointer">
                      📦 Colis fragile — le transporteur sera informé
                    </label>
                  </div>
                  <Field label="Description (optionnel)" error={undefined} className="mt-4">
                    <textarea {...register('description')}
                      placeholder="Contenu du colis, précautions particulières..."
                      className="w-full bg-white border border-brown/15 rounded-lg px-4 py-3.5 text-sm
                                 text-yoba-charcoal placeholder-yoba-gray-dark/50
                                 outline-none focus:border-brown focus:ring-2 focus:ring-brown/10
                                 resize-none" rows={3} />
                  </Field>
                </motion.div>
              )}

              {/* ── Step 2 : Disponibilité ── */}
              {step === 2 && (
                <motion.div key="s2" initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }}
                            exit={{ opacity:0, x:-20 }} transition={{ duration: 0.2 }}>
                  <h2 className="font-condensed font-extrabold text-xl uppercase text-yoba-charcoal mb-6">
                    Quand peut-il être récupéré ?
                  </h2>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <Field label="À partir du" error={errors.pickupFrom?.message}>
                      <Input {...register('pickupFrom')} type="datetime-local" error={errors.pickupFrom?.message} />
                    </Field>
                    <Field label="Jusqu'au" error={errors.pickupTo?.message}>
                      <Input {...register('pickupTo')} type="datetime-local" error={errors.pickupTo?.message} />
                    </Field>
                  </div>

                  {/* Assurance */}
                  <div className="border border-brown/20 rounded-xl p-5 mb-6">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" id="insurance" {...register('insuranceOpted')}
                             className="accent-brown w-4 h-4 mt-1 flex-shrink-0" />
                      <label htmlFor="insurance" className="cursor-pointer">
                        <p className="text-sm font-bold text-yoba-charcoal">
                          🛡️ Ajouter l'assurance colis — <span className="text-brown">2,00 €</span>
                        </p>
                        <p className="text-xs text-yoba-gray-dark mt-1">
                          Remboursement jusqu'à {watchFields.declaredValue || 0}€ en cas de perte ou de dommage.
                        </p>
                      </label>
                    </div>
                  </div>

                  {/* Récap */}
                  <div className="bg-brown-ultra rounded-xl p-5">
                    <p className="text-[11px] font-bold tracking-widest uppercase text-brown mb-4">Récapitulatif</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-yoba-gray-dark">Trajet</span>
                        <span className="font-semibold">{watchFields.pickupCity || '—'} → {watchFields.deliveryCity || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-yoba-gray-dark">Poids</span>
                        <span className="font-semibold">{watchFields.weightKg || '—'} kg</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-yoba-gray-dark">Valeur déclarée</span>
                        <span className="font-semibold">{watchFields.declaredValue || 0} €</span>
                      </div>
                      {watchFields.insuranceOpted && (
                        <div className="flex justify-between text-brown">
                          <span>Assurance</span>
                          <span className="font-semibold">+ 2,00 €</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t border-brown/10">
              <button
                type="button"
                onClick={() => setStep(s => Math.max(s - 1, 0))}
                disabled={step === 0}
                className="btn-outline disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} /> Retour
              </button>

              {step < STEPS.length - 1 ? (
                <button type="button" onClick={nextStep} className="btn-primary">
                  Continuer <ChevronRight size={16} />
                </button>
              ) : (
                <button type="submit" disabled={loading} className="btn-primary disabled:opacity-60">
                  {loading ? 'Publication…' : 'Publier mon colis →'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// SendParcelPage.jsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { parcelAPI } from '@/services/api'

const schema = z.object({
  pickupAddress:   z.string().min(3),
  pickupCity:      z.string().min(2),
  pickupLat:       z.number().default(48.8566),
  pickupLng:       z.number().default(2.3522),
  deliveryAddress: z.string().min(3),
  deliveryCity:    z.string().min(2),
  deliveryLat:     z.number().default(45.7640),
  deliveryLng:     z.number().default(4.8357),
  weightKg:        z.number({ invalid_type_error:'Requis' }).positive(),
  widthCm:         z.number({ invalid_type_error:'Requis' }).positive(),
  heightCm:        z.number({ invalid_type_error:'Requis' }).positive(),
  depthCm:         z.number({ invalid_type_error:'Requis' }).positive(),
  declaredValue:   z.number({ invalid_type_error:'Requis' }).min(0).default(0),
  isFragile:       z.boolean().default(false),
  description:     z.string().optional(),
  pickupFrom:      z.string().min(1),
  pickupTo:        z.string().min(1),
  insuranceOpted:  z.boolean().default(false),
})

const STEPS = ['Adresses','Dimensions','Disponibilité']
const stepFields = [
  ['pickupAddress','pickupCity','deliveryAddress','deliveryCity'],
  ['weightKg','widthCm','heightCm','depthCm','declaredValue'],
  ['pickupFrom','pickupTo'],
]

function FInput({ error, ...props }) {
  return (
    <input {...props}
      className={`w-full bg-white border rounded-lg px-4 py-3.5 text-sm text-yoba-charcoal
                  placeholder-yoba-gray-dark/50 outline-none transition-all duration-200
                  focus:border-brown focus:ring-2 focus:ring-brown/10
                  ${error ? 'border-red-400' : 'border-brown/15'}`} />
  )
}
function FField({ label, error, hint, children }) {
  return (
    <div className="mb-5">
      <label className="block text-[11px] font-bold tracking-widest uppercase text-yoba-charcoal mb-2">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-yoba-gray-dark mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

export function SendParcelPage() {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { register, handleSubmit, trigger, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { pickupLat:48.8566, pickupLng:2.3522, deliveryLat:45.7640, deliveryLng:4.8357, isFragile:false, insuranceOpted:false, declaredValue:0 },
  })
  const w = watch()

  const next = async () => { const ok = await trigger(stepFields[step]); if (ok) setStep(s => s+1) }

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const res = await parcelAPI.create({ ...data, weightKg:Number(data.weightKg), widthCm:Number(data.widthCm), heightCm:Number(data.heightCm), depthCm:Number(data.depthCm), declaredValue:Number(data.declaredValue) })
      navigate(`/colis/${res.data.data.id}`)
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-yoba-gray pt-24 px-6 pb-16">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8"><div className="section-label">Nouvelle expédition</div><h1 className="section-title">Envoyer<br /><em>un colis</em></h1></div>
        {/* Stepper */}
        <div className="flex items-center gap-0 mb-8">
          {STEPS.map((s,i) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-condensed font-extrabold text-sm transition-all
                ${i<step?'bg-brown text-white':i===step?'bg-brown-pale text-brown border-2 border-brown':'bg-white text-yoba-gray-mid border border-yoba-gray-mid'}`}>
                {i<step?'✓':i+1}
              </div>
              <span className={`text-[11px] font-bold tracking-wider uppercase ml-2 hidden sm:block ${i<=step?'text-brown':'text-yoba-gray-mid'}`}>{s}</span>
              {i<STEPS.length-1 && <div className="flex-1 h-px mx-3" style={{ background: i<step?'#8B3A00':'#C8C5BF' }} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-brown/[0.08] p-8 shadow-card">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <AnimatePresence mode="wait">
              {step===0 && (
                <motion.div key="s0" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} transition={{duration:0.2}}>
                  <h2 className="font-condensed font-extrabold text-xl uppercase text-yoba-charcoal mb-6">Adresses</h2>
                  <div className="bg-brown-ultra rounded-xl p-5 mb-5">
                    <p className="text-[11px] font-bold tracking-widest uppercase text-brown mb-4">📍 Collecte</p>
                    <FField label="Adresse" error={errors.pickupAddress?.message}><FInput {...register('pickupAddress')} type="text" placeholder="12 rue de la Paix" error={errors.pickupAddress?.message} /></FField>
                    <FField label="Ville"   error={errors.pickupCity?.message}>   <FInput {...register('pickupCity')}    type="text" placeholder="Paris"             error={errors.pickupCity?.message}    /></FField>
                  </div>
                  <div className="bg-brown-ultra rounded-xl p-5">
                    <p className="text-[11px] font-bold tracking-widest uppercase text-brown mb-4">🏁 Livraison</p>
                    <FField label="Adresse" error={errors.deliveryAddress?.message}><FInput {...register('deliveryAddress')} type="text" placeholder="5 place Bellecour" error={errors.deliveryAddress?.message} /></FField>
                    <FField label="Ville"   error={errors.deliveryCity?.message}>   <FInput {...register('deliveryCity')}    type="text" placeholder="Lyon"              error={errors.deliveryCity?.message}    /></FField>
                  </div>
                </motion.div>
              )}
              {step===1 && (
                <motion.div key="s1" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} transition={{duration:0.2}}>
                  <h2 className="font-condensed font-extrabold text-xl uppercase text-yoba-charcoal mb-6">Caractéristiques</h2>
                  <FField label="Poids (kg)" error={errors.weightKg?.message}><FInput {...register('weightKg',{valueAsNumber:true})} type="number" step="0.1" min="0.1" placeholder="5.0" error={errors.weightKg?.message} /></FField>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[['widthCm','Largeur (cm)'],['heightCm','Hauteur (cm)'],['depthCm','Prof. (cm)']].map(([n,l])=>(
                      <FField key={n} label={l} error={errors[n]?.message}><FInput {...register(n,{valueAsNumber:true})} type="number" step="0.1" min="0.1" placeholder="40" error={errors[n]?.message} /></FField>
                    ))}
                  </div>
                  <FField label="Valeur déclarée (€)" error={errors.declaredValue?.message}><FInput {...register('declaredValue',{valueAsNumber:true})} type="number" step="1" min="0" placeholder="120" error={errors.declaredValue?.message} /></FField>
                  <label className="flex items-center gap-3 p-4 bg-yoba-gray rounded-xl cursor-pointer">
                    <input type="checkbox" {...register('isFragile')} className="accent-brown w-4 h-4" />
                    <span className="text-sm font-medium text-yoba-charcoal">📦 Colis fragile</span>
                  </label>
                </motion.div>
              )}
              {step===2 && (
                <motion.div key="s2" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} transition={{duration:0.2}}>
                  <h2 className="font-condensed font-extrabold text-xl uppercase text-yoba-charcoal mb-6">Disponibilité</h2>
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <FField label="À partir du" error={errors.pickupFrom?.message}><FInput {...register('pickupFrom')} type="datetime-local" error={errors.pickupFrom?.message} /></FField>
                    <FField label="Jusqu'au"    error={errors.pickupTo?.message}>  <FInput {...register('pickupTo')}   type="datetime-local" error={errors.pickupTo?.message}   /></FField>
                  </div>
                  <label className="flex items-start gap-3 p-5 border border-brown/20 rounded-xl cursor-pointer mb-5">
                    <input type="checkbox" {...register('insuranceOpted')} className="accent-brown w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div><p className="text-sm font-bold text-yoba-charcoal">🛡️ Assurance colis — <span className="text-brown">2,00 €</span></p><p className="text-xs text-yoba-gray-dark mt-1">Couverture jusqu'à {w.declaredValue||0} €</p></div>
                  </label>
                  <div className="bg-brown-ultra rounded-xl p-5">
                    <p className="text-[11px] font-bold tracking-widest uppercase text-brown mb-3">Récapitulatif</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-yoba-gray-dark">Trajet</span><span className="font-semibold">{w.pickupCity||'—'} → {w.deliveryCity||'—'}</span></div>
                      <div className="flex justify-between"><span className="text-yoba-gray-dark">Poids</span><span className="font-semibold">{w.weightKg||'—'} kg</span></div>
                      <div className="flex justify-between"><span className="text-yoba-gray-dark">Valeur</span><span className="font-semibold">{w.declaredValue||0} €</span></div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex justify-between mt-8 pt-6 border-t border-brown/10">
              <button type="button" onClick={() => setStep(s=>Math.max(s-1,0))} disabled={step===0} className="btn-outline disabled:opacity-30"><ChevronLeft size={16} /> Retour</button>
              {step<STEPS.length-1 ? <button type="button" onClick={next} className="btn-primary">Continuer <ChevronRight size={16} /></button>
                : <button type="submit" disabled={loading} className="btn-primary disabled:opacity-60">{loading?'Publication…':'Publier mon colis →'}</button>}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default SendParcelPage

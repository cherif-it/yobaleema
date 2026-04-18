// OfferTripPage.jsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { tripAPI } from '@/services/api'

const schema = z.object({
  originAddress: z.string().min(3), originCity: z.string().min(2),
  originLat: z.number().default(48.8566), originLng: z.number().default(2.3522),
  destAddress: z.string().min(3), destCity: z.string().min(2),
  destLat: z.number().default(45.7640), destLng: z.number().default(4.8357),
  departureAt: z.string().min(1), maxWeightKg: z.number().positive(), maxVolumeDm3: z.number().positive(),
  notes: z.string().optional(),
})

function TF({ label, error, hint, children }) {
  return <div className="mb-5"><label className="block text-[11px] font-bold tracking-widest uppercase text-yoba-charcoal mb-2">{label}</label>{children}{hint&&!error&&<p className="text-xs text-yoba-gray-dark mt-1">{hint}</p>}{error&&<p className="text-xs text-red-500 mt-1">{error}</p>}</div>
}
function TI({ error, ...props }) {
  return <input {...props} className={`w-full bg-white border rounded-lg px-4 py-3.5 text-sm text-yoba-charcoal placeholder-yoba-gray-dark/50 outline-none transition-all duration-200 focus:border-brown focus:ring-2 focus:ring-brown/10 ${error?'border-red-400':'border-brown/15'}`} />
}

export function OfferTripPage() {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { register, handleSubmit, formState:{errors} } = useForm({ resolver:zodResolver(schema), defaultValues:{originLat:48.8566,originLng:2.3522,destLat:45.7640,destLng:4.8357} })
  const onSubmit = async (d) => {
    setLoading(true)
    try { await tripAPI.create({...d,maxWeightKg:Number(d.maxWeightKg),maxVolumeDm3:Number(d.maxVolumeDm3)}); navigate('/dashboard') }
    catch(err){ console.error(err) } finally { setLoading(false) }
  }
  return (
    <div className="min-h-screen bg-yoba-gray pt-24 px-6 pb-16">
      <div className="max-w-xl mx-auto">
        <div className="mb-8"><div className="section-label">Nouveau trajet</div><h1 className="section-title">Proposer<br /><em>un trajet</em></h1><p className="section-desc">Renseignez votre trajet et la capacité disponible pour transporter des colis.</p></div>
        <div className="bg-white rounded-2xl border border-brown/[0.08] p-8 shadow-card">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="bg-brown-ultra rounded-xl p-5 mb-5">
              <p className="text-[11px] font-bold tracking-widest uppercase text-brown mb-4">📍 Départ</p>
              <TF label="Adresse de départ" error={errors.originAddress?.message}><TI {...register('originAddress')} type="text" placeholder="Gare de Lyon, Paris" error={errors.originAddress?.message} /></TF>
              <TF label="Ville de départ"   error={errors.originCity?.message}><TI {...register('originCity')} type="text" placeholder="Paris" error={errors.originCity?.message} /></TF>
            </div>
            <div className="bg-brown-ultra rounded-xl p-5 mb-5">
              <p className="text-[11px] font-bold tracking-widest uppercase text-brown mb-4">🏁 Arrivée</p>
              <TF label="Adresse d'arrivée" error={errors.destAddress?.message}><TI {...register('destAddress')} type="text" placeholder="Place Bellecour, Lyon" error={errors.destAddress?.message} /></TF>
              <TF label="Ville d'arrivée"   error={errors.destCity?.message}><TI {...register('destCity')} type="text" placeholder="Lyon" error={errors.destCity?.message} /></TF>
            </div>
            <TF label="Date et heure de départ" error={errors.departureAt?.message}><TI {...register('departureAt')} type="datetime-local" error={errors.departureAt?.message} /></TF>
            <div className="grid grid-cols-2 gap-4">
              <TF label="Capacité poids (kg)" error={errors.maxWeightKg?.message}><TI {...register('maxWeightKg',{valueAsNumber:true})} type="number" step="0.5" min="0.5" placeholder="20" error={errors.maxWeightKg?.message} /></TF>
              <TF label="Volume (dm³)" error={errors.maxVolumeDm3?.message} hint="L × l × h / 1000"><TI {...register('maxVolumeDm3',{valueAsNumber:true})} type="number" step="1" min="1" placeholder="100" error={errors.maxVolumeDm3?.message} /></TF>
            </div>
            <TF label="Notes (optionnel)">
              <textarea {...register('notes')} placeholder="Ex: voiture berline, fragiles acceptés..." rows={3} className="w-full bg-white border border-brown/15 rounded-lg px-4 py-3.5 text-sm text-yoba-charcoal placeholder-yoba-gray-dark/50 outline-none resize-none focus:border-brown focus:ring-2 focus:ring-brown/10" />
            </TF>
            <div className="flex gap-3 mt-2">
              <Link to="/dashboard" className="btn-outline flex-1 justify-center">Annuler</Link>
              <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center disabled:opacity-60">{loading?'Publication…':'Publier →'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default OfferTripPage

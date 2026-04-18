// ============================================================
//  OfferTripPage — Proposer un trajet
// ============================================================
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { tripAPI } from '@/services/api'

const tripSchema = z.object({
  originAddress: z.string().min(5),
  originCity:    z.string().min(2),
  originLat:     z.number().default(48.8566),
  originLng:     z.number().default(2.3522),
  destAddress:   z.string().min(5),
  destCity:      z.string().min(2),
  destLat:       z.number().default(45.7640),
  destLng:       z.number().default(4.8357),
  departureAt:   z.string().min(1),
  maxWeightKg:   z.number().positive(),
  maxVolumeDm3:  z.number().positive(),
  notes:         z.string().optional(),
})

function TField({ label, error, hint, children }) {
  return (
    <div className="mb-5">
      <label className="block text-[11px] font-bold tracking-widest uppercase text-yoba-charcoal mb-2">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-yoba-gray-dark mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function TInput({ error, ...props }) {
  return (
    <input {...props}
      className={`w-full bg-white border rounded-lg px-4 py-3.5 text-sm text-yoba-charcoal
                  placeholder-yoba-gray-dark/50 outline-none transition-all duration-200
                  focus:border-brown focus:ring-2 focus:ring-brown/10
                  ${error ? 'border-red-400' : 'border-brown/15'}`}
    />
  )
}

export function OfferTripPage() {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(tripSchema),
    defaultValues: { originLat:48.8566, originLng:2.3522, destLat:45.7640, destLng:4.8357 },
  })

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      await tripAPI.create({
        ...data,
        maxWeightKg:  Number(data.maxWeightKg),
        maxVolumeDm3: Number(data.maxVolumeDm3),
      })
      navigate('/dashboard')
    } catch (err) {
      console.error(err)
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-yoba-gray pt-24 px-6 pb-16">
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <div className="section-label">Nouveau trajet</div>
          <h1 className="section-title">Proposer<br /><em>un trajet</em></h1>
          <p className="section-desc">Renseignez votre trajet et la capacité disponible. Gagnez de l'argent en transportant des colis sur votre route.</p>
        </div>

        <div className="bg-white rounded-2xl border border-brown/[0.08] p-8 shadow-card">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="bg-brown-ultra rounded-xl p-5 mb-5">
              <p className="text-[11px] font-bold tracking-widest uppercase text-brown mb-4">📍 Départ</p>
              <TField label="Adresse de départ" error={errors.originAddress?.message}>
                <TInput {...register('originAddress')} type="text" placeholder="Gare de Lyon, Paris" error={errors.originAddress?.message} />
              </TField>
              <TField label="Ville de départ" error={errors.originCity?.message}>
                <TInput {...register('originCity')} type="text" placeholder="Paris" error={errors.originCity?.message} />
              </TField>
            </div>

            <div className="bg-brown-ultra rounded-xl p-5 mb-5">
              <p className="text-[11px] font-bold tracking-widest uppercase text-brown mb-4">🏁 Arrivée</p>
              <TField label="Adresse d'arrivée" error={errors.destAddress?.message}>
                <TInput {...register('destAddress')} type="text" placeholder="Place Bellecour, Lyon" error={errors.destAddress?.message} />
              </TField>
              <TField label="Ville d'arrivée" error={errors.destCity?.message}>
                <TInput {...register('destCity')} type="text" placeholder="Lyon" error={errors.destCity?.message} />
              </TField>
            </div>

            <TField label="Date et heure de départ" error={errors.departureAt?.message}>
              <TInput {...register('departureAt')} type="datetime-local" error={errors.departureAt?.message} />
            </TField>

            <div className="grid grid-cols-2 gap-4">
              <TField label="Capacité poids (kg)" error={errors.maxWeightKg?.message}>
                <TInput {...register('maxWeightKg', { valueAsNumber:true })} type="number" step="0.5" min="0.5" placeholder="20" error={errors.maxWeightKg?.message} />
              </TField>
              <TField label="Capacité volume (dm³)" error={errors.maxVolumeDm3?.message} hint="Longueur × largeur × hauteur / 1000">
                <TInput {...register('maxVolumeDm3', { valueAsNumber:true })} type="number" step="1" min="1" placeholder="100" error={errors.maxVolumeDm3?.message} />
              </TField>
            </div>

            <TField label="Notes pour les expéditeurs (optionnel)">
              <textarea {...register('notes')} placeholder="Ex: voiture berline, colis fragiles acceptés..."
                className="w-full bg-white border border-brown/15 rounded-lg px-4 py-3.5 text-sm
                           text-yoba-charcoal placeholder-yoba-gray-dark/50 outline-none resize-none
                           focus:border-brown focus:ring-2 focus:ring-brown/10" rows={3} />
            </TField>

            <div className="flex gap-3 mt-2">
              <Link to="/dashboard" className="btn-outline flex-1 justify-center">Annuler</Link>
              <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center disabled:opacity-60">
                {loading ? 'Publication…' : 'Publier le trajet →'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default OfferTripPage

// ============================================================
//  SearchPage — Recherche de trajets
// ============================================================
import { useQuery } from '@tanstack/react-query'
import { tripAPI as tAPI } from '@/services/api'
import { MapPin, Search } from 'lucide-react'

export function SearchPage() {
  const [filters, setFilters] = useState({ from:'', to:'', date:'' })
  const [search,  setSearch]  = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['trips', 'search', search],
    queryFn: () => tAPI.list(search).then(r => r.data),
    enabled: !!search,
  })

  const trips = data?.data || []

  return (
    <div className="min-h-screen bg-yoba-gray pt-24 px-6 pb-16">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="section-label">Trouver un transporteur</div>
          <h1 className="section-title">Rechercher<br /><em>un trajet</em></h1>
        </div>

        {/* Barre de recherche */}
        <div className="bg-white rounded-2xl border border-brown/[0.08] p-6 shadow-card mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold tracking-widest uppercase text-yoba-charcoal mb-2">Départ</label>
              <input type="text" placeholder="Paris"
                     value={filters.from}
                     onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
                     className="w-full bg-yoba-gray border border-brown/15 rounded-lg px-4 py-3 text-sm
                                outline-none focus:border-brown focus:ring-2 focus:ring-brown/10" />
            </div>
            <div>
              <label className="block text-[11px] font-bold tracking-widest uppercase text-yoba-charcoal mb-2">Arrivée</label>
              <input type="text" placeholder="Lyon"
                     value={filters.to}
                     onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
                     className="w-full bg-yoba-gray border border-brown/15 rounded-lg px-4 py-3 text-sm
                                outline-none focus:border-brown focus:ring-2 focus:ring-brown/10" />
            </div>
            <div>
              <label className="block text-[11px] font-bold tracking-widest uppercase text-yoba-charcoal mb-2">Date</label>
              <input type="date"
                     value={filters.date}
                     onChange={e => setFilters(f => ({ ...f, date: e.target.value }))}
                     className="w-full bg-yoba-gray border border-brown/15 rounded-lg px-4 py-3 text-sm
                                outline-none focus:border-brown focus:ring-2 focus:ring-brown/10" />
            </div>
          </div>
          <button onClick={() => setSearch({ ...filters })}
                  className="btn-primary mt-5 w-full justify-center">
            <Search size={16} /> Rechercher des trajets
          </button>
        </div>

        {/* Résultats */}
        {isLoading && <p className="text-center text-yoba-gray-dark py-12">Recherche en cours…</p>}
        {!isLoading && search && trips.length === 0 && (
          <div className="text-center py-12">
            <MapPin size={40} className="mx-auto mb-4 text-brown/30" />
            <p className="font-condensed font-bold text-xl uppercase text-yoba-charcoal mb-2">Aucun trajet trouvé</p>
            <p className="text-sm text-yoba-gray-dark">Essayez d'autres dates ou villes.</p>
          </div>
        )}
        <div className="grid gap-4">
          {trips.map(trip => (
            <div key={trip.id} className="bg-white rounded-xl border border-brown/[0.08] p-5 shadow-card flex items-center gap-5">
              <div className="w-12 h-12 rounded-full bg-brown-pale flex items-center justify-center
                              font-condensed font-extrabold text-brown text-lg flex-shrink-0">
                {trip.carrier_name?.charAt(0) || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-yoba-charcoal">{trip.origin_city} → {trip.dest_city}</p>
                <p className="text-xs text-yoba-gray-dark mt-0.5">
                  {new Date(trip.departure_at).toLocaleString('fr-FR', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                  {' · '}Capacité : {trip.available_weight_kg} kg
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-brown font-bold">★ {trip.rating_avg || 'N/A'}</p>
                <p className="text-xs text-yoba-gray-dark mt-0.5">{trip.carrier_name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

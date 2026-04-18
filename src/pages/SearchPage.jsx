import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tripAPI } from '@/services/api'
import { MapPin, Search } from 'lucide-react'

export default function SearchPage() {
  const [filters, setFilters] = useState({ from: '', to: '', date: '' })
  const [search,  setSearch]  = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['trips', 'search', search],
    queryFn: () => tripAPI.list(search).then(r => r.data),
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
            {[
              { key:'from', label:'Départ',  placeholder:'Paris' },
              { key:'to',   label:'Arrivée', placeholder:'Lyon' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-[11px] font-bold tracking-widest uppercase text-yoba-charcoal mb-2">{f.label}</label>
                <input type="text" placeholder={f.placeholder}
                       value={filters[f.key]}
                       onChange={e => setFilters(v => ({ ...v, [f.key]: e.target.value }))}
                       className="w-full bg-yoba-gray border border-brown/15 rounded-lg px-4 py-3 text-sm
                                  outline-none focus:border-brown focus:ring-2 focus:ring-brown/10" />
              </div>
            ))}
            <div>
              <label className="block text-[11px] font-bold tracking-widest uppercase text-yoba-charcoal mb-2">Date</label>
              <input type="date" value={filters.date}
                     onChange={e => setFilters(v => ({ ...v, date: e.target.value }))}
                     className="w-full bg-yoba-gray border border-brown/15 rounded-lg px-4 py-3 text-sm
                                outline-none focus:border-brown focus:ring-2 focus:ring-brown/10" />
            </div>
          </div>
          <button onClick={() => setSearch({ ...filters })} className="btn-primary mt-5 w-full justify-center">
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
            <div key={trip.id}
                 className="bg-white rounded-xl border border-brown/[0.08] p-5 shadow-card
                            flex items-center gap-5 hover:border-brown/25 transition-all">
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
                <p className="text-xs text-brown font-bold">★ {trip.rating_avg ? Number(trip.rating_avg).toFixed(1) : 'N/A'}</p>
                <p className="text-xs text-yoba-gray-dark mt-0.5">{trip.carrier_name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

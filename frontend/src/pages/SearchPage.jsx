import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tripAPI } from '@/services/api'
import { MapPin, Search } from 'lucide-react'

export default function SearchPage() {
  const [filters, setFilters] = useState({ from:'', to:'', date:'' })
  const [search,  setSearch]  = useState(null)
  const { data, isLoading } = useQuery({
    queryKey: ['trips','search', search],
    queryFn: () => tripAPI.list(search).then(r => r.data),
    enabled: !!search,
  })
  const trips = data?.data || []
  return (
    <div className="min-h-screen bg-yoba-gray pt-24 px-6 pb-16">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8"><div className="section-label">Trouver un transporteur</div><h1 className="section-title">Rechercher<br /><em>un trajet</em></h1></div>
        <div className="bg-white rounded-2xl border border-brown/[0.08] p-6 shadow-card mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[['from','Départ','Paris'],['to','Arrivée','Lyon']].map(([k,l,ph])=>(
              <div key={k}>
                <label className="block text-[11px] font-bold tracking-widest uppercase text-yoba-charcoal mb-2">{l}</label>
                <input type="text" placeholder={ph} value={filters[k]} onChange={e=>setFilters(f=>({...f,[k]:e.target.value}))}
                       className="w-full bg-yoba-gray border border-brown/15 rounded-lg px-4 py-3 text-sm outline-none focus:border-brown focus:ring-2 focus:ring-brown/10" />
              </div>
            ))}
            <div>
              <label className="block text-[11px] font-bold tracking-widest uppercase text-yoba-charcoal mb-2">Date</label>
              <input type="date" value={filters.date} onChange={e=>setFilters(f=>({...f,date:e.target.value}))}
                     className="w-full bg-yoba-gray border border-brown/15 rounded-lg px-4 py-3 text-sm outline-none focus:border-brown focus:ring-2 focus:ring-brown/10" />
            </div>
          </div>
          <button onClick={() => setSearch({...filters})} className="btn-primary mt-5 w-full justify-center">
            <Search size={16} /> Rechercher des trajets
          </button>
        </div>
        {isLoading && <p className="text-center text-yoba-gray-dark py-12">Recherche en cours…</p>}
        {!isLoading && search && trips.length===0 && (
          <div className="text-center py-12"><MapPin size={40} className="mx-auto mb-4 text-brown/30" /><p className="font-condensed font-bold text-xl uppercase text-yoba-charcoal mb-2">Aucun trajet trouvé</p><p className="text-sm text-yoba-gray-dark">Essayez d'autres dates ou villes.</p></div>
        )}
        <div className="grid gap-4">
          {trips.map(t=>(
            <div key={t.id} className="bg-white rounded-xl border border-brown/[0.08] p-5 shadow-card flex items-center gap-5 hover:border-brown/25 transition-all">
              <div className="w-12 h-12 rounded-full bg-brown-pale flex items-center justify-center font-condensed font-extrabold text-brown text-lg flex-shrink-0">
                {(t.carrier_name||'?').charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-yoba-charcoal">{t.origin_city} → {t.dest_city}</p>
                <p className="text-xs text-yoba-gray-dark mt-0.5">
                  {new Date(t.departure_at).toLocaleString('fr-FR',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} · {t.available_weight_kg} kg dispo
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-brown font-bold">★ {Number(t.rating_avg||0).toFixed(1)}</p>
                <p className="text-xs text-yoba-gray-dark mt-0.5">{t.carrier_name||'Transporteur'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

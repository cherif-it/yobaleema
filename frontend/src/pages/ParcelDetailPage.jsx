import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { parcelAPI, matchingAPI } from '@/services/api'
import { MapPin, Package, ArrowLeft, Star, RefreshCw } from 'lucide-react'

const STATUS = {
  pending:   { label:'En attente de match',             cls:'text-yellow-600 bg-yellow-50' },
  matched:   { label:'Transporteurs trouvés',           cls:'text-blue-600 bg-blue-50' },
  accepted:  { label:'Accepté par un transporteur',     cls:'text-purple-600 bg-purple-50' },
  in_transit:{ label:'En transit',                      cls:'text-orange-600 bg-orange-50' },
  delivered: { label:'Livré — en attente de confirmation', cls:'text-green-600 bg-green-50' },
  confirmed: { label:'✓ Livraison confirmée',          cls:'text-green-800 bg-green-100' },
}

export default function ParcelDetailPage() {
  const { id } = useParams()
  const { data: pd, isLoading } = useQuery({ queryKey:['parcel',id], queryFn:()=>parcelAPI.get(id).then(r=>r.data) })
  const { data: md, isLoading:ml, refetch } = useQuery({ queryKey:['match',id], queryFn:()=>matchingAPI.get(id).then(r=>r.data), enabled:!!pd })

  const parcel  = pd?.data
  const matches = md?.data || []

  if (isLoading) return <div className="min-h-screen bg-yoba-gray pt-24 flex items-center justify-center"><p className="text-yoba-gray-dark">Chargement…</p></div>
  if (!parcel)   return <div className="min-h-screen bg-yoba-gray pt-24 flex items-center justify-center"><p className="text-yoba-gray-dark">Colis non trouvé</p></div>

  const st = STATUS[parcel.status] || { label:parcel.status, cls:'text-gray-600 bg-gray-50' }

  return (
    <div className="min-h-screen bg-yoba-gray pt-24 px-6 pb-16">
      <div className="max-w-3xl mx-auto">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-yoba-gray-dark hover:text-brown transition-colors mb-6"><ArrowLeft size={16} /> Retour</Link>
        <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-6 ${st.cls}`}>{st.label}</span>

        {/* Infos */}
        <div className="bg-white rounded-2xl border border-brown/[0.08] p-7 shadow-card mb-6">
          <h1 className="font-condensed font-extrabold text-2xl uppercase text-yoba-charcoal mb-5 flex items-center gap-3">
            <Package size={20} className="text-brown" /> {parcel.pickup_city} → {parcel.delivery_city}
          </h1>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[['Poids',`${parcel.weight_kg} kg`],['Dimensions',`${parcel.width_cm}×${parcel.height_cm}×${parcel.depth_cm} cm`],['Valeur déclarée',`${parcel.declared_value} €`],['Assurance',parcel.insurance_opted?'✓ Incluse':'✗ Non']].map(([l,v])=>(
              <div key={l} className="bg-yoba-gray rounded-xl p-4">
                <p className="text-[10px] font-bold tracking-widest uppercase text-yoba-gray-dark mb-1">{l}</p>
                <p className="text-sm font-semibold text-yoba-charcoal">{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* QR codes si accepté */}
        {parcel.pickup_qr_code && (
          <div className="bg-brown-ultra border border-brown/20 rounded-2xl p-6 mb-6">
            <h2 className="font-condensed font-extrabold text-lg uppercase text-brown mb-4">🔒 Codes QR</h2>
            <div className="grid grid-cols-2 gap-4">
              {[['QR Collecte',parcel.pickup_qr_code,'À présenter au transporteur'],['QR Livraison',parcel.delivery_qr_code,'À scanner à la réception']].map(([label,code,hint])=>(
                <div key={label} className="bg-white rounded-xl p-4 text-center">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-yoba-gray-dark mb-2">{label}</p>
                  <div className="w-20 h-20 bg-yoba-charcoal rounded-lg mx-auto flex items-center justify-center text-white text-[10px] font-mono break-all p-2">{code?.slice(0,8)}…</div>
                  <p className="text-xs text-yoba-gray-dark mt-2">{hint}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Matchings */}
        {['pending','matched'].includes(parcel.status) && (
          <div className="bg-white rounded-2xl border border-brown/[0.08] p-7 shadow-card">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-condensed font-extrabold text-xl uppercase text-yoba-charcoal">
                Transporteurs disponibles ({matches.length})
              </h2>
              <button onClick={() => refetch()} className="flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase text-brown hover:text-brown-mid transition-colors">
                <RefreshCw size={13} /> Actualiser
              </button>
            </div>
            {ml && <p className="text-sm text-yoba-gray-dark py-4 text-center">Recherche en cours…</p>}
            {!ml && matches.length===0 && (
              <div className="text-center py-8"><MapPin size={32} className="mx-auto mb-3 text-brown/30" /><p className="text-sm font-semibold text-yoba-charcoal">Aucun transporteur pour l'instant</p><p className="text-xs text-yoba-gray-dark mt-1">Nous cherchons automatiquement. Revenez dans quelques heures.</p></div>
            )}
            <div className="space-y-3">
              {matches.map(m=>(
                <div key={m.tripId} className="border border-brown/10 rounded-xl p-4 hover:border-brown/30 hover:bg-brown-ultra transition-all duration-200 cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full bg-brown-pale flex items-center justify-center font-condensed font-extrabold text-brown text-lg flex-shrink-0">
                      {(m.carrierName||'?').charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-yoba-charcoal">{m.carrierName}</p>
                      <p className="text-xs text-yoba-gray-dark mt-0.5">
                        {m.originCity} → {m.destCity} · {new Date(m.departureAt).toLocaleDateString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-condensed font-extrabold text-xl text-brown">{m.suggestedPrice}€</p>
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        <Star size={11} className="text-brown-light fill-brown-light" />
                        <span className="text-xs font-semibold">{Number(m.ratingAvg||0).toFixed(1)}</span>
                        <span className="text-[10px] text-yoba-gray-dark">({m.ratingCount})</span>
                      </div>
                      <p className="text-[10px] text-yoba-gray-dark mt-0.5">Détour : {m.detourPercent}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Package, MapPin, Star, Plus, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import useAuthStore from '@/store/authStore'
import { parcelAPI, tripAPI } from '@/services/api'
import YobaleemaLogo from '@/components/ui/YobaleemaLogo'

// ---- Composants internes ----
function StatCard({ icon: Icon, label, value, color = 'brown' }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-brown/[0.08]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-yoba-gray-dark">{label}</span>
        <Icon size={18} style={{ color: color === 'brown' ? '#8B3A00' : '#C8630A' }} />
      </div>
      <p className="font-condensed font-extrabold text-3xl text-yoba-charcoal" style={{ letterSpacing: '-0.02em' }}>
        {value}
      </p>
    </div>
  )
}

const STATUS_CONFIG = {
  pending:    { label: 'En attente',   color: 'bg-yellow-100 text-yellow-700',  icon: Clock },
  matched:    { label: 'Matchés',      color: 'bg-blue-100 text-blue-700',      icon: TrendingUp },
  accepted:   { label: 'Accepté',      color: 'bg-purple-100 text-purple-700',  icon: CheckCircle },
  in_transit: { label: 'En transit',   color: 'bg-orange-100 text-orange-700',  icon: MapPin },
  delivered:  { label: 'Livré',        color: 'bg-green-100 text-green-700',    icon: CheckCircle },
  confirmed:  { label: 'Confirmé ✓',   color: 'bg-green-100 text-green-800',    icon: CheckCircle },
  disputed:   { label: 'Litige',       color: 'bg-red-100 text-red-700',        icon: AlertCircle },
  cancelled:  { label: 'Annulé',       color: 'bg-gray-100 text-gray-500',      icon: AlertCircle },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'bg-gray-100 text-gray-600', icon: Clock }
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function ParcelCard({ parcel }) {
  return (
    <Link to={`/colis/${parcel.id}`}
          className="block bg-white border border-brown/[0.08] rounded-xl p-5
                     hover:shadow-card hover:border-brown/20 transition-all duration-200 group">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <MapPin size={13} className="text-brown flex-shrink-0" />
            <p className="text-sm font-semibold text-yoba-charcoal truncate">
              {parcel.pickup_city} → {parcel.delivery_city}
            </p>
          </div>
          <p className="text-xs text-yoba-gray-dark ml-5">
            {parcel.weight_kg} kg · {parcel.width_cm}×{parcel.height_cm}×{parcel.depth_cm} cm
          </p>
        </div>
        <StatusBadge status={parcel.status} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-yoba-gray-dark">
          {parcel.final_price
            ? <><span className="font-bold text-brown text-sm">{parcel.final_price}€</span> payé</>
            : parcel.suggested_price
            ? <>Suggéré : <span className="font-semibold">{parcel.suggested_price}€</span></>
            : 'Prix à définir'
          }
        </span>
        <span className="text-[10px] text-yoba-gray-dark">
          {new Date(parcel.created_at).toLocaleDateString('fr-FR')}
        </span>
      </div>
    </Link>
  )
}

function TripCard({ trip }) {
  const tripStatus = { open:'Ouvert', full:'Complet', in_progress:'En cours', completed:'Terminé', cancelled:'Annulé' }
  return (
    <div className="bg-white border border-brown/[0.08] rounded-xl p-5
                    hover:shadow-card transition-all duration-200">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MapPin size={13} className="text-brown" />
            <p className="text-sm font-semibold text-yoba-charcoal">
              {trip.origin_city} → {trip.dest_city}
            </p>
          </div>
          <p className="text-xs text-yoba-gray-dark ml-5">
            {new Date(trip.departure_at).toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
          </p>
        </div>
        <span className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full
          ${trip.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {tripStatus[trip.status] || trip.status}
        </span>
      </div>
      <div className="flex gap-4 text-xs text-yoba-gray-dark">
        <span>Capacité : <strong className="text-yoba-charcoal">{trip.available_weight_kg}/{trip.max_weight_kg} kg</strong></span>
        <span>Colis : <strong className="text-yoba-charcoal">{trip.parcel_count || 0}</strong></span>
      </div>
    </div>
  )
}

const TABS = ['Mes colis', 'Mes trajets', 'Revenus']

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState(0)
  const { user, logout } = useAuthStore()

  const { data: parcelsData } = useQuery({
    queryKey: ['parcels', 'my'],
    queryFn: () => parcelAPI.list().then(r => r.data),
  })

  const { data: tripsData } = useQuery({
    queryKey: ['trips', 'my'],
    queryFn: () => tripAPI.myTrips().then(r => r.data),
  })

  const parcels = parcelsData?.data || []
  const trips   = tripsData?.data || []

  const totalEarned = trips
    .filter(t => t.status === 'completed')
    .reduce((sum) => sum, 0)

  return (
    <div className="min-h-screen bg-yoba-gray flex flex-col">

      {/* Header dashboard */}
      <header className="bg-yoba-charcoal px-8 pt-8 pb-0 lg:px-16" style={{ paddingTop: 32, paddingBottom: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <Link to="/"><YobaleemaLogo size={30} textSize={18} variant="light" /></Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-white/60 hidden sm:block">
              Bonjour, <strong className="text-white">{user?.first_name || 'Utilisateur'}</strong> 👋
            </span>
            <button onClick={logout}
                    className="text-xs font-bold tracking-wider uppercase text-white/40
                               hover:text-white transition-colors">
              Déconnexion
            </button>
          </div>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-0 pb-6">
          <StatCard icon={Package}    label="Colis envoyés"   value={parcels.length} />
          <StatCard icon={MapPin}     label="Trajets proposés" value={trips.length}  color="light" />
          <StatCard icon={CheckCircle} label="Livrés avec succès"
                    value={parcels.filter(p => p.status === 'confirmed').length} />
          <StatCard icon={Star}       label="Ma note"
                    value={user?.rating_avg ? `${user.rating_avg}★` : '—'} color="light" />
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mt-4 -mb-px">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-6 py-3 font-condensed font-bold text-sm tracking-wider uppercase
                          border-b-2 transition-all duration-200
                          ${activeTab === i
                            ? 'border-brown-light text-brown-light'
                            : 'border-transparent text-white/40 hover:text-white/70'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {/* Corps */}
      <div className="flex-1 px-8 py-8 lg:px-16" style={{ padding: '32px 64px' }}>

        {/* Actions rapides */}
        <div className="flex gap-3 flex-wrap mb-8">
          <Link to="/envoyer" className="btn-primary text-sm">
            <Plus size={15} /> Envoyer un colis
          </Link>
          <Link to="/proposer-trajet" className="btn-outline text-sm">
            <Plus size={15} /> Proposer un trajet
          </Link>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 0 && (
            <motion.div key="parcels"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
              <h2 className="font-condensed font-extrabold text-2xl uppercase text-yoba-charcoal mb-5">
                Mes colis ({parcels.length})
              </h2>
              {parcels.length === 0 ? (
                <div className="bg-white rounded-xl p-12 border border-brown/[0.08] text-center">
                  <Package size={40} className="mx-auto mb-4 text-brown/30" />
                  <p className="font-condensed font-bold text-xl uppercase text-yoba-charcoal mb-2">
                    Aucun colis encore
                  </p>
                  <p className="text-sm text-yoba-gray-dark mb-6">
                    Envoyez votre premier colis en quelques minutes
                  </p>
                  <Link to="/envoyer" className="btn-primary">Envoyer un colis →</Link>
                </div>
              ) : (
                <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {parcels.map(p => <ParcelCard key={p.id} parcel={p} />)}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 1 && (
            <motion.div key="trips"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
              <h2 className="font-condensed font-extrabold text-2xl uppercase text-yoba-charcoal mb-5">
                Mes trajets ({trips.length})
              </h2>
              {trips.length === 0 ? (
                <div className="bg-white rounded-xl p-12 border border-brown/[0.08] text-center">
                  <MapPin size={40} className="mx-auto mb-4 text-brown/30" />
                  <p className="font-condensed font-bold text-xl uppercase text-yoba-charcoal mb-2">
                    Aucun trajet encore
                  </p>
                  <p className="text-sm text-yoba-gray-dark mb-6">
                    Proposez un trajet pour transporter des colis et gagner un revenu complémentaire
                  </p>
                  <Link to="/proposer-trajet" className="btn-primary">Proposer un trajet →</Link>
                </div>
              ) : (
                <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {trips.map(t => <TripCard key={t.id} trip={t} />)}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 2 && (
            <motion.div key="earnings"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
              <h2 className="font-condensed font-extrabold text-2xl uppercase text-yoba-charcoal mb-5">
                Revenus
              </h2>
              <div className="bg-white rounded-xl p-10 border border-brown/[0.08] text-center">
                <TrendingUp size={40} className="mx-auto mb-4 text-brown/30" />
                <p className="font-condensed font-extrabold text-4xl text-brown mb-1">
                  {totalEarned.toFixed(2)} €
                </p>
                <p className="text-sm text-yoba-gray-dark mb-2">Total gagné comme transporteur</p>
                <p className="text-xs text-yoba-gray-dark">
                  Consultez vos virements dans votre espace Stripe
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

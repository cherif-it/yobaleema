import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import HomePage      from '@/pages/HomePage'
import LoginPage     from '@/pages/LoginPage'
import RegisterPage  from '@/pages/RegisterPage'
import DashboardPage from '@/pages/DashboardPage'
import SendParcelPage from '@/pages/SendParcelPage'
import OfferTripPage from '@/pages/OfferTripPage'
import SearchPage    from '@/pages/SearchPage'
import ParcelDetailPage from '@/pages/ParcelDetailPage'
import NotFoundPage  from '@/pages/NotFoundPage'
import ProtectedRoute from '@/components/layout/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="connexion"   element={<LoginPage />} />
        <Route path="inscription" element={<RegisterPage />} />
        <Route path="recherche"   element={<SearchPage />} />

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route path="dashboard"     element={<DashboardPage />} />
          <Route path="envoyer"       element={<SendParcelPage />} />
          <Route path="proposer-trajet" element={<OfferTripPage />} />
          <Route path="colis/:id"     element={<ParcelDetailPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

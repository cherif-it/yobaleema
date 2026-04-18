import { Navigate, Outlet } from 'react-router-dom'
import useAuthStore from '@/store/authStore'

export default function ProtectedRoute() {
  const { user, accessToken } = useAuthStore()
  if (!user || !accessToken) return <Navigate to="/connexion" replace />
  return <Outlet />
}

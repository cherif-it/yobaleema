// Layout.jsx
import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'

export default function Layout() {
  const { pathname } = useLocation()
  const noFooter = ['/connexion','/inscription','/dashboard'].some(p => pathname.startsWith(p))
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1"><Outlet /></main>
      {!noFooter && <Footer />}
    </div>
  )
}

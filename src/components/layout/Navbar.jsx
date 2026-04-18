import { useState, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Menu, X, Package, LogOut, User } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import YobaleemaLogo from '@/components/ui/YobaleemaLogo'
import useAuthStore from '@/store/authStore'

export default function Navbar() {
  const [scrolled,    setScrolled]    = useState(false)
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [userMenuOpen,setUserMenuOpen]= useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Ferme le menu au changement de route
  useEffect(() => { setMenuOpen(false) }, [navigate])

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const navLinks = [
    { label: 'Comment ça marche', href: '/#fonctionnement' },
    { label: 'Fonctionnalités',   href: '/#fonctionnalites' },
    { label: 'Tarifs',            href: '/#tarifs' },
    { label: 'Avis',              href: '/#avis' },
  ]

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-400
          ${scrolled
            ? 'bg-yoba-gray/95 backdrop-blur-xl border-b border-brown/10 py-3 px-15'
            : 'bg-transparent py-5 px-15'
          }`}
        style={{ padding: scrolled ? '12px 60px' : '20px 60px' }}
      >
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/">
            <YobaleemaLogo size={34} textSize={20} />
          </Link>

          {/* Desktop links */}
          <div className="hidden lg:flex items-center gap-9">
            {navLinks.map(link => (
              <a
                key={link.href}
                href={link.href}
                className="text-xs font-bold tracking-[0.08em] uppercase text-yoba-gray-dark
                           hover:text-brown transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-3">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(v => !v)}
                  className="flex items-center gap-2.5 px-4 py-2 rounded
                             bg-brown/[0.08] hover:bg-brown/[0.14]
                             text-brown font-bold text-sm tracking-wide uppercase
                             font-condensed transition-colors duration-200"
                >
                  <User size={15} />
                  {user.first_name || user.email?.split('@')[0]}
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-52
                                 bg-yoba-white border border-brown/10 rounded-xl
                                 shadow-card-lg overflow-hidden z-50"
                    >
                      <Link
                        to="/dashboard"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3
                                   hover:bg-brown-ultra transition-colors duration-150
                                   text-sm font-semibold text-yoba-charcoal"
                      >
                        <Package size={15} className="text-brown" />
                        Mon tableau de bord
                      </Link>
                      <Link
                        to="/envoyer"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3
                                   hover:bg-brown-ultra transition-colors duration-150
                                   text-sm font-semibold text-yoba-charcoal"
                      >
                        Envoyer un colis
                      </Link>
                      <Link
                        to="/proposer-trajet"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3
                                   hover:bg-brown-ultra transition-colors duration-150
                                   text-sm font-semibold text-yoba-charcoal"
                      >
                        Proposer un trajet
                      </Link>
                      <hr className="border-brown/10" />
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3
                                   hover:bg-red-50 transition-colors duration-150
                                   text-sm font-semibold text-red-600 text-left"
                      >
                        <LogOut size={15} />
                        Se déconnecter
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <>
                <Link
                  to="/connexion"
                  className="text-xs font-bold tracking-[0.08em] uppercase text-yoba-gray-dark
                             hover:text-brown transition-colors duration-200 px-4 py-2"
                >
                  Connexion
                </Link>
                <Link to="/inscription" className="btn-primary text-sm px-6 py-2.5">
                  Commencer
                </Link>
              </>
            )}
          </div>

          {/* Burger (mobile) */}
          <button
            className="lg:hidden p-1.5 z-[101] relative"
            onClick={() => setMenuOpen(v => !v)}
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            <AnimatePresence mode="wait">
              {menuOpen
                ? <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}><X size={24} className="text-yoba-charcoal" /></motion.div>
                : <motion.div key="m" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}><Menu size={24} className="text-yoba-charcoal" /></motion.div>
              }
            </AnimatePresence>
          </button>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-yoba-white flex flex-col items-center justify-center gap-8"
          >
            {navLinks.map((link, i) => (
              <motion.a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="font-condensed font-bold text-2xl uppercase tracking-wide
                           text-yoba-charcoal hover:text-brown transition-colors"
              >
                {link.label}
              </motion.a>
            ))}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: navLinks.length * 0.07 }}
              className="flex flex-col gap-4 mt-4 w-64"
            >
              {user ? (
                <>
                  <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="btn-primary justify-center">
                    Mon dashboard
                  </Link>
                  <button onClick={() => { handleLogout(); setMenuOpen(false) }}
                    className="text-sm text-red-500 font-semibold py-2">
                    Se déconnecter
                  </button>
                </>
              ) : (
                <>
                  <Link to="/inscription" onClick={() => setMenuOpen(false)} className="btn-primary justify-center">
                    Commencer gratuitement
                  </Link>
                  <Link to="/connexion" onClick={() => setMenuOpen(false)} className="btn-outline justify-center">
                    Se connecter
                  </Link>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

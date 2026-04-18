import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, X, LogOut, User, Package, MapPin } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import YobaleemaLogo from '@/components/ui/YobaleemaLogo'
import useAuthStore from '@/store/authStore'

export default function Navbar() {
  const [scrolled,  setScrolled]  = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)
  const [userMenu,  setUserMenu]  = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  const handleLogout = async () => { await logout(); navigate('/') }

  const links = [
    { label:'Comment ça marche', href:'/#fonctionnement' },
    { label:'Fonctionnalités',   href:'/#fonctionnalites' },
    { label:'Tarifs',            href:'/#tarifs' },
    { label:'Avis',              href:'/#avis' },
  ]

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-400 flex items-center justify-between
        ${scrolled ? 'bg-yoba-gray/95 backdrop-blur-xl border-b border-brown/10 py-3 px-15' : 'bg-transparent py-5 px-15'}`}
        style={{ padding: scrolled ? '12px 60px' : '20px 60px' }}>
        <Link to="/"><YobaleemaLogo size={32} textSize={19} /></Link>

        {/* Desktop */}
        <div className="hidden lg:flex items-center gap-9">
          {links.map(l => (
            <a key={l.href} href={l.href}
               className="text-xs font-bold tracking-[0.08em] uppercase text-yoba-gray-dark hover:text-brown transition-colors">
              {l.label}
            </a>
          ))}
        </div>
        <div className="hidden lg:flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button onClick={() => setUserMenu(v => !v)}
                      className="flex items-center gap-2 px-4 py-2 rounded bg-brown/[0.08] hover:bg-brown/[0.14]
                                 text-brown font-condensed font-bold text-sm tracking-wide uppercase transition-colors">
                <User size={14} /> {user.firstName || user.first_name || user.email?.split('@')[0]}
              </button>
              <AnimatePresence>
                {userMenu && (
                  <motion.div
                    initial={{ opacity:0, y:6, scale:0.97 }} animate={{ opacity:1, y:0, scale:1 }}
                    exit={{ opacity:0, y:6, scale:0.97 }} transition={{ duration:0.15 }}
                    className="absolute right-0 top-full mt-2 w-52 bg-yoba-white border border-brown/10 rounded-xl shadow-card-lg overflow-hidden z-50">
                    {[
                      { to:'/dashboard',       icon:Package, label:'Mon dashboard' },
                      { to:'/envoyer',         icon:Package, label:'Envoyer un colis' },
                      { to:'/proposer-trajet', icon:MapPin,  label:'Proposer un trajet' },
                    ].map(item => (
                      <Link key={item.to} to={item.to} onClick={() => setUserMenu(false)}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-brown-ultra transition-colors text-sm font-semibold text-yoba-charcoal">
                        <item.icon size={14} className="text-brown" /> {item.label}
                      </Link>
                    ))}
                    <hr className="border-brown/10" />
                    <button onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 text-sm font-semibold text-red-600 text-left">
                      <LogOut size={14} /> Se déconnecter
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <Link to="/connexion" className="text-xs font-bold tracking-[0.08em] uppercase text-yoba-gray-dark hover:text-brown transition-colors px-4 py-2">Connexion</Link>
              <Link to="/inscription" className="btn-primary text-sm px-6 py-2.5">Commencer</Link>
            </>
          )}
        </div>

        {/* Burger */}
        <button className="lg:hidden p-1.5 z-[101] relative" onClick={() => setMenuOpen(v => !v)}>
          <AnimatePresence mode="wait">
            {menuOpen
              ? <motion.div key="x" initial={{ rotate:-90,opacity:0 }} animate={{ rotate:0,opacity:1 }} exit={{ rotate:90,opacity:0 }} transition={{ duration:0.2 }}><X size={22} className="text-yoba-charcoal" /></motion.div>
              : <motion.div key="m" initial={{ rotate:90,opacity:0 }} animate={{ rotate:0,opacity:1 }} exit={{ rotate:-90,opacity:0 }} transition={{ duration:0.2 }}><Menu size={22} className="text-yoba-charcoal" /></motion.div>
            }
          </AnimatePresence>
        </button>
      </nav>

      {/* Mobile overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                      className="fixed inset-0 z-40 bg-yoba-white flex flex-col items-center justify-center gap-8">
            {links.map((l,i) => (
              <motion.a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
                        initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.07 }}
                        className="font-condensed font-bold text-2xl uppercase tracking-wide text-yoba-charcoal hover:text-brown">
                {l.label}
              </motion.a>
            ))}
            <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:links.length*0.07 }}
                        className="flex flex-col gap-3 w-64">
              {user
                ? <button onClick={() => { handleLogout(); setMenuOpen(false) }} className="btn-outline justify-center text-red-500 border-red-300">Se déconnecter</button>
                : <>
                    <Link to="/inscription" onClick={() => setMenuOpen(false)} className="btn-primary justify-center">Commencer</Link>
                    <Link to="/connexion"   onClick={() => setMenuOpen(false)} className="btn-outline justify-center">Se connecter</Link>
                  </>
              }
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

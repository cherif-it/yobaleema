import { useEffect, useRef, useState } from 'react'

// ============================================================
//  useScrollReveal — Déclenche une animation quand l'élément
//  entre dans le viewport (IntersectionObserver)
// ============================================================

export default function useScrollReveal(options = {}) {
  const ref       = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(el) // une seule fois
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px', ...options }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, visible }
}

import { motion } from 'framer-motion'
import { useRef } from 'react'
import { useInView } from 'framer-motion'

// ============================================================
//  Reveal — Wrapper d'animation au scroll avec framer-motion
//  Props:
//    delay  (number) — délai en secondes (0, 0.1, 0.2...)
//    y      (number) — décalage vertical de départ (défaut 28)
//    className (string) — classes CSS supplémentaires
// ============================================================

export default function Reveal({ children, delay = 0, y = 28, className = '', as = 'div' }) {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -60px 0px' })

  const MotionTag = motion[as] || motion.div

  return (
    <MotionTag
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.65, delay, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </MotionTag>
  )
}

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

export default function Reveal({ children, delay = 0, y = 28, className = '' }) {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -60px 0px' })
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.65, delay, ease: [0.4, 0, 0.2, 1] }}>
      {children}
    </motion.div>
  )
}

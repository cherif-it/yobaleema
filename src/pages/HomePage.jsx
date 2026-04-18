import HeroSection from '@/components/sections/HeroSection'
import {
  TrustBar,
  HowItWorksSection,
  FeaturesSection,
  PricingSection,
  TestimonialsSection,
  CTASection,
} from '@/components/sections'

// ============================================================
//  HomePage — Assemble toutes les sections
// ============================================================
export default function HomePage() {
  return (
    <>
      <HeroSection />
      <TrustBar />
      <HowItWorksSection />
      <FeaturesSection />
      <PricingSection />
      <TestimonialsSection />
      <CTASection />
    </>
  )
}

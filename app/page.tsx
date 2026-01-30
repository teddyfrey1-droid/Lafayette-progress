"use client"

import Link from "next/link"
import { PulseLogo } from "@/components/pulse/pulse-logo"
import { Button } from "@/components/ui/button"
import { Target, Coins, Gift, BarChart3, ChevronDown } from "lucide-react"
import { useState } from "react"

const faqs = [
  {
    question: "Comment sont calculées mes primes ?",
    answer:
      "Vos primes sont calculées automatiquement en fonction de vos objectifs atteints. Chaque palier débloqué correspond à un montant défini par votre entreprise.",
  },
  {
    question: "Quand les primes sont-elles versées ?",
    answer:
      "Les primes sont généralement versées à la fin de chaque mois, une fois les objectifs validés par votre responsable.",
  },
  {
    question: "Puis-je voir l'historique de mes primes ?",
    answer:
      "Oui, vous avez accès à l'historique complet de vos primes dans la section dédiée de votre tableau de bord.",
  },
]

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border-b border-border last:border-0">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between py-4 text-left">
        <span className="font-medium text-foreground">{question}</span>
        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && <div className="pb-4 text-muted-foreground text-sm">{answer}</div>}
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <PulseLogo size="sm" />
          <div className="flex items-center gap-2">
            <Link href="/connexion">
              <Button variant="ghost" size="sm" className="text-sm">
                Connexion
              </Button>
            </Link>
            <Link href="/inscription">
              <Button size="sm" className="text-sm pulse-gradient text-white">
                Commencer
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-4 pt-12 pb-16 max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            Nouvelle version disponible
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-balance mb-4">
            Suivez vos objectifs, <span className="pulse-gradient-text">débloquez vos primes</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto text-balance">
            Pulse vous accompagne dans l'atteinte de vos objectifs professionnels avec un suivi clair et des récompenses
            motivantes.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
          <Link href="/inscription">
            <Button size="lg" className="pulse-gradient text-white w-full sm:w-auto">
              Démarrer gratuitement
            </Button>
          </Link>
          <Link href="/connexion">
            <Button variant="outline" size="lg" className="w-full sm:w-auto bg-transparent">
              Se connecter
            </Button>
          </Link>
        </div>

        {/* Preview Card */}
        <div className="relative max-w-sm mx-auto">
          <div className="absolute inset-0 pulse-gradient opacity-20 blur-3xl rounded-full" />
          <div className="relative bg-card border border-border rounded-3xl p-6 shadow-xl">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Progression du mois
            </p>
            <div className="flex items-center justify-center my-6">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-muted/20"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="url(#previewGradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={264}
                    strokeDashoffset={264 * 0.3}
                  />
                  <defs>
                    <linearGradient id="previewGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#D10FA8" />
                      <stop offset="100%" stopColor="#7A2FF0" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold">70%</span>
                  <span className="text-[10px] text-muted-foreground">objectifs atteints</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Prime totale possible</p>
                <p className="text-lg font-bold">200 €</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Acquis</p>
                <p className="text-lg font-bold text-primary">140 €</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">7/10 objectifs</span>
              </div>
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">2 bonus</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-16 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
              Tout ce dont vous avez besoin
            </p>
            <h2 className="text-2xl md:text-3xl font-bold">
              Une plateforme complète pour suivre vos performances et maximiser vos gains.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Objectifs clairs</h3>
              <p className="text-muted-foreground text-sm">
                Définissez et suivez vos objectifs avec une visualisation intuitive de votre progression.
              </p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Coins className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Primes motivantes</h3>
              <p className="text-muted-foreground text-sm">
                Débloquez des primes en atteignant vos objectifs. Transparence totale sur vos gains.
              </p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Gift className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Bonus exclusifs</h3>
              <p className="text-muted-foreground text-sm">
                Accédez à des bonus exceptionnels en dépassant vos performances.
              </p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Suivi en temps réel</h3>
              <p className="text-muted-foreground text-sm">
                Tableau de bord complet pour visualiser votre évolution au quotidien.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Preview Section */}
      <section className="px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Un tableau de bord intuitif</h2>
            <p className="text-muted-foreground">
              Visualisez vos performances d'un coup d'œil avec des indicateurs clairs.
            </p>
          </div>

          <div className="max-w-sm mx-auto grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-2xl p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Primes du mois</p>
              <p className="text-2xl font-bold text-primary">120 €</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Objectifs actifs</p>
              <p className="text-2xl font-bold">3</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Bonus débloqués</p>
              <p className="text-2xl font-bold">2</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-4 py-16 bg-muted/30">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Questions fréquentes</h2>
          <div className="bg-card border border-border rounded-2xl px-6">
            {faqs.map((faq, index) => (
              <FAQItem key={index} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-16">
        <div className="max-w-lg mx-auto text-center">
          <div className="bg-card border border-border rounded-3xl p-8 relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 pulse-gradient opacity-10 blur-3xl rounded-full" />
            <div className="relative">
              <h2 className="text-2xl font-bold mb-3">Prêt à booster votre motivation ?</h2>
              <p className="text-muted-foreground mb-6">
                Rejoignez Pulse et commencez à suivre vos objectifs dès aujourd'hui.
              </p>
              <Link href="/inscription">
                <Button size="lg" className="pulse-gradient text-white">
                  Créer mon compte
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 border-t border-border">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <PulseLogo size="sm" />
          <p className="text-xs text-muted-foreground">© 2026 Pulse. Tous droits réservés.</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="#" className="hover:text-foreground transition-colors">
              Confidentialité
            </Link>
            <Link href="#" className="hover:text-foreground transition-colors">
              Conditions
            </Link>
            <Link href="#" className="hover:text-foreground transition-colors">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

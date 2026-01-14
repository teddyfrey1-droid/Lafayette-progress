"use client"

import { useState } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import {
  HelpCircle,
  Book,
  MessageCircle,
  Mail,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Trophy,
  Target,
  Coins,
} from "lucide-react"

const faqItems = [
  {
    icon: Coins,
    question: "Comment sont calculees mes primes ?",
    answer:
      "Les primes sont calculees automatiquement en fonction de vos objectifs atteints. Chaque palier debloque vous rapporte un montant defini.",
  },
  {
    icon: Target,
    question: "Quand sont versees les primes ?",
    answer:
      "Les primes sont validees le 5 du mois suivant et versees le 15. Vous recevez une notification lors du versement.",
  },
  {
    icon: Trophy,
    question: "Comment debloquer les objectifs secondaires ?",
    answer:
      "Les objectifs secondaires se debloquent automatiquement lorsque vous atteignez le premier palier de l'objectif principal.",
  },
  {
    icon: Sparkles,
    question: "Comment fonctionne le systeme de niveaux ?",
    answer:
      "Gagnez de l'XP en completant des objectifs et en maintenant votre serie quotidienne. Chaque niveau debloque de nouveaux succes.",
  },
]

const supportOptions = [
  {
    icon: Book,
    title: "Documentation",
    description: "Guides et tutoriels complets",
    action: "Consulter",
    color: "bg-blue-500/15 text-blue-500",
  },
  {
    icon: MessageCircle,
    title: "Chat support",
    description: "Discutez avec notre equipe",
    action: "Demarrer",
    color: "bg-green-500/15 text-green-500",
  },
  {
    icon: Mail,
    title: "Email",
    description: "support@pulse.app",
    action: "Envoyer",
    color: "bg-purple-500/15 text-purple-500",
  },
]

export default function HelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Page Title */}
        <div>
          <h1 className="text-2xl font-bold">Aide</h1>
          <p className="text-sm text-muted-foreground mt-1">Trouvez des reponses a vos questions</p>
        </div>

        {/* Support Options */}
        <section className="space-y-3">
          <h2 className="font-semibold">Besoin d'aide ?</h2>
          <div className="grid gap-3">
            {supportOptions.map((option) => (
              <div key={option.title} className="pulse-card p-4 cursor-pointer hover:border-primary/30 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${option.color}`}>
                      <option.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{option.title}</p>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                  <button className="text-xs font-medium text-primary flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors">
                    {option.action}
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary" />
            Questions frequentes
          </h2>
          <div className="space-y-3">
            {faqItems.map((item, index) => (
              <div
                key={index}
                className="pulse-card overflow-hidden cursor-pointer"
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10">
                      <item.icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="font-medium text-sm pr-4">{item.question}</span>
                  </div>
                  <ChevronRight
                    className={`w-5 h-5 text-muted-foreground transition-transform shrink-0 ${openFaq === index ? "rotate-90" : ""}`}
                  />
                </div>
                {openFaq === index && (
                  <div className="px-4 pb-4 pt-0">
                    <p className="text-sm text-muted-foreground pl-11">{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Contact Card */}
        <div className="pulse-card p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/15 flex items-center justify-center mb-4 animate-float">
              <MessageCircle className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">Vous ne trouvez pas votre reponse ?</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Notre equipe est la pour vous aider</p>
            <button className="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              Contacter le support
            </button>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}

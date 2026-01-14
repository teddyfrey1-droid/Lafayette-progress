"use client"

import { useState } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { StatCard } from "@/components/pulse/stat-card"
import { CelebrationModal } from "@/components/pulse/celebration-modal"
import { primes, getCurrentPrime, calculateTotalPotentialPrime } from "@/lib/demo-data"
import { Coins, TrendingUp, Calendar, Check, Clock, CreditCard, Sparkles, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"

export default function PrimesPage() {
  const [showCelebration, setShowCelebration] = useState(false)
  const currentPrime = getCurrentPrime()
  const totalPotential = calculateTotalPotentialPrime()
  const paidPrimes = primes.filter((p) => p.status === "paid")
  const totalPaid = paidPrimes.reduce((sum, p) => sum + p.amount, 0)

  const progressPercent = ((currentPrime?.amount ?? 0) / totalPotential) * 100

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Page Title */}
        <div>
          <h1 className="text-2xl font-bold">Primes & Historique</h1>
          <p className="text-sm text-muted-foreground mt-1">Suivez vos primes mensuelles</p>
        </div>

        {/* Current Month Prime - Hero Card */}
        <div
          className="pulse-card p-5 bg-gradient-to-br from-primary/10 via-card to-accent/10 border-primary/20 cursor-pointer animate-rainbow-border"
          onClick={() => setShowCelebration(true)}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-primary" />
                <p className="text-xs font-medium text-primary uppercase tracking-wider">Prime du mois</p>
              </div>
              <p className="text-4xl font-bold">{currentPrime?.amount.toLocaleString() ?? 0}€</p>
            </div>
            <div className="p-3 rounded-2xl bg-primary/20 animate-float">
              <Coins className="w-8 h-8 text-primary" />
            </div>
          </div>

          {/* Progress Ring Visual */}
          <div className="relative h-4 bg-muted rounded-full overflow-hidden mb-2">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] animate-shimmer rounded-full transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
            {/* Milestones */}
            {[25, 50, 75].map((milestone) => (
              <div
                key={milestone}
                className="absolute top-0 bottom-0 w-0.5 bg-background/50"
                style={{ left: `${milestone}%` }}
              />
            ))}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Potentiel total</span>
            <span className="font-semibold">{totalPotential}€</span>
          </div>

          <p className="text-xs text-center mt-2 text-muted-foreground">
            <Trophy className="w-3 h-3 inline mr-1" />
            {Math.round(progressPercent)}% du potentiel atteint
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title="Total verse"
            value={`${totalPaid}€`}
            subtitle="3 derniers mois"
            icon={CreditCard}
            trend="up"
            trendValue="+12%"
          />
          <StatCard
            title="Moyenne"
            value={`${Math.round(totalPaid / Math.max(paidPrimes.length, 1))}€`}
            subtitle="Par mois"
            icon={TrendingUp}
          />
        </div>

        {/* Prime History */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Historique</h2>
            <span className="text-xs text-muted-foreground">{primes.length} mois</span>
          </div>

          <div className="space-y-3">
            {primes.map((prime, index) => (
              <div
                key={prime.id}
                className={cn(
                  "pulse-card p-4 transition-all",
                  index === 0 && prime.status === "pending" && "border-primary/30 animate-glow-pulse",
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        prime.status === "paid" && "bg-green-500/15 text-green-500",
                        prime.status === "validated" && "bg-blue-500/15 text-blue-500",
                        prime.status === "pending" && "bg-yellow-500/15 text-yellow-500",
                      )}
                    >
                      {prime.status === "paid" && <Check className="w-5 h-5" />}
                      {prime.status === "validated" && <CreditCard className="w-5 h-5" />}
                      {prime.status === "pending" && <Clock className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-semibold">{prime.month}</p>
                      <p
                        className={cn(
                          "text-xs font-medium",
                          prime.status === "paid" && "text-green-500",
                          prime.status === "validated" && "text-blue-500",
                          prime.status === "pending" && "text-yellow-500",
                        )}
                      >
                        {prime.status === "paid" && "Versee"}
                        {prime.status === "validated" && "Validee"}
                        {prime.status === "pending" && "En cours"}
                      </p>
                    </div>
                  </div>
                  <p className="text-xl font-bold">{prime.amount}€</p>
                </div>

                {/* Breakdown */}
                {prime.breakdown.length > 0 && (
                  <div className="pt-3 border-t border-border/50 space-y-2">
                    {prime.breakdown.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{item.objectiveTitle}</span>
                        <span className="font-medium text-green-500">+{item.amount}€</span>
                      </div>
                    ))}
                  </div>
                )}

                {prime.status === "pending" && prime.breakdown.length === 0 && (
                  <div className="pt-3 border-t border-border/50">
                    <p className="text-xs text-muted-foreground text-center">
                      Les primes seront calculees a la fin du mois
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Info */}
        <div className="pulse-card p-4 bg-muted/30">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Calendrier des versements</p>
              <p className="text-xs text-muted-foreground mt-1">
                Les primes sont validees le 5 du mois suivant et versees le 15.
              </p>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />

      <CelebrationModal
        open={showCelebration}
        onClose={() => setShowCelebration(false)}
        title="Continue comme ca!"
        subtitle="Tu es sur la bonne voie pour maximiser tes primes ce mois-ci"
        reward={totalPotential - (currentPrime?.amount ?? 0)}
        type="palier"
      />
    </div>
  )
}

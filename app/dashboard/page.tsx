"use client"
import { Header } from "@/components/pulse/header"
import { useAuth } from "@/components/pulse/auth/auth-provider"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { MainGauge } from "@/components/pulse/main-gauge"
import { CountdownTimer } from "@/components/pulse/countdown-timer"
import { objectives, calculateTotalPotentialPrime, getCriticalAlerts } from "@/lib/demo-data"
import { Coins, Target, Thermometer, ChevronRight, TrendingUp, Clock } from "lucide-react"
import Link from "next/link"

export default function Dashboard() {
  const { profile } = useAuth()
  const totalPotential = calculateTotalPotentialPrime()
  const criticalAlerts = getCriticalAlerts()

  const unlockedPrime = objectives.reduce((total, obj) => {
    return total + obj.paliers.filter((p) => p.unlocked).reduce((sum, p) => sum + p.reward, 0)
  }, 0)

  const pendingPrime = totalPotential - unlockedPrime
  const totalProgress = objectives.reduce((sum, obj) => sum + (obj.progress / obj.target) * 100, 0) / objectives.length
  const activeObjectives = objectives.filter((o) => o.isActive).length

  const endOfMonth = new Date()
  endOfMonth.setMonth(endOfMonth.getMonth() + 1)
  endOfMonth.setDate(0)
  endOfMonth.setHours(23, 59, 59, 999)

  const currentMonth = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto">
        {/* Critical Alert Banner */}
        {criticalAlerts.length > 0 && (
          <Link href="/diffusion" className="block mb-6">
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                  <Thermometer className="w-5 h-5 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-red-400">
                    {criticalAlerts.length} alerte{criticalAlerts.length > 1 ? "s" : ""} température
                  </p>
                  <p className="text-xs text-red-400/70 truncate">
                    {criticalAlerts.map((a) => a.fridgeName).join(", ")}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-red-400 shrink-0" />
              </div>
            </div>
          </Link>
        )}

        <div className="text-center mb-6">
          <p className="text-lg font-medium text-muted-foreground mb-1">Bonjour, {(profile?.name || "Utilisateur").split(" ")[0]}</p>
          <h1 className="text-3xl font-bold tracking-tight">Objectif principal</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">{currentMonth}</p>
        </div>

        <div className="flex justify-center mb-6">
          <MainGauge
            progress={totalProgress}
            unlockedAmount={unlockedPrime}
            pendingAmount={pendingPrime}
            size={220}
            strokeWidth={14}
          />
        </div>

        {/* Countdown */}
        <div className="mb-8">
          <CountdownTimer targetDate={endOfMonth} />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-4 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-4 h-4 text-primary" />
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Primes</p>
            </div>
            <p className="text-xl font-bold text-foreground">{unlockedPrime.toFixed(2)}€</p>
            <p className="text-xs text-muted-foreground">Débloquées</p>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-primary" />
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Objectifs</p>
            </div>
            <p className="text-xl font-bold text-foreground">{activeObjectives}</p>
            <p className="text-xs text-muted-foreground">Actifs</p>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Potentiel</p>
            </div>
            <p className="text-xl font-bold text-foreground">{totalPotential}€</p>
            <p className="text-xs text-muted-foreground">Maximum</p>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-primary" />
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Mise à jour</p>
            </div>
            <p className="text-xl font-bold text-foreground">
              {new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
            </p>
            <p className="text-xs text-muted-foreground">Aujourd'hui</p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="space-y-2">
          <Link
            href="/objectifs"
            className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Voir les objectifs</p>
                <p className="text-xs text-muted-foreground">{activeObjectives} actifs ce mois</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </Link>

          <Link
            href="/primes"
            className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Coins className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Historique des primes</p>
                <p className="text-xs text-muted-foreground">Consultez vos primes passées</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}

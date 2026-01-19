"use client"

import { useMemo, useState } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { BadgeCheck, CheckCircle2, ChevronRight, Clock, Coins } from "lucide-react"
import { calculateProRataPrime, calculateTotalPotentialPrime, getCurrentPrime, primes as demoPrimes, type Prime } from "@/lib/demo-data"
import { useAuth } from "@/components/auth/auth-provider"
import { cn } from "@/lib/utils"

function statusMeta(status: Prime["status"]) {
  switch (status) {
    case "paid":
      return { label: "Payée", icon: CheckCircle2, className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/20" }
    case "validated":
      return { label: "Validée", icon: BadgeCheck, className: "bg-blue-500/15 text-blue-700 border-blue-500/20" }
    default:
      return { label: "En cours", icon: Clock, className: "bg-amber-500/15 text-amber-700 border-amber-500/20" }
  }
}

export default function PrimesPage() {
  const { profile } = useAuth()
  const [selectedPrime, setSelectedPrime] = useState<Prime | null>(null)

  const currentPrime = useMemo(() => getCurrentPrime(), [])
  const totalPotential = useMemo(() => calculateTotalPotentialPrime(), [])

  const contractHours = profile?.contractHours ?? 35
  const baseHours = 35

  const currentAmount = currentPrime?.amount ?? 0
  const currentAmountProRata = useMemo(() => {
    try {
      return calculateProRataPrime(currentAmount, contractHours, baseHours)
    } catch {
      return currentAmount
    }
  }, [currentAmount, contractHours])

  const progress = totalPotential > 0 ? Math.min(100, Math.round((currentAmount / totalPotential) * 100)) : 0

  const ordered = useMemo(() => {
    // On affiche d'abord la prime en cours, puis le reste par ordre inverse (simple)
    const list = [...demoPrimes]
    return list
  }, [])

  return (
    <PermissionGate moduleId="primes" redirect>
      <div className="min-h-screen bg-background pb-32">
        <Header />

        <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Coins className="w-6 h-6 text-primary" />
              Primes & Historique
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Suivi des primes, validation et historique.</p>
          </div>

          <section className="pulse-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Prime en cours</p>
                <p className="text-2xl font-bold mt-1">{currentAmount.toLocaleString("fr-FR")} €</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Pro-rata ({contractHours}h) : <span className="font-medium">{currentAmountProRata.toLocaleString("fr-FR")} €</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Potentiel max</p>
                <p className="text-lg font-semibold mt-1">{totalPotential.toLocaleString("fr-FR")} €</p>
                <Badge className={cn("mt-2", "bg-muted text-foreground border-border")}>{progress}%</Badge>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progression</span>
                <span>
                  {currentAmount.toLocaleString("fr-FR")} € / {totalPotential.toLocaleString("fr-FR")} €
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Historique</h2>
              <p className="text-xs text-muted-foreground">{ordered.length} entrées</p>
            </div>

            <div className="space-y-3">
              {ordered.map((p) => {
                const meta = statusMeta(p.status)
                const Icon = meta.icon
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPrime(p)}
                    className="w-full text-left pulse-card p-4 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Coins className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold leading-tight">{p.month}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Montant : <span className="font-medium text-foreground">{p.amount.toLocaleString("fr-FR")} €</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={cn("border", meta.className)}>
                              <Icon className="w-3.5 h-3.5 mr-1" />
                              {meta.label}
                            </Badge>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground mt-2 line-clamp-1">
                          {p.breakdown?.length ? `${p.breakdown.length} ligne(s) de détail` : "Aucun détail"}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        </main>

        <BottomNav />

        <Sheet open={!!selectedPrime} onOpenChange={(open) => !open && setSelectedPrime(null)}>
          <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{selectedPrime?.month || "Détail"}</SheetTitle>
              <SheetDescription>
                Montant : {selectedPrime?.amount?.toLocaleString("fr-FR") || 0} €
              </SheetDescription>
            </SheetHeader>

            {selectedPrime && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Statut</span>
                  <span className="text-xs font-medium">{statusMeta(selectedPrime.status).label}</span>
                </div>

                <div className="pulse-card p-4 space-y-2">
                  <p className="text-sm font-semibold">Répartition</p>
                  {selectedPrime.breakdown?.length ? (
                    <div className="space-y-2">
                      {selectedPrime.breakdown.map((b) => (
                        <div key={b.objectiveId} className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{b.objectiveTitle}</p>
                            <p className="text-xs text-muted-foreground">ID: {b.objectiveId}</p>
                          </div>
                          <p className="text-sm font-semibold">{b.amount.toLocaleString("fr-FR")} €</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun détail disponible pour cette prime.</p>
                  )}
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </PermissionGate>
  )
}

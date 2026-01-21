"use client"

import { MotionDiv } from "@/components/ui/motion"
import { PulseHeader } from "@/components/pulse/header"
import { ProgressRing } from "@/components/pulse/progress-ring"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { Card } from "@/components/ui/card"
import { useCurrentUser } from "@/lib/use-current-user"
import { prorataRatio } from "@/lib/identity"
import { useObjectives } from "@/hooks/use-objectives"
import { objectiveProgressPct } from "@/lib/bonus-engine"
import { PermissionGate } from "@/components/auth/permission-gate"

export default function DashboardPage() {
  const user = useCurrentUser()
  const {
    objectives,
    loading,
    totalPotential,
    unlocked,
    totalPotentialProRata,
    unlockedProRata,
    pendingProRata,
  } = useObjectives(user.contractHours, user.excludeFromPrimes)

  const firstName = (user.displayName || "").split(" ")[0] || ""

  const activeObjectives = objectives.filter((o) => o.isActive)
const completedCount = activeObjectives.filter((o) => objectiveProgressPct(o) >= 100).length

const moneyPct =
  totalPotentialProRata > 0 ? Math.round((unlockedProRata / totalPotentialProRata) * 100) : 0
const countPct = activeObjectives.length ? Math.round((completedCount / activeObjectives.length) * 100) : 0
const progressPct = totalPotentialProRata > 0 ? moneyPct : countPct

  return (
    <PermissionGate moduleId="dashboard" action="view" redirect>
      <div className="min-h-screen bg-background pb-20">
        <PulseHeader title={`Bonjour ${firstName || ""} 👋`} subtitle="Voici votre progression" />

        <div className="max-w-lg mx-auto px-4 space-y-4">
          <MotionDiv initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Progression</div>
                  <div className="text-2xl font-semibold">{loading ? "—" : `${progressPct}%`}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {loading ? "" : `${completedCount}/${activeObjectives.length} objectifs atteints`}
                  </div>
                </div>
                <ProgressRing progress={progressPct} size={88} />
              </div>
            </Card>
          </MotionDiv>

          <MotionDiv initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.05 }}>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Primes possibles</div>
                  <div className="text-2xl font-semibold">{loading ? "—" : `${totalPotential} €`}</div>
                  <div className="text-xs text-muted-foreground mt-1">Max théorique sur base 35h</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Déjà débloqué</div>
                  <div className="text-2xl font-semibold">{loading ? "—" : `${unlocked} €`}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">Prorata</div>
                  <div className="text-sm font-semibold">{Math.round(prorataRatio(user.contractHours, 35) * 100)}%</div>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">Max (prorata)</div>
                  <div className="text-sm font-semibold">{loading ? "—" : `${totalPotentialProRata} €`}</div>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">Reste</div>
                  <div className="text-sm font-semibold">{loading ? "—" : `${pendingProRata} €`}</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs text-muted-foreground">Déjà débloqué (prorata)</div>
                <div className="text-lg font-semibold">{loading ? "—" : `${unlockedProRata} €`}</div>
              </div>
            </Card>
          </MotionDiv>
        </div>

        <BottomNav />
      </div>
    </PermissionGate>
  )
}

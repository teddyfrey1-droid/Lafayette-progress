"use client"

import { useState } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { ProgressRing } from "@/components/pulse/progress-ring"
import { PalierTimeline } from "@/components/pulse/palier-timeline"
import { CelebrationModal } from "@/components/pulse/celebration-modal"
import { getPrincipalObjective, getSecondaryObjectives, getNextPalier, type Objective } from "@/lib/demo-data"
import { Target, ChevronRight, Sparkles, Info, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"

const objectiveHistory: Record<string, { date: string; value: number; label: string }[]> = {
  "obj-1": [
    { date: "06/01", value: 45000, label: "06 Jan" },
    { date: "07/01", value: 52000, label: "07 Jan" },
    { date: "08/01", value: 58000, label: "08 Jan" },
    { date: "09/01", value: 62000, label: "09 Jan" },
    { date: "10/01", value: 68000, label: "10 Jan" },
    { date: "11/01", value: 72000, label: "11 Jan" },
    { date: "12/01", value: 75000, label: "12 Jan" },
  ],
  "obj-2": [
    { date: "06/01", value: 3, label: "06 Jan" },
    { date: "07/01", value: 4, label: "07 Jan" },
    { date: "08/01", value: 5, label: "08 Jan" },
    { date: "09/01", value: 6, label: "09 Jan" },
    { date: "10/01", value: 7, label: "10 Jan" },
    { date: "11/01", value: 7, label: "11 Jan" },
    { date: "12/01", value: 8, label: "12 Jan" },
  ],
  "obj-3": [
    { date: "06/01", value: 18, label: "06 Jan" },
    { date: "07/01", value: 19, label: "07 Jan" },
    { date: "08/01", value: 19, label: "08 Jan" },
    { date: "09/01", value: 20, label: "09 Jan" },
    { date: "10/01", value: 21, label: "10 Jan" },
    { date: "11/01", value: 21, label: "11 Jan" },
    { date: "12/01", value: 22, label: "12 Jan" },
  ],
  "obj-4": [
    { date: "06/01", value: 3.8, label: "06 Jan" },
    { date: "07/01", value: 3.9, label: "07 Jan" },
    { date: "08/01", value: 4.0, label: "08 Jan" },
    { date: "09/01", value: 4.0, label: "09 Jan" },
    { date: "10/01", value: 4.1, label: "10 Jan" },
    { date: "11/01", value: 4.1, label: "11 Jan" },
    { date: "12/01", value: 4.2, label: "12 Jan" },
  ],
}

export default function ObjectivesPage() {
  const [selectedObjective, setSelectedObjective] = useState<Objective | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)
  const principalObjective = getPrincipalObjective()
  const secondaryObjectives = getSecondaryObjectives()

  const principalProgress = principalObjective ? (principalObjective.progress / principalObjective.target) * 100 : 0

  if (selectedObjective) {
    return (
      <ObjectiveDetail
        objective={selectedObjective}
        onBack={() => setSelectedObjective(null)}
        isPrimary={selectedObjective.type === "principal"}
        history={objectiveHistory[selectedObjective.id] || []}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Page Title */}
        <div>
          <h1 className="text-2xl font-bold">Objectifs</h1>
          <p className="text-sm text-muted-foreground mt-1">Suivez votre progression et debloquez vos primes</p>
        </div>

        {/* Principal Objective Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Objectif Principal</h2>
          </div>

          {principalObjective && (
            <div
              className="pulse-card p-5 cursor-pointer border-primary/30"
              onClick={() => setSelectedObjective(principalObjective)}
            >
              <div className="flex flex-col items-center text-center mb-4">
                <ProgressRing progress={principalProgress} size={100} strokeWidth={8} showPercentage={true} />
                <h3 className="font-semibold mt-3">{principalObjective.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{principalObjective.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary font-medium">
                    Principal
                  </span>
                  <span className="text-xs text-muted-foreground">Prime: {principalObjective.reward}€</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progression</span>
                  <span className="font-semibold">
                    {principalObjective.progress.toLocaleString()} / {principalObjective.target.toLocaleString()}{" "}
                    {principalObjective.unit}
                  </span>
                </div>
                <Progress
                  value={principalProgress}
                  className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-accent"
                />
              </div>

              {/* History Preview - Vertical bars like the reference image */}
              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-3">Historique récent</p>
                <ProgressBarsHistory
                  history={objectiveHistory[principalObjective.id] || []}
                  target={principalObjective.target}
                />
              </div>

              {/* Next Palier */}
              {getNextPalier(principalObjective) && (
                <div className="mt-4 p-3 rounded-xl bg-muted/50 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Prochain palier</p>
                    <p className="font-medium text-sm">{getNextPalier(principalObjective)?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Objectif</p>
                    <p className="font-semibold text-primary">
                      {getNextPalier(principalObjective)?.target.toLocaleString()} {principalObjective.unit}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
            </div>
          )}
        </section>

        {/* Secondary Objectives Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-accent" />
              <h2 className="font-semibold">Objectifs Secondaires</h2>
            </div>
            <span className="text-xs text-muted-foreground">{secondaryObjectives.length} objectifs</span>
          </div>

          <div className="grid gap-3">
            {secondaryObjectives.map((obj) => {
              const progress = (obj.progress / obj.target) * 100
              const nextPalier = getNextPalier(obj)

              return (
                <div key={obj.id} className="pulse-card p-4 cursor-pointer" onClick={() => setSelectedObjective(obj)}>
                  <div className="text-center mb-3">
                    <div className="flex justify-center mb-2">
                      <div className="p-2 rounded-xl bg-accent/15">
                        <TrendingUp className="w-4 h-4 text-accent" />
                      </div>
                    </div>
                    <h3 className="font-semibold text-sm">{obj.title}</h3>
                    <p className="text-xs text-muted-foreground">{obj.description}</p>
                  </div>

                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-lg font-bold">
                        {obj.progress.toLocaleString()}
                        <span className="text-sm font-normal text-muted-foreground ml-1">
                          / {obj.target.toLocaleString()} {obj.unit}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={progress} className="h-2 flex-1" />
                      <span className="text-sm font-semibold text-accent w-12 text-right">{Math.round(progress)}%</span>
                    </div>
                  </div>

                  {/* History bars */}
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <ProgressBarsHistory history={objectiveHistory[obj.id] || []} target={obj.target} compact />
                  </div>

                  {/* Next Palier */}
                  {nextPalier && (
                    <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Prochain: <span className="font-medium text-foreground">{nextPalier.name}</span>
                      </span>
                      <span className="text-xs font-semibold text-accent">+{nextPalier.reward}€</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Info */}
        <div className="pulse-card p-4 bg-muted/30">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Les paliers se debloquent automatiquement lorsque vous atteignez les objectifs. Les primes sont calculees
              a la fin du mois.
            </p>
          </div>
        </div>
      </main>

      <BottomNav />

      <CelebrationModal
        open={showCelebration}
        onClose={() => setShowCelebration(false)}
        title="Nouveau Succes!"
        subtitle="Vous avez debloque un nouveau succes"
        type="achievement"
      />
    </div>
  )
}

function ProgressBarsHistory({
  history,
  target,
  compact = false,
}: {
  history: { date: string; value: number; label: string }[]
  target: number
  compact?: boolean
}) {
  if (history.length === 0) return null

  const maxValue = Math.max(...history.map((h) => h.value), target)
  const barHeight = compact ? 40 : 60

  return (
    <div className={cn("flex items-end gap-1", compact ? "h-12" : "h-16")}>
      {history.map((point, index) => {
        const heightPercent = (point.value / maxValue) * 100
        const isLatest = index === history.length - 1
        const isPrevious = index === history.length - 2

        // Gradient from purple to pink/red based on position
        const hue = 280 - (index / (history.length - 1)) * 40 // From purple (280) to pink (240)

        return (
          <div key={point.date} className="flex-1 flex flex-col items-center">
            <div
              className="w-full rounded-full transition-all duration-500 ease-out"
              style={{
                height: `${heightPercent}%`,
                minHeight: 4,
                background: isLatest
                  ? "linear-gradient(to top, oklch(0.65 0.2 320), oklch(0.6 0.22 350))"
                  : isPrevious
                    ? "linear-gradient(to top, oklch(0.55 0.18 285), oklch(0.6 0.2 300))"
                    : `linear-gradient(to top, oklch(0.45 0.15 ${hue}), oklch(0.55 0.18 ${hue + 20}))`,
                opacity: isLatest ? 1 : isPrevious ? 0.8 : 0.5 + (index / history.length) * 0.3,
              }}
            />
            {!compact && (
              <span
                className={cn("text-[8px] mt-1", isLatest ? "font-semibold text-primary" : "text-muted-foreground")}
              >
                {point.label.split(" ")[0]}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Objective Detail View
function ObjectiveDetail({
  objective,
  onBack,
  isPrimary,
  history,
}: {
  objective: Objective
  onBack: () => void
  isPrimary: boolean
  history: { date: string; value: number; label: string }[]
}) {
  const progress = (objective.progress / objective.target) * 100

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Back button */}
        <Button variant="ghost" onClick={onBack} className="rounded-xl -ml-2">
          <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
          Retour
        </Button>

        <div className="text-center space-y-3">
          <div
            className={cn(
              "w-14 h-14 mx-auto rounded-2xl flex items-center justify-center",
              isPrimary ? "bg-primary/15" : "bg-accent/15",
            )}
          >
            <Target className={cn("w-7 h-7", isPrimary ? "text-primary" : "text-accent")} />
          </div>
          <div>
            <span
              className={cn(
                "text-xs font-medium px-3 py-1 rounded-full",
                isPrimary ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent",
              )}
            >
              {isPrimary ? "Objectif Principal" : "Objectif Secondaire"}
            </span>
            <h1 className="text-xl font-bold mt-3">{objective.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{objective.description}</p>
          </div>
        </div>

        <div className="flex justify-center py-4">
          <ProgressRing
            progress={progress}
            size={130}
            strokeWidth={10}
            showPercentage={true}
            sublabel={`${objective.progress.toLocaleString()} / ${objective.target.toLocaleString()} ${objective.unit}`}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="pulse-card p-3 text-center">
            <p className="text-lg font-bold">{objective.reward}€</p>
            <p className="text-xs text-muted-foreground">Prime max</p>
          </div>
          <div className="pulse-card p-3 text-center">
            <p className="text-lg font-bold">{objective.paliers.length}</p>
            <p className="text-xs text-muted-foreground">Paliers</p>
          </div>
          <div className="pulse-card p-3 text-center">
            <p className="text-lg font-bold">{objective.paliers.filter((p) => p.unlocked).length}</p>
            <p className="text-xs text-muted-foreground">Debloques</p>
          </div>
        </div>

        {/* History Section */}
        <section className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent" />
            Historique de progression
          </h2>
          <div className="pulse-card p-4">
            <ProgressBarsHistory history={history} target={objective.target} />

            {/* Detailed history list */}
            <div className="mt-4 pt-4 border-t border-border space-y-2">
              {history
                .slice()
                .reverse()
                .map((point, index) => {
                  const prevValue = history[history.length - 2 - index]?.value ?? point.value
                  const diff = point.value - prevValue
                  const isToday = index === 0

                  return (
                    <div
                      key={point.date}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-lg",
                        isToday ? "bg-primary/10" : "bg-muted/30",
                      )}
                    >
                      <span className={cn("text-xs", isToday ? "font-semibold" : "text-muted-foreground")}>
                        {point.label}
                        {isToday && " (Aujourd'hui)"}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">
                          {typeof point.value === "number" && point.value % 1 !== 0
                            ? point.value.toFixed(1)
                            : point.value.toLocaleString()}
                          {objective.unit}
                        </span>
                        {diff > 0 && index < history.length - 1 && (
                          <span className="text-xs text-green-500">
                            +{typeof diff === "number" && diff % 1 !== 0 ? diff.toFixed(1) : diff.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </section>

        {/* Paliers section */}
        <section className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Paliers
          </h2>
          <PalierTimeline objective={objective} />
        </section>

        {/* Info */}
        <div className="pulse-card p-4 bg-muted/30">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Les paliers se debloquent automatiquement lorsque vous atteignez les objectifs. Les primes sont calculees
              a la fin du mois.
            </p>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}

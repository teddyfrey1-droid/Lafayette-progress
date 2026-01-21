"use client"

import { cn } from "@/lib/utils"
import { Lock, ChevronRight, Target, TrendingUp } from "lucide-react"
import { type Objective, getNextPalier } from "@/lib/demo-data"
import { Progress } from "@/components/ui/progress"

interface ObjectiveCardProps {
  objective: Objective
  isPrimary?: boolean
  onClick?: () => void
  className?: string
}

export function ObjectiveCard({ objective, isPrimary = false, onClick, className }: ObjectiveCardProps) {
  const progressPercent = (objective.progress / objective.target) * 100
  const nextPalier = getNextPalier(objective)
  const isLocked = !objective.unlocked && objective.type === "secondary"

  return (
    <div
      onClick={onClick}
      className={cn(
        "pulse-card p-4 relative overflow-hidden",
        onClick && "cursor-pointer",
        isPrimary && "border-primary/30",
        isLocked && "opacity-70",
        className,
      )}
    >
      {/* Lock overlay for secondary objectives */}
      {isLocked && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center z-10 p-4">
          <Lock className="w-6 h-6 text-muted-foreground mb-2" />
          <p className="text-xs text-center text-muted-foreground">Débloque l'objectif principal pour activer</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "p-2 rounded-xl",
              isPrimary ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {isPrimary ? <Target className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="font-semibold text-sm">{objective.title}</h3>
            {isPrimary && (
              <span className="text-[10px] font-medium text-primary uppercase tracking-wider">Objectif Principal</span>
            )}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold">
            {objective.progress.toLocaleString()}
            <span className="text-sm font-normal text-muted-foreground ml-1">
              / {objective.target.toLocaleString()} {objective.unit}
            </span>
          </span>
          <span className="text-sm font-semibold text-primary">{Math.round(progressPercent)}%</span>
        </div>

        <Progress
          value={progressPercent}
          className={cn("h-2", isPrimary && "[&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-accent")}
        />
      </div>

      {/* Next Palier */}
      {nextPalier && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Prochain: <span className="font-medium text-foreground">{nextPalier.name}</span>
            </span>
            <span className="text-xs font-semibold text-primary">+{nextPalier.reward}€</span>
          </div>
        </div>
      )}

      {/* Prime potential */}
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Prime potentielle</span>
        <span className="font-semibold">{objective.reward}€</span>
      </div>
    </div>
  )
}

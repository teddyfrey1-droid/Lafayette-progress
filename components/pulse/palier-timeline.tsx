"use client"

import { cn } from "@/lib/utils"
import { Check, Star, Crown, Gem, Trophy } from "lucide-react"
import type { Objective } from "@/lib/demo-data"

interface PalierTimelineProps {
  objective: Objective
  compact?: boolean
  className?: string
}

const palierIcons = [Star, Star, Crown, Gem, Trophy]
const palierColors = [
  { bg: "bg-amber-600/20", text: "text-amber-600", border: "border-amber-600/30" },
  { bg: "bg-slate-400/20", text: "text-slate-400", border: "border-slate-400/30" },
  { bg: "bg-yellow-400/20", text: "text-yellow-400", border: "border-yellow-400/30" },
  { bg: "bg-cyan-400/20", text: "text-cyan-400", border: "border-cyan-400/30" },
  { bg: "bg-purple-400/20", text: "text-purple-400", border: "border-purple-400/30" },
]

export function PalierTimeline({ objective, compact = false, className }: PalierTimelineProps) {
  const currentProgress = objective.progress

  return (
    <div className={cn("relative", className)}>
      {/* Timeline track */}
      <div className="absolute left-5 top-8 bottom-8 w-0.5 bg-border" />

      {/* Progress fill */}
      <div
        className="absolute left-5 top-8 w-0.5 bg-gradient-to-b from-primary to-accent transition-all duration-700"
        style={{
          height: `${Math.min(100, (objective.paliers.filter((p) => p.unlocked).length / objective.paliers.length) * 100)}%`,
        }}
      />

      <div className="space-y-4">
        {objective.paliers.map((palier, index) => {
          const Icon = palierIcons[Math.min(index, palierIcons.length - 1)]
          const colors = palierColors[Math.min(index, palierColors.length - 1)]
          const isNext = !palier.unlocked && (index === 0 || objective.paliers[index - 1].unlocked)
          const progressToThis = Math.min(100, (currentProgress / palier.target) * 100)

          return (
            <div
              key={palier.id}
              className={cn(
                "relative flex items-start gap-4 p-4 rounded-2xl transition-all",
                palier.unlocked
                  ? "bg-primary/5 border border-primary/20"
                  : isNext
                    ? "bg-card border border-border pulse-glow"
                    : "bg-muted/30 border border-transparent opacity-60",
              )}
            >
              {/* Icon */}
              <div
                className={cn(
                  "relative z-10 w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  palier.unlocked ? "bg-primary text-primary-foreground" : isNext ? colors.bg : "bg-muted",
                )}
              >
                {palier.unlocked ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Icon className={cn("w-5 h-5", isNext ? colors.text : "text-muted-foreground")} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm">{palier.name}</h4>
                    {palier.unlocked && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                        Debloque
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-sm font-bold",
                      palier.unlocked ? "text-primary" : isNext ? colors.text : "text-muted-foreground",
                    )}
                  >
                    +{palier.reward}€
                  </span>
                </div>

                {!compact && <p className="text-xs text-muted-foreground mb-2">{palier.description}</p>}

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Objectif: {palier.target.toLocaleString()} {objective.unit}
                  </span>
                  {isNext && (
                    <span className="font-medium text-foreground">
                      {Math.max(0, palier.target - currentProgress).toLocaleString()} restants
                    </span>
                  )}
                </div>

                {/* Progress bar for next palier */}
                {isNext && (
                  <div className="mt-2">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                        style={{ width: `${progressToThis}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

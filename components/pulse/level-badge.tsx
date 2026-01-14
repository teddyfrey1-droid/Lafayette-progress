"use client"

import { cn } from "@/lib/utils"
import { Zap, Star, Crown, Gem, Trophy } from "lucide-react"

interface LevelBadgeProps {
  level: number
  xp: number
  maxXp: number
  className?: string
}

const levelConfig = [
  { name: "Débutant", icon: Zap, color: "text-blue-400", bg: "bg-blue-500/20" },
  { name: "Bronze", icon: Star, color: "text-amber-600", bg: "bg-amber-500/20" },
  { name: "Argent", icon: Star, color: "text-slate-400", bg: "bg-slate-400/20" },
  { name: "Or", icon: Crown, color: "text-yellow-400", bg: "bg-yellow-500/20" },
  { name: "Platine", icon: Gem, color: "text-cyan-400", bg: "bg-cyan-500/20" },
  { name: "Diamant", icon: Trophy, color: "text-purple-400", bg: "bg-purple-500/20" },
]

export function LevelBadge({ level, xp, maxXp, className }: LevelBadgeProps) {
  const config = levelConfig[Math.min(level, levelConfig.length - 1)]
  const Icon = config.icon
  const progress = (xp / maxXp) * 100

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn("relative p-2 rounded-xl", config.bg)}>
        <Icon className={cn("w-5 h-5", config.color)} />
        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-background text-[10px] font-bold flex items-center justify-center border border-border">
          {level}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium">{config.name}</span>
          <span className="text-[10px] text-muted-foreground">
            {xp}/{maxXp} XP
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

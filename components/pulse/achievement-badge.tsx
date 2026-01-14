"use client"

import { cn } from "@/lib/utils"
import { Trophy, Target, Zap, Flame, Star, Award, Medal, Crown } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  unlocked: boolean
  unlockedAt?: Date
  rarity: "common" | "rare" | "epic" | "legendary"
}

interface AchievementBadgeProps {
  achievement: Achievement
  size?: "sm" | "md" | "lg"
  showTooltip?: boolean
  className?: string
}

const iconMap: Record<string, LucideIcon> = {
  trophy: Trophy,
  target: Target,
  zap: Zap,
  flame: Flame,
  star: Star,
  award: Award,
  medal: Medal,
  crown: Crown,
}

const rarityColors = {
  common: { bg: "bg-slate-500/20", border: "border-slate-500/30", text: "text-slate-400" },
  rare: { bg: "bg-blue-500/20", border: "border-blue-500/30", text: "text-blue-400" },
  epic: { bg: "bg-purple-500/20", border: "border-purple-500/30", text: "text-purple-400" },
  legendary: { bg: "bg-yellow-500/20", border: "border-yellow-500/30", text: "text-yellow-400" },
}

export function AchievementBadge({ achievement, size = "md", className }: AchievementBadgeProps) {
  const Icon = iconMap[achievement.icon] || Trophy
  const colors = rarityColors[achievement.rarity]

  const sizes = {
    sm: "w-10 h-10",
    md: "w-14 h-14",
    lg: "w-20 h-20",
  }

  const iconSizes = {
    sm: "w-5 h-5",
    md: "w-7 h-7",
    lg: "w-10 h-10",
  }

  return (
    <div
      className={cn(
        "relative rounded-2xl border-2 flex items-center justify-center transition-all",
        sizes[size],
        achievement.unlocked ? colors.bg : "bg-muted/50",
        achievement.unlocked ? colors.border : "border-muted",
        !achievement.unlocked && "grayscale opacity-40",
        className,
      )}
    >
      <Icon className={cn(iconSizes[size], achievement.unlocked ? colors.text : "text-muted-foreground")} />
      {achievement.unlocked && achievement.rarity === "legendary" && (
        <div className="absolute inset-0 rounded-2xl animate-pulse bg-yellow-500/10" />
      )}
    </div>
  )
}

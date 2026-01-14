"use client"

import { cn } from "@/lib/utils"
import { Flame } from "lucide-react"

interface StreakCounterProps {
  days: number
  className?: string
}

export function StreakCounter({ days, className }: StreakCounterProps) {
  const isHot = days >= 7
  const isOnFire = days >= 14
  const isLegendary = days >= 30

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl transition-all",
        isLegendary
          ? "bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30"
          : isOnFire
            ? "bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30"
            : isHot
              ? "bg-orange-500/15 border border-orange-500/20"
              : "bg-muted border border-border/50",
        className,
      )}
    >
      <div className="relative">
        <Flame
          className={cn(
            "w-5 h-5 transition-all",
            isLegendary
              ? "text-yellow-400 animate-pulse"
              : isOnFire
                ? "text-orange-400"
                : isHot
                  ? "text-orange-500"
                  : "text-muted-foreground",
          )}
        />
        {isOnFire && (
          <Flame
            className="absolute -top-1 -right-1 w-3 h-3 text-red-500 animate-bounce"
            style={{ animationDuration: "0.5s" }}
          />
        )}
      </div>
      <div className="flex flex-col">
        <span
          className={cn(
            "text-sm font-bold",
            isLegendary
              ? "text-yellow-400"
              : isOnFire
                ? "text-orange-400"
                : isHot
                  ? "text-orange-500"
                  : "text-foreground",
          )}
        >
          {days}
        </span>
        <span className="text-[10px] text-muted-foreground">jours</span>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface CountdownTimerProps {
  targetDate: Date
  className?: string
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

export function CountdownTimer({ targetDate, className }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = targetDate.getTime() - new Date().getTime()

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        })
      }
    }

    calculateTimeLeft()
    const timer = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(timer)
  }, [targetDate])

  const timeUnits = [
    { value: timeLeft.days, label: "Jours", shortLabel: "J" },
    { value: timeLeft.hours, label: "Heures", shortLabel: "H" },
    { value: timeLeft.minutes, label: "Minutes", shortLabel: "M" },
    { value: timeLeft.seconds, label: "Secondes", shortLabel: "S" },
  ]

  // Calculate progress percentage for the month (inverse of time remaining)
  const totalDaysInMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate()
  const daysElapsed = totalDaysInMonth - timeLeft.days
  const progressPercent = Math.min((daysElapsed / totalDaysInMonth) * 100, 100)

  return (
    <div className={cn("w-full", className)}>
      <div className="p-5 rounded-2xl bg-gradient-to-br from-card via-card to-primary/5 border border-border shadow-lg">
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Progression du mois</span>
            <span className="text-xs font-bold text-primary">{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary via-violet-500 to-accent rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Countdown Display */}
        <div className="flex items-stretch justify-center gap-2">
          {timeUnits.map((unit, index) => (
            <div key={unit.label} className="flex items-center">
              <div className="flex flex-col items-center">
                {/* Animated Bar */}
                <div className="relative w-16 h-24 rounded-2xl bg-gradient-to-b from-muted/50 to-muted overflow-hidden">
                  {/* Fill level based on value */}
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-b-2xl transition-all duration-500 ease-out"
                    style={{
                      height: `${Math.min((unit.value / (index === 0 ? 31 : index === 1 ? 24 : 60)) * 100, 100)}%`,
                      background: `linear-gradient(to top, 
                        hsl(var(--primary)) 0%, 
                        hsl(280, 80%, 60%) 50%, 
                        hsl(var(--accent)) 100%)`,
                    }}
                  />
                  {/* Value */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-foreground tabular-nums drop-shadow-sm">
                      {String(unit.value).padStart(2, "0")}
                    </span>
                  </div>
                </div>
                {/* Label */}
                <span className="text-[10px] font-semibold text-muted-foreground mt-2 uppercase tracking-wide">
                  {unit.label}
                </span>
              </div>
              {/* Separator dots */}
              {index < timeUnits.length - 1 && (
                <div className="flex flex-col gap-2 mx-1 mb-6">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" />
                  <div
                    className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse"
                    style={{ animationDelay: "0.5s" }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

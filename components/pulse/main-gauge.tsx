"use client"

import { useEffect, useState, useRef } from "react"
import { cn } from "@/lib/utils"

interface MainGaugeProps {
  progress: number
  unlockedAmount: number
  pendingAmount: number
  size?: number
  strokeWidth?: number
  className?: string
}

export function MainGauge({
  progress,
  unlockedAmount,
  pendingAmount,
  size = 180,
  strokeWidth = 12,
  className,
}: MainGaugeProps) {
  const [currentProgress, setCurrentProgress] = useState(0)
  const animationRef = useRef<number>()
  const startTimeRef = useRef<number>()

  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (currentProgress / 100) * circumference

  useEffect(() => {
    const targetProgress = Math.min(progress, 100)
    const duration = 1500

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp
      }

      const elapsed = timestamp - startTimeRef.current
      const progressRatio = Math.min(elapsed / duration, 1)

      const easeOutCubic = 1 - Math.pow(1 - progressRatio, 3)
      const newProgress = easeOutCubic * targetProgress

      setCurrentProgress(newProgress)

      if (progressRatio < 1) {
        animationRef.current = requestAnimationFrame(animate)
      }
    }

    const timer = setTimeout(() => {
      animationRef.current = requestAnimationFrame(animate)
    }, 100)

    return () => {
      clearTimeout(timer)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      startTimeRef.current = undefined
    }
  }, [progress])

  const gradientId = `main-gauge-gradient-${size}`

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <div
        className="absolute rounded-full opacity-20 blur-xl"
        style={{
          width: size + 10,
          height: size + 10,
          background: `linear-gradient(135deg, rgba(6, 182, 212, 0.3), rgba(139, 92, 246, 0.3))`,
        }}
      />

      <svg width={size} height={size} className="transform -rotate-90 relative z-10">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>

        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />

        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
        <span className="text-3xl font-black tracking-tight text-foreground">{Math.round(currentProgress)}%</span>
        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mt-1">
          Progression
        </span>

        {/* Amount display */}
        <div className="mt-2 text-center">
          <span className="text-lg font-bold text-foreground">{unlockedAmount.toFixed(2)}€</span>
          {pendingAmount > 0 && (
            <p className="text-sm font-semibold text-primary mt-1">+{pendingAmount.toFixed(2)}€ en attente</p>
          )}
        </div>
      </div>
    </div>
  )
}

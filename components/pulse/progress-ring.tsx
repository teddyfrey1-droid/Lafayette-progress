"use client"

import { useEffect, useState, useRef } from "react"
import { cn } from "@/lib/utils"

interface ProgressRingProps {
  progress: number
  size?: number
  strokeWidth?: number
  className?: string
  showPercentage?: boolean
  label?: string
  sublabel?: string
  animate?: boolean
}

export function ProgressRing({
  progress,
  size = 200,
  strokeWidth = 12,
  className,
  showPercentage = true,
  label,
  sublabel,
  animate = true,
}: ProgressRingProps) {
  const [currentProgress, setCurrentProgress] = useState(0)
  const animationRef = useRef<number>()
  const startTimeRef = useRef<number>()

  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (currentProgress / 100) * circumference

  useEffect(() => {
    if (!animate) {
      setCurrentProgress(progress)
      return
    }

    const targetProgress = Math.min(progress, 100)
    const duration = 1200

    const animateProgress = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp
      }

      const elapsed = timestamp - startTimeRef.current
      const progressRatio = Math.min(elapsed / duration, 1)

      const easeOutCubic = 1 - Math.pow(1 - progressRatio, 3)
      const newProgress = easeOutCubic * targetProgress

      setCurrentProgress(newProgress)

      if (progressRatio < 1) {
        animationRef.current = requestAnimationFrame(animateProgress)
      }
    }

    const timer = setTimeout(() => {
      animationRef.current = requestAnimationFrame(animateProgress)
    }, 100)

    return () => {
      clearTimeout(timer)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      startTimeRef.current = undefined
    }
  }, [progress, animate])

  const gradientId = `progress-gradient-${Math.random().toString(36).substr(2, 9)}`

  const percentageFontSize = size < 80 ? "text-lg" : size < 120 ? "text-xl" : size < 160 ? "text-2xl" : "text-3xl"

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="oklch(0.70 0.22 320)" />
            <stop offset="50%" stopColor="oklch(0.60 0.20 290)" />
            <stop offset="100%" stopColor="oklch(0.75 0.15 200)" />
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
          className="text-muted/30"
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
      <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
        {showPercentage && (
          <span className={cn(percentageFontSize, "font-bold tracking-tight")}>{Math.round(currentProgress)}%</span>
        )}
        {label && (
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">
            {label}
          </span>
        )}
        {sublabel && <span className="text-[9px] text-muted-foreground mt-0.5 text-center px-1">{sublabel}</span>}
      </div>
    </div>
  )
}

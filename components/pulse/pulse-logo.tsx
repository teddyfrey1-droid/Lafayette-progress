"use client"

import { cn } from "@/lib/utils"

interface PulseLogoProps {
  size?: "sm" | "md" | "lg"
  className?: string
  showText?: boolean
}

export function PulseLogo({ size = "md", className, showText = true }: PulseLogoProps) {
  const sizes = {
    sm: { width: 100, height: 24, textSize: 14 },
    md: { width: 140, height: 32, textSize: 18 },
    lg: { width: 180, height: 42, textSize: 24 },
  }

  const { width, height, textSize } = sizes[size]
  const pathScale = size === "sm" ? 0.7 : size === "lg" ? 1.2 : 1

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Pulse"
      className={cn("transition-all", className)}
    >
      <defs>
        <linearGradient id="pulseGrad" x1="0" y1="0" x2="34" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D10FA8" />
          <stop offset="1" stopColor="#7A2FF0" />
        </linearGradient>
        <filter id="pulseGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g transform={`scale(${pathScale})`}>
        <path
          d="M4 16H11.5L15.5 9.5L19.5 23L23.5 16H34"
          stroke="url(#pulseGrad)"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#pulseGlow)"
          className="animate-pulse"
          style={{ animationDuration: "3s" }}
        />
      </g>
      {showText && (
        <text
          x={size === "sm" ? 32 : size === "lg" ? 48 : 44}
          y={height * 0.68}
          fontFamily="Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
          fontSize={textSize}
          fontWeight="600"
          fill="currentColor"
        >
          Pulse
        </text>
      )}
    </svg>
  )
}

"use client"

import { cn } from "@/lib/utils"
import { Check, Lock } from "lucide-react"

interface Step {
  id: string
  title: string
  description: string
  completed: boolean
  active: boolean
}

interface UnlockFlowProps {
  steps: Step[]
  className?: string
}

export function UnlockFlow({ steps, className }: UnlockFlowProps) {
  return (
    <div className={cn("pulse-card p-4", className)}>
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <span className="pulse-gradient-text">Parcours de déblocage</span>
      </h3>

      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-start gap-3">
            {/* Step indicator */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
                  step.completed && "bg-primary text-primary-foreground",
                  step.active && !step.completed && "bg-primary/20 text-primary ring-2 ring-primary/50",
                  !step.active && !step.completed && "bg-muted text-muted-foreground",
                )}
              >
                {step.completed ? (
                  <Check className="w-4 h-4" />
                ) : step.active ? (
                  index + 1
                ) : (
                  <Lock className="w-3 h-3" />
                )}
              </div>
              {index < steps.length - 1 && (
                <div className={cn("w-0.5 h-8 mt-1", step.completed ? "bg-primary" : "bg-muted")} />
              )}
            </div>

            {/* Step content */}
            <div className="flex-1 pb-2">
              <h4
                className={cn(
                  "text-sm font-medium",
                  step.completed && "text-primary",
                  !step.active && !step.completed && "text-muted-foreground",
                )}
              >
                {step.title}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

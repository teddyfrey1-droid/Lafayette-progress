"use client"

import { useEffect, useState } from "react"
import { Trophy, Star, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CelebrationModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle: string
  reward?: number
  type?: "palier" | "achievement" | "level"
}

export function CelebrationModal({ open, onClose, title, subtitle, reward, type = "palier" }: CelebrationModalProps) {
  const [confetti, setConfetti] = useState<{ id: number; x: number; delay: number; color: string }[]>([])

  useEffect(() => {
    if (open) {
      const colors = ["#D10FA8", "#7A2FF0", "#FFD700", "#00D4FF", "#FF6B6B"]
      const particles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      }))
      setConfetti(particles)
    }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm z-50">
        {/* Confetti */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {confetti.map((particle) => (
            <div
              key={particle.id}
              className="absolute w-2 h-2 rounded-full animate-confetti"
              style={{
                left: `${particle.x}%`,
                top: "-10px",
                backgroundColor: particle.color,
                animationDelay: `${particle.delay}s`,
              }}
            />
          ))}
        </div>

        <div className="relative bg-card rounded-3xl p-6 border border-primary/20 overflow-hidden">
          {/* Glow background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />

          {/* Close button */}
          <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-3 right-3 rounded-xl z-10">
            <X className="w-4 h-4" />
          </Button>

          {/* Content */}
          <div className="relative text-center space-y-4">
            {/* Icon */}
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                {type === "palier" && <Star className="w-10 h-10 text-white" />}
                {type === "achievement" && <Trophy className="w-10 h-10 text-white" />}
                {type === "level" && <Sparkles className="w-10 h-10 text-white" />}
              </div>
            </div>

            {/* Text */}
            <div>
              <p className="text-sm text-primary font-medium uppercase tracking-wider mb-1">Felicitations!</p>
              <h2 className="text-2xl font-bold">{title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            </div>

            {/* Reward */}
            {reward && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/15 text-primary">
                <span className="text-lg font-bold">+{reward}€</span>
                <span className="text-sm">de prime</span>
              </div>
            )}

            {/* CTA */}
            <Button className="w-full rounded-xl mt-4" onClick={onClose}>
              Continuer
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { ProgressRing } from "@/components/pulse/progress-ring"
import { CelebrationModal } from "@/components/pulse/celebration-modal"
import { Target, ChevronRight, Sparkles, Info, TrendingUp, Loader2, Lock, EyeOff, ChevronLeft, CheckCircle2, Circle, Clock, Trash2, Award, ChevronDown, ChevronUp, Plus, Edit2, Save, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { useObjectives } from "@/hooks/use-objectives"
import { Badge } from "@/components/ui/badge"
import { usePermissions } from "@/hooks/use-permissions"
import { deleteDoc, doc, updateDoc, arrayUnion } from "firebase/firestore"
import { db } from "@/lib/firebase/client"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/components/auth/auth-provider"
import { demoDeleteObjective, demoUpdateObjective } from "@/lib/demo/local-demo-store"
import { computeObjectivePeriod, filterHistoryByPeriod, addMonthsSafe, parseToDate } from "@/lib/objective-period"

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

function computeProgressPct(current: number, target: number, direction?: string) {
  const c = Number.isFinite(current) ? current : 0
  const t = Number.isFinite(target) && target !== 0 ? target : 1
  if (direction === "descending") {
    if (c === 0) return 999
    return (t / c) * 100
  }
  return (c / t) * 100
}

function getObjectiveStatus(progressPct: number, direction?: string) {
  const pct = progressPct
  if (direction === "descending") {
    if (pct >= 120) return { label: "🏆 Excellent", tone: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50" }
    if (pct >= 100) return { label: "✅ Sous contrôle", tone: "text-green-600 dark:text-green-400", bg: "bg-green-50" }
    if (pct >= 85) return { label: "⚠️ À surveiller", tone: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50" }
    return { label: "🚨 À corriger", tone: "text-red-600 dark:text-red-400", bg: "bg-red-50" }
  }
  if (pct >= 120) return { label: "🔥 En avance", tone: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50" }
  if (pct >= 100) return { label: "✅ Objectif atteint", tone: "text-green-600 dark:text-green-400", bg: "bg-green-50" }
  if (pct >= 85) return { label: "🚀 Bien parti", tone: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50" }
  return { label: "💪 On continue", tone: "text-muted-foreground", bg: "bg-muted/50" }
}

function getProgressColor(progressPct: number) {
  if (progressPct >= 100) return "from-emerald-500 to-green-500"
  if (progressPct >= 85) return "from-blue-500 to-cyan-500"
  if (progressPct >= 50) return "from-amber-500 to-orange-500"
  return "from-red-500 to-rose-500"
}

function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0)
  
  useEffect(() => {
    const duration = 800
    const steps = 30
    const increment = value / steps
    let current = 0
    
    const timer = setInterval(() => {
      current += increment
      if (current >= value) {
        setDisplayValue(value)
        clearInterval(timer)
      } else {
        setDisplayValue(Math.floor(current))
      }
    }, duration / steps)
    
    return () => clearInterval(timer)
  }, [value])
  
  return <span>{displayValue.toLocaleString()}{suffix}</span>
}

// 📈 MINI COURBE AVEC TOOLTIP
function TrendMiniLine({
  history,
  current,
  target,
  direction,
  unit,
  periodStart,
  periodEnd,
}: {
  history?: any[]
  current: number
  target: number
  direction?: string
  unit?: string
  periodStart?: Date | null
  periodEnd?: Date | null
}) {
  const MAX_SCORE = 140
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const points = useMemo(() => {
    const hist = Array.isArray(history) ? [...history] : []
    const scoped = filterHistoryByPeriod(hist, periodStart ?? null, periodEnd ?? null)
    const safe = scoped
      .filter((h: any) => h && (h.timestamp || h.date))
      .sort((a: any, b: any) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime())
      .slice(-7)

    if (safe.length === 0) return []

    const cur = Number(current || 0)
    const lastVal = Number(safe[safe.length - 1]?.value ?? NaN)
    const isAbsolute = Number.isFinite(lastVal) && Number.isFinite(cur) && Math.abs(lastVal - cur) <= Math.max(1, Math.abs(cur)) * 0.02

    let totals: number[] = []
    if (isAbsolute) {
      totals = safe.map((h: any) => Number(h?.value ?? 0))
    } else {
      const changes = safe.map((h: any) => Number(h?.change ?? h?.value ?? 0)).map((n) => (Number.isFinite(n) ? n : 0))
      const sum = changes.reduce((a, b) => a + b, 0)
      let acc = (Number.isFinite(cur) ? cur : 0) - sum
      totals = changes.map((ch) => {
        acc += ch
        return acc
      })
    }

    return safe.map((h: any, i: number) => {
      const val = totals[i]
      const score = computeProgressPct(val, target, direction)
      return { date: String(h?.date || ""), value: val, score }
    })
  }, [history, current, target, direction, periodStart, periodEnd])

  if (points.length < 2) {
    return (
      <div className="mt-3 h-12 flex items-center justify-center">
        <p className="text-xs text-muted-foreground italic">Pas assez de données</p>
      </div>
    )
  }

  const trend = points.length > 1 ? ((points[points.length - 1].value - points[0].value) / points[0].value) * 100 : 0
  const safeTrend = Number.isFinite(trend) ? trend : 0

  const getClientX = (e: any): number | null => {
    // iOS can fire touch events where touches[] is empty; changedTouches is safer.
    if (e?.touches?.length) return e.touches[0].clientX
    if (e?.changedTouches?.length) return e.changedTouches[0].clientX
    if (typeof e?.clientX === "number") return e.clientX
    return null
  }

  const handleInteraction = (e: any) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const clientX = getClientX(e)
    if (clientX === null || !Number.isFinite(rect.width) || rect.width <= 0) return
    const x = clientX - rect.left
    const relativeX = x / rect.width
    const index = Math.round(relativeX * (points.length - 1))
    const clampedIndex = Math.max(0, Math.min(points.length - 1, index))
    setHoveredPoint(clampedIndex)
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Évolution</p>
        <span className={cn("text-xs font-bold", safeTrend >= 0 ? "text-green-600" : "text-red-600")}>
          {safeTrend >= 0 ? "+" : ""}{safeTrend.toFixed(1)}%
        </span>
      </div>
      
      <div 
        ref={containerRef}
        className="relative h-16 bg-muted/5 rounded-lg border border-border/30"
        onMouseMove={handleInteraction}
        onMouseLeave={() => setHoveredPoint(null)}
        onTouchStart={handleInteraction}
        onTouchMove={handleInteraction}
        onTouchEnd={() => setHoveredPoint(null)}
      >
        <div className="absolute left-0 right-0 border-t border-dashed border-primary/30" style={{ bottom: `${(100 / MAX_SCORE) * 100}%` }} />
        
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 200 64" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`miniGradient-${points[0]?.date}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
          
          <path 
            d={`M ${points.map((p, i) => `${(i * 200) / (points.length - 1)} ${64 - (p.score / MAX_SCORE) * 52}`).join(' L ')} L 200 64 L 0 64 Z`}
            fill={`url(#miniGradient-${points[0]?.date})`}
          />
          
          <path 
            d={`M ${points.map((p, i) => `${(i * 200) / (points.length - 1)} ${64 - (p.score / MAX_SCORE) * 52}`).join(' L ')}`}
            fill="none" 
            stroke="hsl(var(--primary))" 
            strokeWidth="2" 
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {points.map((p, i) => {
            const x = (i * 200) / (points.length - 1)
            const y = 64 - (p.score / MAX_SCORE) * 52
            const isActive = hoveredPoint === i
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={isActive ? "6" : "4"} fill="hsl(var(--primary))" />
                {isActive && <circle cx={x} cy={y} r="10" fill="hsl(var(--primary))" opacity="0.18" />}
              </g>
            )
          })}
        </svg>

        {hoveredPoint !== null && points[hoveredPoint] && (
          <div 
            className="absolute z-50 bg-foreground text-background text-xs font-semibold px-3 py-2 rounded-lg shadow-xl pointer-events-none whitespace-nowrap"
            style={{ 
              left: `${(hoveredPoint / (points.length - 1)) * 100}%`, 
              top: '0%',
              transform: 'translate(-50%, -110%)'
            }}
          >
            <div className="font-bold text-primary-foreground">{points[hoveredPoint].date}</div>
            <div className="text-accent-foreground">{points[hoveredPoint].value.toLocaleString()} {unit}</div>
          </div>
        )}
      </div>
    </div>
  )
}

// 📊 GRAPHIQUE PRO AVEC TOOLTIP
function LineChartPro({
  history,
  current,
  target,
  direction,
  unit,
  periodStart,
  periodEnd,
}: {
  history?: any[]
  current: number
  target: number
  direction?: string
  unit?: string
  periodStart?: Date | null
  periodEnd?: Date | null
}) {
  const MAX_SCORE = 140
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const points = useMemo(() => {
    const hist = Array.isArray(history) ? [...history] : []
    const scoped = filterHistoryByPeriod(hist, periodStart ?? null, periodEnd ?? null)
    const safe = scoped
      .filter((h: any) => h && (h.timestamp || h.date))
      .sort((a: any, b: any) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime())
      .slice(-10)

    if (safe.length === 0) return []

    const cur = Number(current || 0)
    const lastVal = Number(safe[safe.length - 1]?.value ?? NaN)
    const isAbsolute = Number.isFinite(lastVal) && Number.isFinite(cur) && Math.abs(lastVal - cur) <= Math.max(1, Math.abs(cur)) * 0.02

    let totals: number[] = []
    if (isAbsolute) {
      totals = safe.map((h: any) => Number(h?.value ?? 0))
    } else {
      const changes = safe.map((h: any) => Number(h?.change ?? h?.value ?? 0)).map((n) => (Number.isFinite(n) ? n : 0))
      const sum = changes.reduce((a, b) => a + b, 0)
      let acc = (Number.isFinite(cur) ? cur : 0) - sum
      totals = changes.map((ch) => {
        acc += ch
        return acc
      })
    }

    return safe.map((h: any, i: number) => {
      const val = totals[i]
      const score = computeProgressPct(val, target, direction)
      return { date: String(h?.date || ""), value: val, score }
    })
  }, [history, current, target, direction, periodStart, periodEnd])

  if (!points.length) {
    return (
      <div className="space-y-3">
        <div className="relative h-48 rounded-xl bg-muted/10 p-4 border border-border/50 flex items-center justify-center">
          <div className="text-center">
            <Info className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground italic">Ajoute une première valeur pour activer l'historique.</p>
          </div>
        </div>
      </div>
    )
  }

  const minValue = Math.min(...points.map(p => p.value))
  const maxValue = Math.max(...points.map(p => p.value))
  const avgValue = points.reduce((acc, p) => acc + p.value, 0) / points.length
  const trend = points.length > 1 ? ((points[points.length - 1].value - points[0].value) / points[0].value) * 100 : 0

  const safeTrend = Number.isFinite(trend) ? trend : 0

  const getClientX = (e: any): number | null => {
    // iOS can fire touch events where touches[] is empty; changedTouches is safer.
    if (e?.touches?.length) return e.touches[0].clientX
    if (e?.changedTouches?.length) return e.changedTouches[0].clientX
    if (typeof e?.clientX === "number") return e.clientX
    return null
  }

  const handleInteraction = (e: any) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const clientX = getClientX(e)
    if (clientX === null || !Number.isFinite(rect.width) || rect.width <= 0) return
    const x = clientX - rect.left
    // Keep padding similar to the SVG viewBox (40px left, 40px right).
    const leftPad = 40
    const usableWidth = Math.max(1, rect.width - leftPad * 2)
    const relativeX = (x - leftPad) / usableWidth
    const index = Math.round(relativeX * (points.length - 1))
    const clampedIndex = Math.max(0, Math.min(points.length - 1, index))
    setHoveredPoint(clampedIndex)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Historique & tendance
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Évolution sur {points.length} derniers points</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Tendance</div>
          <div className={cn("text-lg font-bold", safeTrend >= 0 ? "text-green-600" : "text-red-600")}>
            {safeTrend >= 0 ? "+" : ""}{safeTrend.toFixed(1)}%
          </div>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="relative h-48 bg-muted/5 rounded-xl p-4 border border-border/50"
        onMouseMove={handleInteraction}
        onMouseLeave={() => setHoveredPoint(null)}
        onTouchStart={handleInteraction}
        onTouchMove={handleInteraction}
        onTouchEnd={() => setHoveredPoint(null)}
      >
        <div className="absolute inset-0 flex flex-col justify-between px-4 py-4 pointer-events-none">
          <div className="border-t border-border/30 relative">
            <span className="absolute -left-2 -top-2.5 text-xs text-muted-foreground font-medium">140%</span>
          </div>
          <div className="border-t-2 border-primary/40 border-dashed relative">
            <span className="absolute -left-2 -top-2.5 text-xs text-foreground font-semibold">100%</span>
          </div>
          <div className="border-t border-border/30 relative">
            <span className="absolute -left-2 -top-2.5 text-xs text-muted-foreground font-medium">50%</span>
          </div>
          <div className="border-t border-border/30 relative">
            <span className="absolute -left-2 -top-2.5 text-xs text-muted-foreground font-medium">0%</span>
          </div>
        </div>

        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 192" preserveAspectRatio="none">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
          
          <path 
            d={`M ${points.map((p, i) => `${40 + (i * 320 / (points.length - 1))} ${192 - (p.score / MAX_SCORE) * 150}`).join(' L ')} L ${40 + 320} 192 L 40 192 Z`}
            fill="url(#lineGradient)" 
          />
          
          <path 
            d={`M ${points.map((p, i) => `${40 + (i * 320 / (points.length - 1))} ${192 - (p.score / MAX_SCORE) * 150}`).join(' L ')}`}
            fill="none" 
            stroke="hsl(var(--primary))" 
            strokeWidth="3" 
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {points.map((p, i) => {
            const x = 40 + (i * 320 / (points.length - 1))
            const y = 192 - (p.score / MAX_SCORE) * 150
            const isLast = i === points.length - 1
            const isActive = hoveredPoint === i
            return (
              <g key={i}>
                <circle 
                  cx={x} 
                  cy={y} 
                  r={isActive ? "8" : isLast ? "6" : "4"} 
                  fill={isLast || isActive ? "hsl(var(--primary))" : "hsl(var(--background))"} 
                  stroke="hsl(var(--primary))" 
                  strokeWidth="2"
                />
                {(isLast || isActive) && <circle cx={x} cy={y} r="12" fill="hsl(var(--primary))" opacity="0.18" />}
              </g>
            )
          })}
        </svg>

        {hoveredPoint !== null && points[hoveredPoint] && (
          <div 
            className="absolute z-50 bg-foreground text-background text-xs font-semibold px-3 py-2 rounded-lg shadow-xl pointer-events-none"
            style={{ 
              left: `${((hoveredPoint / (points.length - 1)) * 320 + 40) / 400 * 100}%`, 
              top: '10%',
              transform: 'translate(-50%, -100%)'
            }}
          >
            <div className="font-bold text-primary-foreground">{points[hoveredPoint].date}</div>
            <div className="text-accent-foreground">{points[hoveredPoint].value.toLocaleString()} {unit}</div>
            <div className="text-xs opacity-75">{Math.round(points[hoveredPoint].score)}%</div>
          </div>
        )}

        <div className="absolute bottom-1 left-0 right-0 flex justify-between px-4 text-[10px] text-muted-foreground font-medium pointer-events-none">
          {points.map((p, i) => (
            <span key={i} className={cn(i === points.length - 1 && "font-bold text-primary")}>
              {p.date.split(" ")[0]}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 rounded-lg bg-muted/30">
          <div className="text-xs text-muted-foreground mb-1">Minimum</div>
          <div className="text-sm font-bold">{minValue.toLocaleString()} {unit}</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/30">
          <div className="text-xs text-muted-foreground mb-1">Moyenne</div>
          <div className="text-sm font-bold">{avgValue.toFixed(0).toLocaleString()} {unit}</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-green-50">
          <div className="text-xs text-muted-foreground mb-1">Actuel</div>
          <div className="text-sm font-bold text-green-600">{current.toLocaleString()} {unit}</div>
        </div>
      </div>
    </div>
  )
}

export default function ObjectivesPage() {
  const { profile, isDemo } = useAuth()
  const { objectives, loading } = useObjectives()
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  
  // Store only the objective id so the detail view always stays in sync
  // with real-time updates coming from Firestore (e.g. updates done in Pilotage).
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null)
  const selectedObjective = useMemo(() => {
    if (!selectedObjectiveId) return null
    return objectives.find((o: any) => o?.id === selectedObjectiveId) ?? null
  }, [objectives, selectedObjectiveId])
  const [showCelebration, setShowCelebration] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  const principalObjective = objectives.find((o: any) => o.type === "principal" && o.isActive)
  const secondaryObjectives = objectives.filter((o: any) => (o.type === "secondaire" || !o.type) && o.isActive)

  const pCurrent = Number(principalObjective?.current || 0)
  const pTarget = Number(principalObjective?.target || 1)
  const principalPeriod = principalObjective ? computeObjectivePeriod(principalObjective) : null
  
  const isPrincipalMet = !principalObjective || (
    principalObjective.direction === 'descending' 
      ? pCurrent <= pTarget 
      : pCurrent >= pTarget
  )

  // 🎯 DÉTECTION DU SCROLL AVEC CALCUL CORRECT (gap de 16px = 1rem)
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollRef.current) return
      const scrollLeft = scrollRef.current.scrollLeft
      const containerWidth = scrollRef.current.offsetWidth
      const cardWidth = containerWidth - 80 // largeur carte
      const gap = 16 // gap-4 = 16px
      const totalItemWidth = cardWidth + gap
      const index = Math.round(scrollLeft / totalItemWidth)
      setCurrentIndex(Math.max(0, Math.min(secondaryObjectives.length - 1, index)))
    }

    const scrollElement = scrollRef.current
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll)
      return () => scrollElement.removeEventListener('scroll', handleScroll)
    }
  }, [secondaryObjectives.length])

  // 🎯 FONCTION POUR NAVIGUER VERS UN INDEX SPÉCIFIQUE
  const scrollToIndex = (index: number) => {
    if (!scrollRef.current) return
    const containerWidth = scrollRef.current.offsetWidth
    const cardWidth = containerWidth - 80
    const gap = 16
    const totalItemWidth = cardWidth + gap
    scrollRef.current.scrollTo({
      left: index * totalItemWidth,
      behavior: 'smooth'
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cet objectif ?")) return
    try {
      if (isDemo && profile?.companyId) {
        demoDeleteObjective(profile.companyId, id)
      } else {
        await deleteDoc(doc(db, "objectives", id))
      }
      toast({ title: "Objectif supprimé" })
      setSelectedObjectiveId(null)
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (selectedObjective) {
    return (
      <ObjectiveDetailView
        objective={selectedObjective}
        onBack={() => setSelectedObjectiveId(null)}
        onDelete={() => handleDelete(selectedObjective.id)}
        canEdit={canEdit("objectifs")}
      />
    )
  }

  const principalProgressRaw = principalObjective ? computeProgressPct(pCurrent, pTarget, principalObjective.direction) : 0
  const principalProgressBar = clamp(principalProgressRaw, 0, 100)

  const nextPalier = principalObjective?.paliers
    ? [...principalObjective.paliers]
        .map((p: any) => ({ ...p, threshold: Number(p.threshold || 0) }))
        .sort((a: any, b: any) => principalObjective.direction === "descending" ? b.threshold - a.threshold : a.threshold - b.threshold)
        .find((p: any) => principalObjective.direction === "descending" ? pCurrent > Number(p.threshold) : pCurrent < Number(p.threshold))
    : undefined

  const principalStatus = principalObjective ? getObjectiveStatus(principalProgressRaw, principalObjective.direction) : null

  return (
    <PermissionGate moduleId="objectifs" redirect>
      <div className="min-h-screen bg-background pb-32">
        <Header />

        <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-purple-600 to-accent bg-clip-text text-transparent">
              Objectifs
            </h1>
            <p className="text-sm text-muted-foreground">Suivez votre progression et débloquez vos primes</p>
          </div>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-lg">Objectif Principal</h2>
            </div>

            {principalObjective ? (
              <div
                className={cn(
                  "relative p-6 rounded-3xl cursor-pointer transition-all duration-300",
                  "bg-gradient-to-br from-primary/10 via-purple-500/10 to-accent/10",
                  "border-2 border-primary/20",
                  "hover:shadow-2xl hover:shadow-primary/20 hover:scale-[1.02]"
                )}
                onClick={() => principalObjective?.id && setSelectedObjectiveId(principalObjective.id)}
              >
                {principalStatus && !principalObjective.isConfidential && (
                  <div className={cn("absolute top-4 right-4 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg", principalStatus.bg, principalStatus.tone)}>
                    {principalStatus.label}
                  </div>
                )}

                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="relative">
                    <ProgressRing 
                      progress={principalProgressRaw} 
                      size={120} 
                      strokeWidth={10} 
                      showPercentage={false}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-3xl font-black bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent">
                        {!principalObjective.isConfidential && <AnimatedCounter value={Math.round(clamp(principalProgressRaw, 0, 999))} suffix="%" />}
                        {principalObjective.isConfidential && <EyeOff className="w-8 h-8 text-muted-foreground/50" />}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-xl mb-1">{principalObjective.title}</h3>
                    <p className="text-sm text-muted-foreground">{principalObjective.description}</p>
                  </div>
                  
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-xs font-semibold px-3 py-1">Principal</Badge>
                    {principalPeriod && (
                      <Badge variant="outline" className="text-xs font-medium">
                        {principalPeriod.isIndefinite ? "∞ Illimité" : `⏳ ${principalPeriod.label}`}
                      </Badge>
                    )}
                    {!principalObjective.isConfidential && principalObjective.paliers && (
                      <Badge variant="secondary" className="text-xs font-semibold flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        {(principalObjective.paliers.reduce((acc:number, p:any) => acc + Number(p.reward || 0), 0)).toLocaleString()}€ max
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-muted-foreground">Progression</span>
                    <span className="font-bold">
                      {principalObjective.isConfidential 
                        ? <span className="flex items-center gap-1.5 italic opacity-70"><EyeOff className="w-3.5 h-3.5"/> Masqué</span> 
                        : <><AnimatedCounter value={pCurrent} /> / {pTarget.toLocaleString()} {principalObjective.unit}</>}
                    </span>
                  </div>
                  <Progress value={principalProgressBar} className={cn("h-3", `[&>div]:bg-gradient-to-r [&>div]:${getProgressColor(principalProgressRaw)}`)} />
                </div>

                <div className="mt-6 pt-5 border-t border-border/50">
                  <TrendMiniLine 
                    history={principalObjective?.history} 
                    current={pCurrent} 
                    target={pTarget} 
                    direction={principalObjective?.direction} 
                    unit={principalObjective?.unit} 
                    periodStart={principalPeriod?.isIndefinite ? null : (principalPeriod?.start ?? null)} 
                    periodEnd={principalPeriod?.end ?? null} 
                  />
                </div>

                {nextPalier && (
                  <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/20 flex items-center justify-between group hover:shadow-lg transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                        <Target className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Prochain palier</p>
                        <p className="font-bold text-sm">{nextPalier.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Cible</p>
                      <p className="font-black text-lg bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                        {Number(nextPalier.threshold || 0).toLocaleString()}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </div>
                )}
              </div>
            ) : (
              <div className="pulse-card p-10 text-center text-muted-foreground border-dashed border-2">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-30"/>
                <p className="font-medium">Aucun objectif principal configuré</p>
              </div>
            )}
          </section>

          {/* 🎯 OBJECTIFS SECONDAIRES */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-accent" />
                <h2 className="font-semibold text-lg">Objectifs secondaires</h2>
              </div>

              {secondaryObjectives.length > 0 && (
                <Badge variant="secondary" className="text-xs font-semibold">
                  {secondaryObjectives.length} actif(s)
                </Badge>
              )}
            </div>

            {secondaryObjectives.length > 0 ? (
              <>
                {/* Mobile: swipe horizontal (plus lisible et évite une page trop longue) */}
                <div className="md:hidden -mx-4 px-4">
                  <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory">
                    {secondaryObjectives.map((obj: any, index: number) => {
                  const current = Number(obj.current || 0)
                  const target = Number(obj.target || 1)
                  const isConfidential = obj.isConfidential || obj.hideRevenue

                  const progressRaw = computeProgressPct(current, target, obj.direction)
                  const progressBar = clamp(progressRaw, 0, 100)
                  const status = getObjectiveStatus(progressRaw, obj.direction)

                  const nextPalierS = obj.paliers
                    ? [...obj.paliers]
                        .map((p: any) => ({ ...p, threshold: Number(p.threshold || 0) }))
                        .sort((a: any, b: any) =>
                          obj.direction === "descending" ? b.threshold - a.threshold : a.threshold - b.threshold,
                        )
                        .find((p: any) =>
                          obj.direction === "descending" ? current > Number(p.threshold) : current < Number(p.threshold),
                        )
                    : undefined

                  const isLocked = !isPrincipalMet

                      return (
                        <div
                          key={obj.id}
                          className={cn(
                            "pulse-card p-6 transition-all duration-300 relative overflow-hidden border-2 snap-start min-w-[320px] w-[320px]",
                            isLocked && "opacity-60 grayscale cursor-not-allowed border-border/50",
                            !isLocked && "hover:shadow-xl hover:scale-[1.01] cursor-pointer border-accent/30",
                          )}
                          onClick={() => !isLocked && obj?.id && setSelectedObjectiveId(obj.id)}
                        >
                      {/* Overlay lock */}
                      {isLocked && (
                        <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                              <Lock className="w-6 h-6 text-amber-600" />
                            </div>
                            <p className="text-xs font-bold text-amber-600">En attente du principal</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black px-2 py-1 rounded-full bg-accent/15 text-accent">
                              #{index + 1}
                            </span>

                            {(obj.category || "").toString().trim() && (
                              <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-muted/40 text-muted-foreground">
                                {String(obj.category)}
                              </span>
                            )}

                            {!isConfidential && (
                              <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full", status.bg, status.tone)}>
                                {status.label}
                              </span>
                            )}

                            {isConfidential && (
                              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-muted/40 text-muted-foreground">
                                {Math.round(clamp(progressRaw, 0, 999))}%
                              </span>
                            )}
                          </div>

                          <h3 className="text-lg font-black leading-tight break-words">{obj.title}</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{obj.description}</p>
                        </div>

                        {/* Progress ring */}
                        <div className="shrink-0">
                          <ProgressRing
                            progress={clamp(progressRaw, 0, 999)}
                            size={76}
                            strokeWidth={10}
                            showPercentage
                            label="Avancement"
                            animate={!isLocked}
                          />
                        </div>
                      </div>

                      {/* Values + progress */}
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-medium">Actuel</span>
                          <span className="font-semibold text-foreground tabular-nums">
                            {isConfidential ? "—" : `${current.toLocaleString()} ${obj.unit || ""}`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-medium">Objectif</span>
                          <span className="font-semibold text-foreground tabular-nums">
                            {isConfidential ? "—" : `${target.toLocaleString()} ${obj.unit || ""}`}
                          </span>
                        </div>
                        <Progress
                          value={progressBar}
                          className={cn("h-3", `[&>div]:bg-gradient-to-r [&>div]:${getProgressColor(progressRaw)}`)}
                        />
                      </div>

                      {/* Next milestone */}
                      {nextPalierS && !isLocked && (
                        <div className="mt-4 p-3 rounded-2xl bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/20 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-accent" />
                            <div className="min-w-0">
                              <p className="text-[10px] text-muted-foreground font-medium">Prochain palier</p>
                              <p className="text-xs font-bold truncate">{nextPalierS.name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                              +{nextPalierS.reward}€
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Mini graph */}
                      <div className="mt-4 pt-4 border-t border-border/30">
                        <TrendMiniLine
                          history={obj.history}
                          current={current}
                          target={target}
                          direction={obj.direction}
                          unit={obj.unit}
                          periodStart={principalPeriod?.isIndefinite ? null : (principalPeriod?.start ?? null)}
                          periodEnd={principalPeriod?.end ?? null}
                        />
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                          Clique pour ouvrir le détail
                        </div>
                        <div className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                          Voir
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">Glisse vers la droite pour voir les autres objectifs.</p>
                </div>

                {/* Desktop: grille */}
                <div className="hidden md:grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {secondaryObjectives.map((obj: any, index: number) => {
                    const current = Number(obj.current || 0)
                    const target = Number(obj.target || 1)
                    const isConfidential = obj.isConfidential || obj.hideRevenue

                    const progressRaw = computeProgressPct(current, target, obj.direction)
                    const progressBar = clamp(progressRaw, 0, 100)
                    const status = getObjectiveStatus(progressRaw, obj.direction)

                    const nextPalierS = obj.paliers
                      ? [...obj.paliers]
                          .map((p: any) => ({ ...p, threshold: Number(p.threshold || 0) }))
                          .sort((a: any, b: any) =>
                            obj.direction === "descending" ? b.threshold - a.threshold : a.threshold - b.threshold,
                          )
                          .find((p: any) =>
                            obj.direction === "descending" ? current > Number(p.threshold) : current < Number(p.threshold),
                          )
                      : undefined

                    const isLocked = !isPrincipalMet

                    return (
                      <div
                        key={obj.id}
                        className={cn(
                          "pulse-card p-6 transition-all duration-300 relative overflow-hidden border-2",
                          isLocked && "opacity-60 grayscale cursor-not-allowed border-border/50",
                          !isLocked && "hover:shadow-xl hover:scale-[1.01] cursor-pointer border-accent/30",
                        )}
                        onClick={() => !isLocked && obj?.id && setSelectedObjectiveId(obj.id)}
                      >
                        {/* Overlay lock */}
                        {isLocked && (
                          <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                                <Lock className="w-6 h-6 text-amber-600" />
                              </div>
                              <p className="text-xs font-bold text-amber-600">En attente du principal</p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black px-2 py-1 rounded-full bg-accent/15 text-accent">
                                #{index + 1}
                              </span>

                              {(obj.category || "").toString().trim() && (
                                <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-muted/40 text-muted-foreground">
                                  {String(obj.category)}
                                </span>
                              )}

                              {!isConfidential && (
                                <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full", status.bg, status.tone)}>
                                  {status.label}
                                </span>
                              )}
                            </div>
                            <h3 className="text-xl font-bold leading-tight">{obj.title}</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">{obj.description}</p>
                          </div>

                          <div className="shrink-0">
                            <div className="relative">
                              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center">
                                <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center">
                                  <span className="font-black text-lg">{Math.round(progressBar)}%</span>
                                </div>
                              </div>
                              <div
                                className="absolute inset-0 rounded-full"
                                style={{
                                  background: `conic-gradient(var(--accent) ${Math.round(progressBar) * 3.6}deg, transparent 0deg)`,
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Actuel</p>
                              <p className="font-bold">
                                {isConfidential ? "•••" : current.toLocaleString()} {obj.unit}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">Objectif</p>
                              <p className="font-bold">
                                {isConfidential ? "•••" : target.toLocaleString()} {obj.unit}
                              </p>
                            </div>
                          </div>

                          <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-accent to-primary rounded-full transition-all duration-700"
                              style={{ width: `${progressBar}%` }}
                            />
                          </div>

                          {nextPalierS && (
                            <div className="mt-3 p-3 rounded-xl bg-muted/30 border border-border flex items-center justify-between">
                              <div>
                                <p className="text-[11px] text-muted-foreground font-semibold">Prochain palier</p>
                                <p className="text-sm font-bold">{nextPalierS.name}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[11px] text-muted-foreground">+{Number(nextPalierS.reward || 0)}€</p>
                                <p className="text-sm font-bold">{Number(nextPalierS.threshold || 0).toLocaleString()} {obj.unit}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="pulse-card p-10 text-center text-muted-foreground border-dashed border-2">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Aucun objectif secondaire pour le moment</p>
              </div>
            )}
          </section>


          <div className="pulse-card p-4 bg-blue-500/5 border border-blue-500/20">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Les paliers se débloquent automatiquement. Les primes secondaires ne sont validées que si l'objectif principal est atteint.
              </p>
            </div>
          </div>
        </main>
        
        <BottomNav />
        <CelebrationModal open={showCelebration} onClose={() => setShowCelebration(false)} title="Succès !" subtitle="Palier débloqué" type="achievement" />
      </div>
    </PermissionGate>
  )
}

// 🎯 VUE DÉTAIL COMPLÈTE
function ObjectiveDetailView({ objective, onBack, onDelete, canEdit }: { objective: any, onBack: () => void, onDelete: () => void, canEdit: boolean }) {
  const [localObjective, setLocalObjective] = useState<any>(objective)

  // Keep the detail view in sync when the objective is updated elsewhere
  // (e.g. from Pilotage). This prevents stale data without requiring a page reload.
  useEffect(() => {
    setLocalObjective(objective)
  }, [
    objective?.id,
    objective?.current,
    objective?.target,
    Array.isArray(objective?.history) ? objective.history.length : 0,
    Array.isArray(objective?.paliers) ? objective.paliers.length : 0,
    objective?.periodStart,
    objective?.periodEnd,
    objective?.periodMonths,
  ])
  const safeObj = {
    ...localObjective,
    current: Number(localObjective.current || 0),
    target: Number(localObjective.target || 1),
    unit: localObjective.unit || "",
    paliers: (localObjective.paliers || []).map((p:any) => ({ ...p, threshold: Number(p.threshold || 0), reward: Number(p.reward || 0), name: p.name || "Palier" }))
  }

  const period = computeObjectivePeriod(safeObj)
  const isPrimary = safeObj.type === "principal"
  const isConfidential = safeObj.isConfidential || safeObj.hideRevenue
  
  const progress = computeProgressPct(safeObj.current, safeObj.target, safeObj.direction)
  const status = getObjectiveStatus(progress, safeObj.direction)

  const maxReward = safeObj.paliers.reduce((acc:number, p:any) => acc + p.reward, 0)
  const unlockedPaliers = safeObj.paliers.filter((p: any) => safeObj.direction === 'descending' ? safeObj.current <= p.threshold : safeObj.current >= p.threshold).length

  const { profile, isDemo } = useAuth()
  const { toast } = useToast()
  
  const [showQuickUpdate, setShowQuickUpdate] = useState(canEdit)
  const [showTargetEdit, setShowTargetEdit] = useState(false)
  const [showPaliersEdit, setShowPaliersEdit] = useState(false)
  const [showDurationEdit, setShowDurationEdit] = useState(false)
  
  const [quickVal, setQuickVal] = useState("")
  const [editingTarget, setEditingTarget] = useState(false)
  const [newTarget, setNewTarget] = useState(safeObj.target.toString())
  const [editingPaliers, setEditingPaliers] = useState<any[]>(safeObj.paliers)
  const [savingDuration, setSavingDuration] = useState(false)

  const handleQuickUpdate = async () => {
    const newTotal = Number(quickVal)
    if (!Number.isFinite(newTotal)) {
      toast({ title: "Valeur invalide", variant: "destructive" })
      return
    }

    const targetDate = new Date()
    const dateStr = format(targetDate, "d MMM", { locale: fr })

    try {
      if (isDemo) {
        if (!profile?.companyId) return
        const prev = Number(safeObj.current || 0)
        const change = newTotal - prev
        const nextHistory = [...(safeObj.history || [])]
        nextHistory.push({ date: dateStr, value: newTotal, change, timestamp: targetDate.toISOString() })
        demoUpdateObjective(profile.companyId, safeObj.id, { current: newTotal, history: nextHistory } as any)
        setLocalObjective((prev: any) => ({ ...prev, current: newTotal, history: nextHistory }))
        toast({ title: "✅ Mise à jour réussie" })
        setQuickVal("")
      } else {
        const ref = doc(db, "objectives", safeObj.id)
        const prev = Number(safeObj.current || 0)
        const prevHistory = Array.isArray(safeObj.history) ? [...safeObj.history] : []
        const change = newTotal - prev
        const entry = { date: dateStr, value: newTotal, change, timestamp: targetDate.toISOString() }

        setLocalObjective((p: any) => ({ ...p, current: newTotal, history: [...(p?.history || []), entry] }))
        setQuickVal("")
        toast({ title: "✅ Mise à jour enregistrée" })

        try {
          await updateDoc(ref, { current: newTotal, history: arrayUnion(entry) })
        } catch (err) {
          setLocalObjective((p: any) => ({ ...p, current: prev, history: prevHistory }))
          throw err
        }
      }
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleTargetSave = async () => {
    const newTargetNum = Number(newTarget)
    if (!Number.isFinite(newTargetNum) || newTargetNum <= 0) {
      toast({ title: "Cible invalide", variant: "destructive" })
      return
    }

    try {
      const payload = { target: newTargetNum }
      if (isDemo && profile?.companyId) {
        demoUpdateObjective(profile.companyId, safeObj.id, payload)
        setLocalObjective((prev: any) => ({ ...prev, target: newTargetNum }))
        toast({ title: "✅ Cible mise à jour" })
      } else {
        await updateDoc(doc(db, "objectives", safeObj.id), payload)
        setLocalObjective((prev: any) => ({ ...prev, target: newTargetNum }))
        toast({ title: "✅ Cible mise à jour" })
      }
      setEditingTarget(false)
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handlePaliersSave = async () => {
    try {
      const payload = { paliers: editingPaliers }
      if (isDemo && profile?.companyId) {
        demoUpdateObjective(profile.companyId, safeObj.id, payload)
        setLocalObjective((prev: any) => ({ ...prev, paliers: editingPaliers }))
        toast({ title: "✅ Paliers mis à jour" })
      } else {
        await updateDoc(doc(db, "objectives", safeObj.id), payload)
        setLocalObjective((prev: any) => ({ ...prev, paliers: editingPaliers }))
        toast({ title: "✅ Paliers mis à jour" })
      }
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const addPalier = () => {
    setEditingPaliers([...editingPaliers, { name: "Nouveau palier", threshold: 0, reward: 0 }])
  }

  const removePalier = (index: number) => {
    setEditingPaliers(editingPaliers.filter((_, i) => i !== index))
  }

  const updatePalier = (index: number, field: string, value: any) => {
    const updated = [...editingPaliers]
    updated[index] = { ...updated[index], [field]: value }
    setEditingPaliers(updated)
  }

  const handleDurationUpdate = async (months: number | null) => {
    if (!canEdit) return
    if (isDemo && !profile?.companyId) {
      toast({ title: "Entreprise démo introuvable", variant: "destructive" })
      return
    }
    setSavingDuration(true)
    try {
      const existingStart = parseToDate(safeObj?.periodStart) || parseToDate(safeObj?.startDate) || null
      const companyId = (profile as any)?.companyId

      if (months == null) {
        const payload: any = { periodEnd: null, periodMonths: null, deadline: null }
        if (isDemo && companyId) {
          demoUpdateObjective(companyId, safeObj.id, payload)
          setLocalObjective((prev: any) => ({ ...prev, ...payload }))
          toast({ title: "✅ Durée mise à jour" })
        } else {
          await updateDoc(doc(db, "objectives", safeObj.id), payload)
          setLocalObjective((prev: any) => ({ ...prev, ...payload }))
          toast({ title: "✅ Durée mise à jour" })
        }
        return
      }

      const start = existingStart || new Date()
      const end = addMonthsSafe(start, months)
      const payload: any = { periodStart: start.toISOString(), periodEnd: end ? end.toISOString() : null, periodMonths: months, deadline: end ? end.toISOString() : null }

      if (isDemo && companyId) {
        demoUpdateObjective(companyId, safeObj.id, payload)
        setLocalObjective((prev: any) => ({ ...prev, ...payload }))
        toast({ title: "✅ Durée mise à jour" })
      } else {
        await updateDoc(doc(db, "objectives", safeObj.id), payload)
        setLocalObjective((prev: any) => ({ ...prev, ...payload }))
        toast({ title: "✅ Durée mise à jour" })
      }
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" })
    } finally {
      setSavingDuration(false)
    }
  }

  const handleStartDateUpdate = async (dateStr: string) => {
    if (!canEdit || !dateStr) return
    if (isDemo && !profile?.companyId) {
      toast({ title: "Entreprise démo introuvable", variant: "destructive" })
      return
    }

    setSavingDuration(true)
    try {
      const start = new Date(dateStr)
      if (!Number.isFinite(start.getTime())) return

      const months = typeof safeObj?.periodMonths === "number" ? safeObj.periodMonths : null
      const isIndef = months == null && !safeObj?.periodEnd && !safeObj?.deadline
      const end = isIndef || months == null ? null : addMonthsSafe(start, months)
      const payload: any = { periodStart: start.toISOString(), periodEnd: end ? end.toISOString() : null, deadline: end ? end.toISOString() : null }
      const companyId = (profile as any)?.companyId

      if (isDemo && companyId) {
        demoUpdateObjective(companyId, safeObj.id, payload)
        setLocalObjective((prev: any) => ({ ...prev, ...payload }))
        toast({ title: "✅ Début mis à jour" })
      } else {
        await updateDoc(doc(db, "objectives", safeObj.id), payload)
        setLocalObjective((prev: any) => ({ ...prev, ...payload }))
        toast({ title: "✅ Début mis à jour" })
      }
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" })
    } finally {
      setSavingDuration(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-32 animate-in slide-in-from-right duration-300">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <Header />
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <Button variant="ghost" onClick={onBack} className="rounded-xl -ml-2">
            <ChevronLeft className="w-4 h-4 mr-1" /> Retour
          </Button>
          {canEdit && (
            <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl" onClick={onDelete}>
              <Trash2 className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-4">
          <div className={cn("w-20 h-20 mx-auto rounded-3xl flex items-center justify-center shadow-lg", isPrimary ? "bg-gradient-to-br from-primary to-purple-600" : "bg-gradient-to-br from-accent to-cyan-600")}>
            <Target className="w-10 h-10 text-white" />
          </div>
          
          <div>
            <Badge className={cn("text-xs font-bold px-4 py-1.5 rounded-full shadow-lg", isPrimary ? "bg-primary/20 text-primary border-primary/30" : "bg-accent/20 text-accent border-accent/30")}>
              {isPrimary ? "🎯 Objectif Principal" : "📌 Objectif Secondaire"}
            </Badge>
            
            <h1 className="text-2xl font-black mt-4">{safeObj.title}</h1>
            <p className="text-sm text-muted-foreground mt-2">{safeObj.description}</p>
            
            {!isConfidential && (
              <div className={cn("inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-full shadow-md", status.bg)}>
                <span className={cn("text-xs font-bold", status.tone)}>{status.label}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center py-6">
          <div className="relative">
            <ProgressRing progress={progress} size={150} strokeWidth={12} showPercentage={false} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-4xl font-black bg-gradient-to-br from-primary via-purple-600 to-accent bg-clip-text text-transparent">
                {!isConfidential && <AnimatedCounter value={Math.round(clamp(progress, 0, 999))} suffix="%" />}
                {isConfidential && <EyeOff className="w-10 h-10 text-muted-foreground/30" />}
              </div>
              {!isConfidential && (
                <p className="text-xs text-muted-foreground mt-2 font-medium">
                  {safeObj.current.toLocaleString()} / {safeObj.target.toLocaleString()} {safeObj.unit}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="pulse-card p-4 text-center bg-gradient-to-br from-primary/5 to-purple-500/5 border border-primary/20">
            <div className="text-2xl font-black bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              {isConfidential ? "?" : maxReward}€
            </div>
            <p className="text-[10px] text-muted-foreground font-medium mt-1">Prime max</p>
          </div>
          <div className="pulse-card p-4 text-center bg-gradient-to-br from-accent/5 to-cyan-500/5 border border-accent/20">
            <div className="text-2xl font-black bg-gradient-to-r from-accent to-cyan-600 bg-clip-text text-transparent">
              {safeObj.paliers.length}
            </div>
            <p className="text-[10px] text-muted-foreground font-medium mt-1">Paliers</p>
          </div>
          <div className="pulse-card p-4 text-center bg-gradient-to-br from-emerald-500/5 to-green-500/5 border border-emerald-500/20">
            <div className="text-2xl font-black bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
              {unlockedPaliers}
            </div>
            <p className="text-[10px] text-muted-foreground font-medium mt-1">Débloqués</p>
          </div>
        </div>

        {canEdit && (
          <div className="pulse-card overflow-hidden border-2 border-primary/20">
            <button 
              className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
              onClick={() => setShowQuickUpdate(!showQuickUpdate)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-sm">Mise à jour rapide</h3>
                  <p className="text-xs text-muted-foreground">Modifier la valeur actuelle</p>
                </div>
              </div>
              {showQuickUpdate ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
            </button>
            
            {showQuickUpdate && (
              <div className="p-4 pt-0 space-y-3 border-t border-border/30">
                <p className="text-xs text-muted-foreground">
                  Saisis la nouvelle valeur <span className="font-bold text-foreground">totale</span> (ex : 48 500€ aujourd'hui)
                </p>
                <div className="flex gap-2">
                  <Input 
                    type="number" 
                    value={quickVal} 
                    onChange={(e) => setQuickVal(e.target.value)} 
                    placeholder={`Nouvelle valeur (${safeObj.unit})`}
                    className="flex-1 h-12 text-lg font-bold border-2"
                    onKeyDown={(e) => e.key === 'Enter' && handleQuickUpdate()}
                  />
                  <Button 
                    onClick={handleQuickUpdate} 
                    className="h-12 px-6 rounded-xl bg-gradient-to-br from-primary to-purple-600"
                    disabled={!quickVal}
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Valider
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {canEdit && (
          <div className="pulse-card overflow-hidden border-2 border-accent/20">
            <button 
              className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
              onClick={() => setShowTargetEdit(!showTargetEdit)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-accent" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-sm">Modifier la cible</h3>
                  <p className="text-xs text-muted-foreground">Objectif : {safeObj.target.toLocaleString()} {safeObj.unit}</p>
                </div>
              </div>
              {showTargetEdit ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
            </button>
            
            {showTargetEdit && (
              <div className="p-4 pt-0 space-y-3 border-t border-border/30">
                {!editingTarget ? (
                  <Button variant="outline" onClick={() => setEditingTarget(true)} className="w-full">
                    <Edit2 className="w-4 h-4 mr-2" />
                    Modifier la cible
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Input 
                      type="number" 
                      value={newTarget} 
                      onChange={(e) => setNewTarget(e.target.value)} 
                      className="flex-1 h-10 font-bold"
                    />
                    <Button onClick={handleTargetSave} className="h-10" size="sm">
                      <Save className="w-4 h-4 mr-1" />
                      Sauver
                    </Button>
                    <Button variant="ghost" onClick={() => { setEditingTarget(false); setNewTarget(safeObj.target.toString()) }} className="h-10" size="sm">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {canEdit && (
          <div className="pulse-card overflow-hidden border-2 border-emerald-500/20">
            <button 
              className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
              onClick={() => setShowPaliersEdit(!showPaliersEdit)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Award className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-sm">Gérer les paliers</h3>
                  <p className="text-xs text-muted-foreground">{editingPaliers.length} palier(s) configuré(s)</p>
                </div>
              </div>
              {showPaliersEdit ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
            </button>
            
            {showPaliersEdit && (
              <div className="p-4 pt-0 space-y-3 border-t border-border/30">
                {editingPaliers.map((palier, index) => (
                  <div key={index} className="p-3 rounded-lg bg-muted/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground">Palier {index + 1}</span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:bg-red-500/10" onClick={() => removePalier(index)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <Input 
                      value={palier.name} 
                      onChange={(e) => updatePalier(index, 'name', e.target.value)} 
                      placeholder="Nom du palier"
                      className="h-8 text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground mb-1 block">Seuil (objectif)</label>
                        <Input 
                          type="number" 
                          value={palier.threshold} 
                          onChange={(e) => updatePalier(index, 'threshold', Number(e.target.value))} 
                          placeholder="10000"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground mb-1 block">Prime (€)</label>
                        <Input 
                          type="number" 
                          value={palier.reward} 
                          onChange={(e) => updatePalier(index, 'reward', Number(e.target.value))} 
                          placeholder="80"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                <div className="flex gap-2">
                  <Button variant="outline" onClick={addPalier} className="flex-1">
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter un palier
                  </Button>
                  <Button onClick={handlePaliersSave} className="bg-emerald-600 hover:bg-emerald-700">
                    <Save className="w-4 h-4 mr-2" />
                    Sauvegarder
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {canEdit && (
          <div className="pulse-card overflow-hidden border-2 border-blue-500/20">
            <button 
              className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
              onClick={() => setShowDurationEdit(!showDurationEdit)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-sm">Durée de l'objectif</h3>
                  <p className="text-xs text-muted-foreground">{period.isIndefinite ? "∞ Illimité" : period.label}</p>
                </div>
              </div>
              {showDurationEdit ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
            </button>
            
            {showDurationEdit && (
              <div className="p-4 pt-0 space-y-3 border-t border-border/30">
                <div className="text-xs text-muted-foreground">
                  {period.isIndefinite ? (
                    <span>Aucune date de fin — l'historique reste complet.</span>
                  ) : (
                    <>Du <span className="font-bold text-foreground">{format(period.start ?? new Date(), "d MMM yyyy", { locale: fr })}</span> au <span className="font-bold text-foreground">{format(period.end ?? new Date(), "d MMM yyyy", { locale: fr })}</span></>
                  )}
                </div>

                {!period.isIndefinite && period.elapsedPct != null && (
                  <div className="space-y-2">
                    <Progress value={Math.max(0, Math.min(100, period.elapsedPct))} className="h-3" />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                      <span>{period.isExpired ? "⏱️ Période terminée" : `⏳ ${Math.max(0, period.daysLeft ?? 0)}j restants`}</span>
                      <span>{Math.round(period.elapsedPct)}% du temps écoulé</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Commence le</span>
                  <Input type="date" value={period.start ? format(period.start, "yyyy-MM-dd") : ""} onChange={(e) => handleStartDateUpdate(e.target.value)} className="h-9 rounded-xl text-xs" />
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 6].map((m) => {
                    const active = !period.isIndefinite && period.months === m
                    return (
                      <Button key={m} type="button" variant={active ? "default" : "outline"} size="sm" className={cn("rounded-full font-bold", active && "bg-gradient-to-r from-primary to-purple-600")} disabled={savingDuration} onClick={() => handleDurationUpdate(m)}>
                        {m}M
                      </Button>
                    )
                  })}
                  <Button type="button" variant={period.isIndefinite ? "default" : "outline"} size="sm" className={cn("rounded-full font-bold", period.isIndefinite && "bg-gradient-to-r from-primary to-purple-600")} disabled={savingDuration} onClick={() => handleDurationUpdate(null)}>
                    ∞
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pulse-card p-5 border-2 border-accent/20">
          <LineChartPro history={safeObj.history} current={safeObj.current} target={safeObj.target} direction={safeObj.direction} unit={safeObj.unit} periodStart={period.isIndefinite ? null : period.start} periodEnd={period.isIndefinite ? null : period.end} />
        </div>

        <section className="space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            Paliers à atteindre
          </h2>
          
          <div className="relative space-y-0">
            <div className="absolute left-[23px] top-6 bottom-6 w-1 bg-gradient-to-b from-primary via-purple-500 to-accent rounded-full opacity-20" />

            {safeObj.paliers
              .sort((a:any, b:any) => safeObj.direction === 'descending' ? b.threshold - a.threshold : a.threshold - b.threshold)
              .map((palier: any, index: number) => {
                const isReached = safeObj.direction === 'descending' ? safeObj.current <= palier.threshold : safeObj.current >= palier.threshold
                
                return (
                  <div key={index} className="flex items-start gap-4 py-4 group relative">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center z-10 shadow-lg transition-all", isReached ? "bg-gradient-to-br from-emerald-500 to-green-500 scale-110" : "bg-muted/50 group-hover:bg-muted")}>
                      {isReached ? <CheckCircle2 className="w-6 h-6 text-white" /> : <Circle className="w-6 h-6 text-muted-foreground" />}
                    </div>

                    <div className={cn("flex-1 p-4 rounded-2xl transition-all", isReached ? "bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-2 border-emerald-500/30 shadow-lg" : "bg-muted/30 border border-border group-hover:bg-muted/50")}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h4 className={cn("font-bold text-sm", isReached && "text-emerald-600")}>{palier.name}</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            Objectif : <span className="font-semibold text-foreground">{Number(palier.threshold || 0).toLocaleString()} {safeObj.unit}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <div className={cn("text-xl font-black", isReached ? "bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent" : "text-muted-foreground")}>
                            +{palier.reward}€
                          </div>
                          {isReached && <Badge className="mt-1 bg-emerald-500/20 text-emerald-600 border-emerald-500/30 text-[9px] font-bold">DÉBLOQUÉ</Badge>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </section>

      </main>
      <BottomNav />
    </div>
  )
}

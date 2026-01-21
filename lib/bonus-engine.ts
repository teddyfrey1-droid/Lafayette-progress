import { prorataRatio } from "@/lib/identity"

export type ObjectiveDirection = "ascending" | "descending"
export type ObjectiveType = "principal" | "secondaire" | string

export interface ObjectivePalier {
  id?: string
  threshold: number
  reward: number
  name?: string
}

export interface ObjectiveLike {
  id: string
  title?: string
  type?: ObjectiveType
  direction?: ObjectiveDirection
  isActive?: boolean
  current?: number
  target?: number
  fixedReward?: number
  reward?: number
  paliers?: ObjectivePalier[]
}

export interface BonusComputation {
  principalMet: boolean
  totalPotential: number
  unlocked: number
  prorata: {
    ratio: number
    totalPotential: number
    unlocked: number
    pending: number
  }
}

function num(v: any, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

export function objectiveMaxReward(obj: ObjectiveLike): number {
  if (Array.isArray(obj.paliers) && obj.paliers.length > 0) {
    return obj.paliers.reduce((sum, p) => sum + Math.max(0, num(p.reward, 0)), 0)
  }
  const fixed = obj.fixedReward ?? obj.reward
  return Math.max(0, num(fixed, 0))
}

function isReached(obj: ObjectiveLike, threshold: number): boolean {
  const current = num(obj.current, 0)
  // If current is 0 and we don't have data, avoid unlocking descending objectives by default.
  if (obj.direction === "descending" && current === 0) return false

  if (obj.direction === "descending") return current <= threshold
  // ascending default
  return current >= threshold
}

export function objectiveUnlocked(obj: ObjectiveLike): number {
  if (obj.isActive === false) return 0

  // If paliers exist, we sum rewards of reached paliers
  if (Array.isArray(obj.paliers) && obj.paliers.length > 0) {
    return obj.paliers.reduce((sum, p) => {
      const thr = num(p.threshold, 0)
      return sum + (isReached(obj, thr) ? Math.max(0, num(p.reward, 0)) : 0)
    }, 0)
  }

  const target = num(obj.target, 0)
  const fixed = obj.fixedReward ?? obj.reward
  const reward = Math.max(0, num(fixed, 0))
  if (!reward) return 0
  if (!target) return 0
  return isReached(obj, target) ? reward : 0
}


export function objectiveProgressPct(obj: ObjectiveLike): number {
  if (obj.isActive === false) return 0

  const max = objectiveMaxReward(obj)
  if (!max) return 0

  // For paliers, use money-based progress (stable, single source of truth)
  if (Array.isArray(obj.paliers) && obj.paliers.length > 0) {
    const unlocked = objectiveUnlocked(obj)
    const pct = (unlocked / max) * 100
    return Math.max(0, Math.min(100, Math.round(pct)))
  }

  const target = num(obj.target, 0)
  const current = num(obj.current, 0)

  if (!target) return objectiveUnlocked(obj) > 0 ? 100 : 0

  if (obj.direction === "descending") {
    // Avoid unlocking/claiming progress when current is unknown (0)
    if (current === 0) return 0
    if (current <= target) return 100
    const pct = (target / current) * 100
    return Math.max(0, Math.min(100, Math.round(pct)))
  }

  // ascending default
  if (current >= target) return 100
  const pct = (current / target) * 100
  return Math.max(0, Math.min(100, Math.round(pct)))
}

export function computeBonus(
  objectives: ObjectiveLike[],
  opts: { contractHours?: number; baseHours?: number; excludeFromPrimes?: boolean } = {}
): BonusComputation {
  const baseHours = opts.baseHours ?? 35
  const ratio = prorataRatio(opts.contractHours ?? baseHours, baseHours)

  const active = (objectives || []).filter((o) => o && o.isActive !== false)
  const principal = active.find((o) => (o.type || "").toLowerCase() === "principal")

  const principalMet = principal ? objectiveUnlocked(principal) >= objectiveMaxReward(principal) : true

  let totalPotential = 0
  let unlocked = 0

  for (const obj of active) {
    const max = objectiveMaxReward(obj)
    totalPotential += max

    // Secondary objectives only count if principal is met
    const isSecondary = (obj.type || "").toLowerCase() === "secondaire"
    if (isSecondary && !principalMet) continue

    unlocked += objectiveUnlocked(obj)
  }

  if (opts.excludeFromPrimes) {
    return {
      principalMet,
      totalPotential,
      unlocked: 0,
      prorata: { ratio, totalPotential: 0, unlocked: 0, pending: 0 },
    }
  }

  const prorataTotal = Math.round(totalPotential * ratio)
  const prorataUnlocked = Math.round(unlocked * ratio)
  const pending = Math.max(0, prorataTotal - prorataUnlocked)

  return {
    principalMet,
    totalPotential,
    unlocked,
    prorata: {
      ratio,
      totalPotential: prorataTotal,
      unlocked: prorataUnlocked,
      pending,
    },
  }
}

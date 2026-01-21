"use client"

import { useEffect, useMemo, useState } from "react"
import { collection, onSnapshot, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase/client"
import { useAuth } from "@/components/auth/auth-provider"
import { getTenantKey, tenantMatches } from "@/lib/tenant"
import { computeBonus, ObjectiveLike } from "@/lib/bonus-engine"
import { normalizeRole } from "@/lib/identity"

export type Objective = {
  id: string
  title: string
  description?: string
  current: number
  target: number
  unit: string
  type: "principal" | "secondaire"
  direction: "ascending" | "descending"
  isActive: boolean
  fixedReward?: number
  reward?: number
  paliers?: any[]
  hideRevenue?: boolean
  isConfidential?: boolean
  createdAt?: any
}

function num(v: any): number {
  if (typeof v === "number") return v
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function createdAtMs(v: any): number {
  try {
    if (!v) return 0
    if (typeof v === "string") return new Date(v).getTime() || 0
    if (typeof v?.toDate === "function") return v.toDate().getTime() || 0
    if (v instanceof Date) return v.getTime()
    return 0
  } catch {
    return 0
  }
}

function sortByCreatedAtDesc(a: Objective, b: Objective) {
  return createdAtMs(b.createdAt) - createdAtMs(a.createdAt)
}

function mapObjective(id: string, data: any): Objective {
  const hide = Boolean(data?.hideRevenue ?? data?.isConfidential)
  return {
    id,
    title: data?.title || "Sans titre",
    description: data?.description || "",
    current: num(data?.current),
    target: num(data?.target),
    unit: data?.unit || "",
    type: data?.type || "principal",
    direction: data?.direction || "ascending",
    isActive: data?.isActive !== false,
    fixedReward: data?.fixedReward,
    reward: data?.reward,
    paliers: Array.isArray(data?.paliers) ? data.paliers : [],
    hideRevenue: hide,
    isConfidential: hide,
    createdAt: data?.createdAt,
  }
}


export function useObjectives(contractHours?: number, excludeFromPrimes?: boolean) {
  const { profile } = useAuth()
  const tenantKey = getTenantKey(profile)
  const role = normalizeRole(profile?.role)
  const isSuperAdmin = role === "super_admin"

  const [objectives, setObjectives] = useState<Objective[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const col = collection(db, "objectives")

    // super_admin sans tenant -> liste globale (utile en console)
    if (isSuperAdmin && !tenantKey) {
      const unsub = onSnapshot(
        query(col),
        (snap) => {
          const list: Objective[] = []
          snap.forEach((docSnap) => list.push(mapObjective(docSnap.id, docSnap.data())))
          list.sort(sortByCreatedAtDesc)
          setObjectives(list)
          setLoading(false)
        },
        () => setLoading(false),
      )
      return () => unsub()
    }

    if (!tenantKey) {
      setObjectives([])
      setLoading(false)
      return
    }

    const map1 = new Map<string, Objective>()
    const map2 = new Map<string, Objective>()

    const recompute = () => {
      const merged = new Map<string, Objective>()
      for (const [k, v] of map1.entries()) merged.set(k, v)
      for (const [k, v] of map2.entries()) merged.set(k, v)
      const list = Array.from(merged.values()).sort(sortByCreatedAtDesc)
      setObjectives(list)
    }

    const handle = (target: Map<string, Objective>) => (snap: any) => {
      target.clear()
      snap.forEach((docSnap: any) => {
        const data = docSnap.data() as any
        if (!tenantMatches(data, tenantKey)) return
        target.set(docSnap.id, mapObjective(docSnap.id, data))
      })
      recompute()
      setLoading(false)
    }

    const unsub1 = onSnapshot(
      query(col, where("companyId", "==", tenantKey)),
      handle(map1),
      () => setLoading(false),
    )

    // compat legacy: company
    const unsub2 = onSnapshot(
      query(col, where("company", "==", tenantKey)),
      handle(map2),
      () => setLoading(false),
    )

    return () => {
      unsub1()
      unsub2()
    }
  }, [tenantKey, isSuperAdmin])

  const bonus = useMemo(() => {
    return computeBonus(objectives as ObjectiveLike[], {
      contractHours,
      baseHours: 35,
      excludeFromPrimes,
    })
  }, [objectives, contractHours, excludeFromPrimes])

  return {
    objectives,
    loading,
    totalPotential: bonus.totalPotential,
    unlocked: bonus.unlocked,
    totalPotentialProRata: bonus.prorata.totalPotential,
    unlockedProRata: bonus.prorata.unlocked,
    pendingProRata: bonus.prorata.pending,
    principalMet: bonus.principalMet,
  }
}

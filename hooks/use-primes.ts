"use client"

import { useEffect, useMemo, useState } from "react"
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  Timestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase/client"
import { useCurrentUser } from "@/lib/use-current-user"
import { tenantMatches } from "@/lib/tenant"

export type PrimeStatus = "pending" | "validated" | "paid"

export interface PrimeHistory {
  id: string
  month: string
  date: Date
  amount: number
  status: PrimeStatus
  userId?: string
  companyId?: string
  company?: string
}

function toDate(v: any): Date {
  try {
    if (!v) return new Date(0)
    if (v instanceof Date) return v
    if (typeof v?.toDate === "function") return v.toDate()
    if (typeof v === "string") return new Date(v)
    return new Date(0)
  } catch {
    return new Date(0)
  }
}

export function usePrimes() {
  const user = useCurrentUser()
  const tenantKey = user.tenantKey

  // IMPORTANT: historique éditable uniquement pour admin/super_admin
  const canEditHistory = user.isAdmin

  const [primes, setPrimes] = useState<PrimeHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)

    const col = collection(db, "primes_history")

    // super_admin sans tenant -> liste globale (console)
    if (user.isSuperAdmin && !tenantKey) {
      const unsub = onSnapshot(
        query(col),
        (snapshot) => {
          const items: PrimeHistory[] = snapshot.docs.map((d) => {
            const data: any = d.data()
            return {
              id: d.id,
              month: String(data?.month || ""),
              amount: Number(data?.amount || 0),
              status: (data?.status || "pending") as PrimeStatus,
              date: toDate(data?.date),
              userId: data?.userId,
              companyId: data?.companyId,
              company: data?.company,
            }
          })
          items.sort((a, b) => b.date.getTime() - a.date.getTime())
          setPrimes(items)
          setLoading(false)
        },
        () => setLoading(false),
      )
      return () => unsub()
    }

    if (!tenantKey) {
      setPrimes([])
      setLoading(false)
      return
    }

    const map1 = new Map<string, PrimeHistory>()
    const map2 = new Map<string, PrimeHistory>()

    const recompute = () => {
      const merged = new Map<string, PrimeHistory>()
      for (const [k, v] of map1.entries()) merged.set(k, v)
      for (const [k, v] of map2.entries()) merged.set(k, v)
      const list = Array.from(merged.values()).sort((a, b) => b.date.getTime() - a.date.getTime())
      setPrimes(list)
    }

    const handle = (target: Map<string, PrimeHistory>) => (snapshot: any) => {
      target.clear()
      snapshot.forEach((docSnap: any) => {
        const data: any = docSnap.data()
        if (!tenantMatches(data, tenantKey)) return

        const item: PrimeHistory = {
          id: docSnap.id,
          month: String(data?.month || ""),
          amount: Number(data?.amount || 0),
          status: (data?.status || "pending") as PrimeStatus,
          date: toDate(data?.date),
          userId: data?.userId,
          companyId: data?.companyId,
          company: data?.company,
        }

        target.set(docSnap.id, item)
      })
      recompute()
      setLoading(false)
    }

    // Requêtes tenant-safe (sinon la query échoue avec des règles strictes)
    // - Admin : tout l'historique du tenant
    // - Non-admin : uniquement son historique
    const q1 = canEditHistory
      ? query(col, where("companyId", "==", tenantKey))
      : query(col, where("companyId", "==", tenantKey), where("userId", "==", user.uid))

    const q2 = canEditHistory
      ? query(col, where("company", "==", tenantKey))
      : query(col, where("company", "==", tenantKey), where("userId", "==", user.uid))

    const unsub1 = onSnapshot(q1, handle(map1), () => setLoading(false))
    const unsub2 = onSnapshot(q2, handle(map2), () => setLoading(false))

    return () => {
      unsub1()
      unsub2()
    }
  }, [tenantKey, user.uid, user.isSuperAdmin, user.isAdmin])

  const updatePrime = async (id: string, data: Partial<PrimeHistory>) => {
    if (!canEditHistory) throw new Error("FORBIDDEN")

    const patch: any = {}
    if (typeof data.month === "string") patch.month = data.month
    if (typeof data.amount === "number") patch.amount = data.amount
    if (typeof data.status === "string") patch.status = data.status
    if (data.date instanceof Date) patch.date = Timestamp.fromDate(data.date)

    await updateDoc(doc(db, "primes_history", id), patch)
  }

  const deletePrime = async (id: string) => {
    if (!canEditHistory) throw new Error("FORBIDDEN")
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet historique ?")) return
    await deleteDoc(doc(db, "primes_history", id))
  }

  const addPrime = async (prime: Omit<PrimeHistory, "id">) => {
    if (!canEditHistory) throw new Error("FORBIDDEN")
    if (!tenantKey) throw new Error("NO_TENANT")

    await addDoc(collection(db, "primes_history"), {
      month: prime.month,
      amount: Number(prime.amount || 0),
      status: prime.status || "pending",
      date: Timestamp.fromDate(prime.date instanceof Date ? prime.date : new Date()),
      userId: prime.userId || user.uid,
      companyId: tenantKey,
      company: user.companyName || tenantKey,
    })
  }

  return {
    primes,
    loading,
    canEditHistory,
    updatePrime,
    deletePrime,
    addPrime,
  }
}

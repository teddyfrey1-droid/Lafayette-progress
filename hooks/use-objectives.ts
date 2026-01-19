"use client"

import { useEffect, useState } from "react"
import { collection, onSnapshot, query } from "firebase/firestore"
import { db } from "@/lib/firebase/client"
import type { Objective } from "@/lib/demo-data"

export function useObjectives() {
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, "objectives"))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: Objective[] = []
        snapshot.forEach((d) => {
          const data: any = d.data()
          const deadline = data?.deadline?.toDate ? data.deadline.toDate() : data?.deadline ? new Date(data.deadline) : new Date()
          items.push({ id: d.id, ...data, deadline } as Objective)
        })
        setObjectives(items)
        setLoading(false)
      },
      (error) => {
        console.error("Erreur récup objectifs:", error)
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [])

  return { objectives, loading }
}

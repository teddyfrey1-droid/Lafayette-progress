"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, query, onSnapshot, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/auth-provider"; // 👈 Ajout important
import { demoGetObjectives, subscribeDemo } from "@/lib/demo/local-demo-store";

export interface Objective {
  id: string;
  title: string;
  description?: string;
  current: number;
  target: number;
  unit: string;
  type?: "principal" | "secondaire";
  direction?: "ascending" | "descending";
  isActive?: boolean;
  isConfidential?: boolean;
  deadline?: Date;
  periodStart?: any;
  periodEnd?: any;
  periodMonths?: number | null;
  paliers?: { level: number; reward: number; threshold: number; reached: boolean }[];
  reward?: number;
  history?: { date: string; value: number; change: number; timestamp?: string }[];
  createdAt?: any;
}

export function useObjectives() {
  const { profile, isDemo } = useAuth(); // 👈 Récupération du profil
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Si on n'a pas encore l'info de la société, on ne fait rien pour éviter des erreurs
    if (!profile?.companyId) return;

    // --- MODE DÉMO (Starter + Trial) : tout est local (localStorage) ---
    if (isDemo) {
      const companyId = profile.companyId;
      const load = () => {
        const items = (demoGetObjectives(companyId) as any[])
          .filter((o) => o.isActive !== false)
          .map((o) => ({ ...o })) as Objective[];
        setObjectives(items);
        setLoading(false);
      };

      load();
      const unsub = subscribeDemo(companyId, load);
      return () => unsub();
    }

    // ⚡ REQUÊTE CORRIGÉE : On ajoute le filtre companyId
    // Note : Regardez la console de votre navigateur. Si une erreur rouge apparaît,
    // cliquez sur le lien "Create index" fourni par Firebase.
    const q = query(
      collection(db, "objectives"), 
      where("companyId", "==", profile.companyId), // 👈 Le filtre manquant est ici !
      where("isActive", "==", true), 
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Objective[] = [];
      
      snapshot.forEach((doc) => {
        const data: any = doc.data()

        let deadline: Date | null = null
        if (data.deadline) {
          deadline = data.deadline?.toDate ? data.deadline.toDate() : new Date(data.deadline)
        }

        let periodStart: Date | null = null
        if (data.periodStart) {
          periodStart = data.periodStart?.toDate ? data.periodStart.toDate() : new Date(data.periodStart)
        }

        let periodEnd: Date | null = null
        if (data.periodEnd) {
          periodEnd = data.periodEnd?.toDate ? data.periodEnd.toDate() : new Date(data.periodEnd)
        }

        const periodMonths = (data.periodMonths ?? data.durationMonths ?? null) as any

        items.push({
          id: doc.id,
          ...data,
          deadline,
          periodStart,
          periodEnd,
          periodMonths,
        } as Objective)
      })

      setObjectives(items);
      setLoading(false);
    }, (error) => {
      console.error("Erreur récup objectifs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.companyId]); // 👈 On relance l'effet si l'ID société change

  // --- 🚀 CALCULS OPTIMISÉS (useMemo) ---
  const { totalPotential, globalProgress } = useMemo(() => {
    const total = objectives.reduce((acc, obj) => {
      if (obj.isActive === false) return acc; 
      
      const objMax = obj.paliers && obj.paliers.length > 0 
        ? obj.paliers.reduce((sum, p) => sum + (p.reward || 0), 0)
        : (obj.reward || 0);
        
      return acc + objMax;
    }, 0);

    const count = objectives.length;
    const progress = count > 0 
      ? Math.round(objectives.reduce((acc, curr) => {
        let p = 0;
        if (curr.direction === 'descending') {
             p = curr.current <= curr.target ? 100 : Math.max(0, (curr.target / (curr.current || 1)) * 100);
        } else {
             p = Math.min(100, Math.max(0, (curr.current / curr.target) * 100));
        }
        return acc + p;
      }, 0) / count)
      : 0;

      return { totalPotential: total, globalProgress: progress };
  }, [objectives]);

  return { 
    objectives, 
    loading,
    totalPotential,
    globalProgress
  };
}

"use client";

import { useState, useEffect, useMemo } from "react";
// Ajout de 'where' pour le filtre et 'useMemo' pour la performance
import { collection, query, onSnapshot, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

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
  deadline?: Date;
  paliers?: { level: number; reward: number; threshold: number; reached: boolean }[];
  reward?: number;
  createdAt?: any;
}

export function useObjectives() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ⚡ OPTIMISATION COÛT : On ne charge que les objectifs ACTIFS (isActive == true)
    // Cela évite de charger les vieux objectifs archivés inutiles pour le dashboard.
    // Note : Si la console affiche une erreur "Index required", cliquez sur le lien dans la console pour le créer.
    const q = query(
      collection(db, "objectives"), 
      where("isActive", "==", true), 
      orderBy("createdAt", "desc")
    );

    // On garde le temps réel (onSnapshot) ici car c'est motivant de voir les jauges bouger !
    // Comme il y a peu d'objectifs actifs (5 à 10 max), ce n'est pas cher.
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Objective[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        let deadline = null;
        if (data.deadline) {
            deadline = data.deadline?.toDate ? data.deadline.toDate() : new Date(data.deadline);
        }

        items.push({ 
          id: doc.id, 
          ...data,
          deadline: deadline
        } as Objective);
      });

      setObjectives(items);
      setLoading(false);
    }, (error) => {
      console.error("Erreur récup objectifs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- 🚀 CALCULS OPTIMISÉS (useMemo) ---
  // On ne recalcule que si la liste 'objectives' change
  
  const { totalPotential, globalProgress } = useMemo(() => {
    // 1. Somme totale
    const total = objectives.reduce((acc, obj) => {
      // Sécurité supplémentaire : on ne compte pas si inactif (même si le filtre le fait déjà)
      if (obj.isActive === false) return acc; 
      
      const objMax = obj.paliers && obj.paliers.length > 0 
        ? obj.paliers.reduce((sum, p) => sum + (p.reward || 0), 0)
        : (obj.reward || 0);
        
      return acc + objMax;
    }, 0);

    // 2. Progression moyenne
    const count = objectives.length;
    const progress = count > 0 
      ? Math.round(objectives.reduce((acc, curr) => {
        let p = 0;
        if (curr.direction === 'descending') {
             // Exemple : Taux d'erreur. Cible 2%, Actuel 5% => 40% de réussite (0.4)
             p = curr.current <= curr.target ? 100 : Math.max(0, (curr.target / (curr.current || 1)) * 100);
        } else {
             // Sens normal (CA)
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

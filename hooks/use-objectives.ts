"use client";

import { useState, useEffect } from "react";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

// On définit une interface locale souple pour éviter les conflits de types
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
  deadline?: Date; // Le champ critique
  paliers?: { level: number; reward: number; threshold: number; reached: boolean }[];
  reward?: number;
  createdAt?: any;
}

export function useObjectives() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On garde 'orderBy' pour que les objectifs ne changent pas de place tout seuls
    const q = query(collection(db, "objectives"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Objective[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // --- 🛡️ SÉCURITÉ DATE (VOTRE CODE) ---
        // On gère le cas où deadline existe ou non, et si c'est un Timestamp Firestore
        let deadline = null;
        if (data.deadline) {
            // Si c'est un Timestamp Firestore, on a la fonction .toDate()
            // Sinon on essaie de le parser comme une date standard
            deadline = data.deadline?.toDate ? data.deadline.toDate() : new Date(data.deadline);
        }

        items.push({ 
          id: doc.id, 
          ...data,
          deadline: deadline // On applique la date convertie
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

  // --- 🚀 CALCULS AUTOMATIQUES (POUR LE DASHBOARD) ---
  
  // 1. Somme totale des primes potentielles
  const totalPotential = objectives.reduce((acc, obj) => {
      if (!obj.isActive) return acc; // On ne compte pas les inactifs
      
      // Si paliers, on additionne tout, sinon on prend la reward fixe
      const objMax = obj.paliers && obj.paliers.length > 0 
        ? obj.paliers.reduce((sum, p) => sum + (p.reward || 0), 0)
        : (obj.reward || 0);
        
      return acc + objMax;
  }, 0);

  // 2. Progression globale moyenne (Pour la jauge du dashboard)
  const activeObjectives = objectives.filter(o => o.isActive);
  const globalProgress = activeObjectives.length > 0 
    ? Math.round(activeObjectives.reduce((acc, curr) => {
        let p = 0;
        // Gestion sens inverse (ex: Taux d'erreur)
        if (curr.direction === 'descending') {
             p = curr.current <= curr.target ? 100 : Math.max(0, (curr.target / (curr.current || 1)) * 100);
        } else {
             // Sens normal (ex: CA)
             p = Math.min(100, Math.max(0, (curr.current / curr.target) * 100));
        }
        return acc + p;
    }, 0) / activeObjectives.length)
    : 0;

  return { 
    objectives, 
    loading,
    totalPotential, // Ajouté pour le Dashboard
    globalProgress  // Ajouté pour le Dashboard
  };
}

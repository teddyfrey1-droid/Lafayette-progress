"use client"

import { useState, useEffect } from "react"
import { collection, onSnapshot, query, doc, updateDoc, arrayUnion, increment, addDoc, orderBy, where } from "firebase/firestore"
import { db } from "@/lib/firebase/client"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { useCurrentUser } from "@/lib/use-current-user" // 👈 INDISPENSABLE pour savoir qui est connecté

export type ObjectiveType = "ca" | "error" | "volume" | "satisfaction" | "margin"

export function usePilotage() {
  const currentUser = useCurrentUser() // 👈 On récupère l'utilisateur connecté
  const [team, setTeam] = useState<any[]>([])
  const [objectives, setObjectives] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // 1. Charger les données en temps réel (FILTRÉES PAR ENTREPRISE)
  useEffect(() => {
    // Si l'utilisateur n'est pas encore chargé ou n'a pas d'entreprise, on attend
    if (!currentUser?.companyId) return;

    // --- A. CHARGEMENT DE L'ÉQUIPE ---
    // On ne prend que les utilisateurs qui ont le MÊME companyId que le gérant
    const qUsers = query(
        collection(db, "users"), 
        where("companyId", "==", currentUser.companyId) // 🔒 SÉCURITÉ : cloisonnement par entreprise
    );

    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const users = snapshot.docs
        // On exclut les super admins et les utilisateurs "orphelins" ou "en attente" qui n'ont pas de rôle défini
        .filter(d => {
            const data = d.data();
            return data.role !== 'super_admin' && data.status !== 'pending_assignment'; 
        })
        .map(d => {
            const data = d.data();
            const initials = (data.displayName || data.email || "??").substring(0, 2).toUpperCase();
            const colors = ["bg-purple-500", "bg-blue-500", "bg-pink-500", "bg-indigo-500", "bg-emerald-500"];
            
            return {
                id: d.id,
                name: data.displayName || data.email,
                role: data.role || "Employé",
                hoursContract: Number(data.contractHours) || 35,
                initials,
                color: colors[initials.charCodeAt(0) % colors.length],
                progress: 0 
            };
        });
      setTeam(users);
    });

    // --- B. CHARGEMENT DES OBJECTIFS ---
    // On ne charge que les objectifs de CETTE entreprise
    const qObj = query(
        collection(db, "objectives"), 
        where("companyId", "==", currentUser.companyId), // 🔒 SÉCURITÉ
        orderBy("createdAt", "desc")
    );

    const unsubObj = onSnapshot(qObj, (snapshot) => {
      const objs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setObjectives(objs);
      setLoading(false);
    });

    return () => { unsubUsers(); unsubObj(); }
  }, [currentUser?.companyId]); // On recharge si l'utilisateur change (rare)

  // 2. Calculs Globaux (KPIs)
  const totalHours = team.reduce((acc, curr) => acc + curr.hoursContract, 0);
  
  const globalProgress = objectives.length > 0 
    ? Math.round(objectives.reduce((acc, curr: any) => {
        let p = 0;
        if (curr.direction === 'descending') {
             p = curr.current <= curr.target ? 100 : Math.max(0, (curr.target / (curr.current || 1)) * 100);
        } else {
             p = Math.min(100, (curr.current / curr.target) * 100);
        }
        return acc + p;
    }, 0) / objectives.length)
    : 0;

  const totalPotentialBonus = objectives.reduce((acc, obj: any) => {
      const objMax = obj.paliers?.length > 0 
        ? obj.paliers.reduce((sum:number, p:any) => sum + p.reward, 0)
        : (obj.reward || 0);
      return acc + objMax;
  }, 0);

  // 3. Actions (Création / Mise à jour)

  const createObjective = async (data: any) => {
      if (!currentUser?.companyId) return false; // Sécurité

      try {
          await addDoc(collection(db, "objectives"), {
              ...data,
              companyId: currentUser.companyId, // 🔒 On associe l'objectif à l'entreprise
              current: data.direction === 'descending' ? data.target * 1.5 : 0,
              paliers: [],
              history: [],
              isActive: true,
              createdAt: new Date().toISOString()
          });
          return true;
      } catch (e) {
          console.error(e);
          return false;
      }
  }

  const updateObjectiveProgress = async (objectiveId: string, amount: number) => {
    const objRef = doc(db, "objectives", objectiveId);
    const todayStr = format(new Date(), "d MMM", { locale: fr }); 

    try {
        await updateDoc(objRef, {
            current: increment(amount), 
            history: arrayUnion({
                date: todayStr,
                value: amount, 
                change: amount,
                timestamp: new Date().toISOString()
            })
        });
        return true;
    } catch (e) { return false; }
  };

  return {
    team,
    objectives,
    loading,
    totalHours,
    globalProgress,
    totalPotentialBonus,
    createObjective,
    updateObjectiveProgress
  }
}

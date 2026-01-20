"use client"

import { useState, useEffect } from "react"
import { collection, onSnapshot, query, doc, updateDoc, arrayUnion, increment, addDoc, orderBy, where, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase/client"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { useCurrentUser } from "@/lib/use-current-user"

export type ObjectiveType = "ca" | "error" | "volume" | "satisfaction" | "margin"

export function usePilotage() {
  const currentUser = useCurrentUser()
  const [team, setTeam] = useState<any[]>([])
  const [objectives, setObjectives] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // 1. Charger les données en temps réel
  useEffect(() => {
    if (!currentUser?.companyId) return;

    // --- A. ÉQUIPE (Avec filtre sécurisé) ---
    const qUsers = query(
        collection(db, "users"), 
        where("companyId", "==", currentUser.companyId)
    );

    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const users = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() })) 
        .filter((user: any) => {
            // On cache le Super Admin
            if (user.role === 'super_admin') return false;
            // On cache les "Non assignés" (Sécurité)
            if (user.companyName === "Non assigné") return false;
            // On garde tout le reste (Actif, En attente, Suspendu...)
            return true;
        })
        .map((data: any) => {
            const initials = (data.displayName || data.email || "??").substring(0, 2).toUpperCase();
            const colors = ["bg-purple-500", "bg-blue-500", "bg-pink-500", "bg-indigo-500", "bg-emerald-500"];
            
            return {
                id: data.id,
                name: data.displayName || data.email,
                role: data.role || "Employé",
                hoursContract: Number(data.contractHours) || 35,
                initials,
                color: colors[initials.charCodeAt(0) % colors.length],
                status: data.status, 
                progress: 0 
            };
        });
      setTeam(users);
    });

    // --- B. OBJECTIFS ---
    const qObj = query(
        collection(db, "objectives"), 
        where("companyId", "==", currentUser.companyId),
        orderBy("createdAt", "desc")
    );

    const unsubObj = onSnapshot(qObj, (snapshot) => {
      const objs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setObjectives(objs);
      setLoading(false);
    });

    return () => { unsubUsers(); unsubObj(); }
  }, [currentUser?.companyId]);

  // 2. Calculs Globaux
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

  // 3. Actions

  const createObjective = async (data: any) => {
      if (!currentUser?.companyId) return false; 
      try {
          await addDoc(collection(db, "objectives"), {
              ...data,
              companyId: currentUser.companyId,
              current: data.direction === 'descending' ? data.target * 1.5 : 0,
              paliers: [],
              history: [],
              isActive: true,
              createdAt: new Date().toISOString()
          });
          return true;
      } catch (e) { return false; }
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

  // --- NOUVELLE FONCTION PLANIFICATION ---
  const savePlanning = async (data: any) => {
      if (!currentUser?.companyId) return false;
      try {
          // On sauvegarde la plannification dans une sous-collection ou un document dédié
          // Ici on utilise une collection 'plannings' liée à l'entreprise
          await addDoc(collection(db, "plannings"), {
              ...data,
              companyId: currentUser.companyId,
              createdAt: new Date().toISOString(),
              status: "scheduled"
          });
          return true;
      } catch (e) {
          console.error(e);
          return false;
      }
  }

  return {
    team,
    objectives,
    loading,
    totalHours,
    globalProgress,
    totalPotentialBonus,
    createObjective,
    updateObjectiveProgress,
    savePlanning // Exporter la fonction
  }
}

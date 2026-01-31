"use client";

import { useState, useEffect } from "react";
// 1. On change les imports pour utiliser getDocs (lecture unique) et limit (économie)
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, deleteDoc, addDoc, Timestamp, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { useAuth } from "@/components/auth/auth-provider";
import {
  demoAddPrime,
  demoDeletePrime,
  demoGetPrimes,
  demoUpdatePrime,
  subscribeDemo,
} from "@/lib/demo/local-demo-store";

export interface PrimeHistory {
  id: string;
  month: string;
  date: Date;
  amount: number;
  status: "pending" | "validated" | "paid";
  userId?: string;
}

export function usePrimes() {
  // On récupère l'utilisateur pour savoir s'il est admin ou employé
  const { userData, loading: authLoading } = useCurrentUser();
  const { profile, isDemo } = useAuth();
  const [primes, setPrimes] = useState<PrimeHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    // --- MODE DÉMO : primes en localStorage ---
    if (isDemo && (profile as any)?.companyId) {
      const companyId = (profile as any).companyId as string
      const load = () => {
        const all = demoGetPrimes(companyId)
        const isManager = userData?.role === "admin" || userData?.role === "gerant"
        const filtered = isManager ? all : all.filter((p: any) => p.userId === userData?.uid)
        const items: PrimeHistory[] = filtered
          .map((p: any) => ({
            id: p.id,
            month: p.month,
            amount: p.amount,
            status: p.status,
            date: p.date ? new Date(p.date) : new Date(),
            userId: p.userId,
          }))
          .sort((a, b) => b.date.getTime() - a.date.getTime())
        setPrimes(items)
        setLoading(false)
      }
      load()
      const unsub = subscribeDemo(companyId, load)
      return () => unsub()
    }

    const fetchPrimes = async () => {
      setLoading(true);
      try {
        let q;

        // --- OPTIMISATION N°2 : LE FILTRAGE INTELLIGENT ---
        
        if (userData?.role === "admin" || userData?.role === "gerant") {
          // L'admin voit TOUT, mais limité aux 50 dernières (pour ne pas tout casser)
          q = query(
            collection(db, "primes_history"),
            orderBy("date", "desc"),
            limit(50) // <--- ICI
          );
        } else if (userData?.uid) {
          // L'employé ne voit que SES primes (Sécurité)
          q = query(
            collection(db, "primes_history"),
            where("userId", "==", userData.uid), // <--- ET ICI
            orderBy("date", "desc"),
            limit(20)
          );
        } else {
          setLoading(false);
          return;
        }

        // --- OPTIMISATION N°1 : LECTURE UNIQUE ---
        // On utilise getDocs au lieu de onSnapshot
        const snapshot = await getDocs(q); 
        
        const items: PrimeHistory[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          items.push({
            id: doc.id,
            month: data.month,
            amount: data.amount,
            status: data.status,
            date: data.date?.toDate ? data.date.toDate() : new Date(),
            userId: data.userId
          });
        });
        setPrimes(items);
      } catch (error) {
        console.error("Erreur chargement primes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrimes();
  }, [userData, authLoading, isDemo, (profile as any)?.companyId]);

  // --- ACTIONS (Restent identiques) ---

  const updatePrime = async (id: string, data: Partial<PrimeHistory>) => {
    try {
      if (isDemo && (profile as any)?.companyId) {
        demoUpdatePrime((profile as any).companyId, id, {
          ...data,
          date: data.date ? data.date.toISOString() : undefined,
        } as any)
        setPrimes((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)))
        return
      }
      await updateDoc(doc(db, "primes_history", id), data);
      // Petite astuce : on met à jour la liste locale pour éviter de recharger la page
      setPrimes(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
    } catch (error) {
      console.error("Erreur update:", error);
      throw error;
    }
  };

  const deletePrime = async (id: string) => {
    if(!confirm("Êtes-vous sûr de vouloir supprimer cet historique ?")) return;
    try {
      if (isDemo && (profile as any)?.companyId) {
        demoDeletePrime((profile as any).companyId, id)
        setPrimes((prev) => prev.filter((p) => p.id !== id))
        return
      }
      await deleteDoc(doc(db, "primes_history", id));
      setPrimes(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error("Erreur delete:", error);
      throw error;
    }
  };

  const addPrime = async (prime: Omit<PrimeHistory, "id">) => {
    try {
      if (isDemo && (profile as any)?.companyId) {
        const companyId = (profile as any).companyId as string
        const newId = `demo-prime-${Date.now()}`
        demoAddPrime(companyId, {
          id: newId,
          month: prime.month,
          amount: prime.amount,
          status: prime.status,
          userId: prime.userId,
          date: prime.date.toISOString(),
        } as any)
        const newPrime = { id: newId, ...prime }
        setPrimes((prev) => [newPrime, ...prev])
        return
      }
      const docRef = await addDoc(collection(db, "primes_history"), {
        ...prime,
        date: Timestamp.fromDate(prime.date)
      });
      // On ajoute manuellement à la liste pour voir le résultat tout de suite
      const newPrime = { id: docRef.id, ...prime };
      setPrimes(prev => [newPrime, ...prev]);
    } catch (error) {
      console.error("Erreur add:", error);
      throw error;
    }
  }

  return { primes, loading, updatePrime, deletePrime, addPrime };
}

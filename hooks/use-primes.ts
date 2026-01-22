import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/client";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore"; // <-- on utilise getDocs ici, plus onSnapshot
import { useCurrentUser } from "@/lib/use-current-user";

export interface PrimeHistory {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  date: any; // Timestamp
  validatedBy?: string;
}

export function usePrimes() {
  const { userData, loading: authLoading } = useCurrentUser();
  const [primes, setPrimes] = useState<PrimeHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Si l'utilisateur charge encore, on attend
    if (authLoading) return;

    const fetchPrimes = async () => {
      setLoading(true);
      try {
        let q;

        // Optimisation : On ne charge que les 50 dernières primes pour éviter de tout lire
        if (userData?.role === "admin" || userData?.role === "gerant") {
          // L'admin voit tout l'historique global
          q = query(
            collection(db, "primes_history"),
            orderBy("date", "desc"),
            limit(50)
          );
        } else if (userData?.uid) {
          // L'employé ne voit que SES primes (Sécurité + Économie)
          // Note: Il faut un index composite dans Firebase pour faire 'where' + 'orderBy'
          // Si ça plante, cliquez sur le lien dans la console du navigateur pour créer l'index.
          q = query(
            collection(db, "primes_history"),
            where("userId", "==", userData.uid), 
            orderBy("date", "desc"),
            limit(20)
          );
        } else {
          setLoading(false);
          return;
        }

        const snapshot = await getDocs(q); // <-- Lecture unique (pas de temps réel)
        
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as PrimeHistory[];

        setPrimes(items);
      } catch (error) {
        console.error("Erreur chargement primes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrimes();
  }, [userData, authLoading]); // Se relance uniquement si l'utilisateur change

  return { primes, loading };
}

// Petit helper pour ajouter 'where' si besoin
import { where } from "firebase/firestore";

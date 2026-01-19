"use client";

import { useState, useEffect } from "react";
import { collection, query, onSnapshot, orderBy, doc, updateDoc, deleteDoc, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export interface PrimeHistory {
  id: string;
  month: string; // ex: "Janvier 2025"
  date: Date;
  amount: number;
  status: "pending" | "validated" | "paid";
  userId?: string; // Pour savoir à qui appartient la prime (si individuel)
}

export function usePrimes() {
  const [primes, setPrimes] = useState<PrimeHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Écoute la collection "primes_history" en temps réel
    const q = query(collection(db, "primes_history"), orderBy("date", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
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
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Actions Admin
  const updatePrime = async (id: string, data: Partial<PrimeHistory>) => {
    try {
      await updateDoc(doc(db, "primes_history", id), data);
    } catch (error) {
      console.error("Erreur update:", error);
      throw error;
    }
  };

  const deletePrime = async (id: string) => {
    if(!confirm("Êtes-vous sûr de vouloir supprimer cet historique ?")) return;
    try {
      await deleteDoc(doc(db, "primes_history", id));
    } catch (error) {
      console.error("Erreur delete:", error);
      throw error;
    }
  };

  const addPrime = async (prime: Omit<PrimeHistory, "id">) => {
    try {
      await addDoc(collection(db, "primes_history"), {
        ...prime,
        date: Timestamp.fromDate(prime.date)
      });
    } catch (error) {
      console.error("Erreur add:", error);
      throw error;
    }
  }

  return { primes, loading, updatePrime, deletePrime, addPrime };
}

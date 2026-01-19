"use client";

import { useState, useEffect } from "react";
import { collection, query, onSnapshot, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Objective } from "@/lib/demo-data"; // On réutilise vos types existants

export function useObjectives() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On écoute la collection "objectives"
    const q = query(collection(db, "objectives"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Objective[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Conversion des dates Firestore (Timestamp) en dates JS
        const deadline = data.deadline?.toDate ? data.deadline.toDate() : new Date(data.deadline);
        
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

  return { objectives, loading };
}

import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase/client"

export async function logSystemAction(data: {
  userId: string
  userName: string
  userRole: string
  companyId: string
  companyName: string
  action: string
  details: string
}) {
  try {
    // On essaie de détecter l'appareil (optionnel mais sympa pour l'affichage)
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    let device = "Desktop"
    if (/Mobi|Android/i.test(userAgent)) device = "Mobile"
    else if (/iPad|Tablet/i.test(userAgent)) device = "Tablet"

    // 🔴 IMPORTANT : On écrit bien dans "system_logs"
    await addDoc(collection(db, "system_logs"), {
      ...data,
      device: device,
      // On utilise une date Texte (ISO) pour faciliter le tri sans index complexe
      timestamp: new Date().toISOString(), 
      // On ajoute aussi le format natif au cas où
      createdAt: serverTimestamp() 
    })
    
    console.log("✅ Log enregistré avec succès dans system_logs")
  } catch (error) {
    console.error("❌ ERREUR CRITIQUE lors de l'enregistrement du log:", error)
  }
}

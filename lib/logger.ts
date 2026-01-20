import { addDoc, collection } from "firebase/firestore"
import { db } from "@/lib/firebase/client"

export type LogAction = "LOGIN" | "CREATE" | "UPDATE" | "DELETE" | "NAVIGATE"

interface LogParams {
  userId: string
  userName: string
  userRole: string
  companyId: string
  companyName: string
  action: LogAction
  details: string
}

export const logSystemAction = async (params: LogParams) => {
  try {
    await addDoc(collection(db, "system_logs"), {
      ...params,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Erreur lors de l'enregistrement du log:", error)
  }
}

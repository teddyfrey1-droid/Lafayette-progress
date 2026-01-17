"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import {
  ArrowLeft,
  Search,
  UserPlus,
  Edit3,
  Check,
  Shield,
  Mail,
  Clock,
  Loader2,
  History,
  Activity,
  Calendar,
  AlertCircle
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import Link from "next/link"

// IMPORTS FIREBASE
import { db } from "@/lib/firebase/client"
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  where, 
  orderBy, 
  limit, 
  addDoc,
  serverTimestamp 
} from "firebase/firestore"
import { useAuth } from "@/components/auth/auth-provider"
import { useToast } from "@/hooks/use-toast"

// TYPES
interface UserData {
  id: string
  displayName: string
  email: string
  role: string
  contractHours: number
  status: "active" | "inactive" | "pending"
  lastLogin?: any // Timestamp Firestore ou Date
}

interface LogEntry {
  id: string
  action: string
  details: string
  timestamp: any
  performedBy?: string
}

export default function UtilisateursPage() {
  const { profile, user: currentUser } = useAuth()
  const { toast } = useToast()
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  
  // États pour l'édition et l'historique
  const [editingId, setEditingId] = useState<string | null>(null)
  const [historyUserId, setHistoryUserId] = useState<string | null>(null)

  // 1. DROITS D'ACCÈS
  const myRole = profile?.role || "employe"
  const canEdit = ["manager", "directeur", "gerant"].includes(myRole)

  // 2. RÉCUPÉRATION DES UTILISATEURS
  useEffect(() => {
    const q = query(collection(db, "users"))
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUsers: UserData[] = snapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          displayName: data.displayName || "Sans nom",
          email: data.email || "",
          role: data.role || "employe",
          contractHours: data.contractHours || 35,
          status: data.disabled ? "inactive" : "active",
          lastLogin: data.lastLogin,
        }
      })
      setUsers(fetchedUsers)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // 3. FONCTION DE MISE À JOUR + LOG
  const handleUpdateUser = async (targetUserId: string, newData: Partial<UserData>, oldData: UserData) => {
    try {
      // 1. Mise à jour de l'utilisateur
      const userRef = doc(db, "users", targetUserId)
      await updateDoc(userRef, newData)

      // 2. Création du log de modification (Ce qu'il a fait / Modification)
      let actionDetails = ""
      if (newData.role && newData.role !== oldData.role) {
        actionDetails += `Rôle changé de ${oldData.role} à ${newData.role}. `
      }
      if (newData.contractHours && newData.contractHours !== oldData.contractHours) {
        actionDetails += `Heures changées de ${oldData.contractHours}h à ${newData.contractHours}h.`
      }

      if (actionDetails) {
        await addDoc(collection(db, "logs"), {
          userId: targetUserId, // L'utilisateur qui a SUBI la modification
          action: "modification_compte",
          details: actionDetails,
          performedBy: profile?.displayName || currentUser?.email || "Admin", // Celui qui a FAIT la modif
          timestamp: serverTimestamp(),
          companyName: profile?.company || "Système"
        })
      }

      toast({
        title: "Modifications enregistrées",
        description: `Le profil de ${oldData.displayName} a été mis à jour avec succès.`,
        variant: "success",
      })

      setEditingId(null)
    } catch (error) {
      console.error("Erreur lors de la mise à jour :", error)
      toast({
        title: "Erreur",
        description: "Impossible de modifier l'utilisateur. Veuillez réessayer.",
        variant: "destructive",
      })
    }
  }

  // Filtrage
  const filteredUsers = users.filter(
    (user) =>
      user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Formatage Rôle
  const formatRole = (r: string) => {
    switch(r) {
      case "gerant": return "Gérant"
      case "directeur": return "Directeur"
      case "manager": return "Manager"
      case "assistant_manager": return "Assistant Manager"
      default: return "Employé"
    }
  }

  // Formatage Date
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Jamais"
    // Gestion Timestamp Firestore ou Date JS
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date)
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="px-4 py-6 max-w-4xl mx-auto space-y-6">
        <Link
          href="/parametres"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Paramètres</span>
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Utilisateurs</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {users.length} compte{users.length > 1 ? "s" : ""}
            </p>
          </div>
          <Button size="sm" className="rounded-xl gap-2" disabled>
            <UserPlus className="w-4 h-4" />
            Inviter
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>

        <section className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.id}
                className={cn(
                  "pulse-card overflow-hidden transition-all",
                  user.status === "inactive" && "opacity-60"
                )}
              >
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center shrink-0 text-white font-bold">
                      {user.displayName.substring(0, 2).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h3 className="font-semibold text-base truncate">{user.displayName}</h3>
                        {/* DATE DE DERNIÈRE CONNEXION */}
                        <div className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          {formatDate(user.lastLogin)}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          <Shield className="w-3 h-3" />
                          {formatRole(user.role)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {user.contractHours}h
                        </span>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {user.email}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1">
                      {canEdit && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-lg shrink-0"
                          onClick={() => setEditingId(editingId === user.id ? null : user.id)}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg shrink-0 text-muted-foreground"
                        onClick={() => setHistoryUserId(user.id)}
                      >
                        <History className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Panneau d'édition */}
                {editingId === user.id && (
                  <div className="p-4 pt-0 border-t border-border mt-4 bg-muted/20">
                    <UserEditPanel
                      user={user}
                      onSave={(newData) => handleUpdateUser(user.id, newData, user)}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      </main>

      {/* MODAL HISTORIQUE (Sheet) */}
      <Sheet open={!!historyUserId} onOpenChange={() => setHistoryUserId(null)}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl">
          <SheetHeader className="mb-4 text-left">
            <SheetTitle>Historique d'activité</SheetTitle>
            <SheetDescription>
              Actions et modifications concernant cet utilisateur.
            </SheetDescription>
          </SheetHeader>
          
          {historyUserId && <UserHistoryList userId={historyUserId} />}
        </SheetContent>
      </Sheet>

      <BottomNav />
    </div>
  )
}

// --- COMPOSANT ÉDITION ---
function UserEditPanel({
  user,
  onSave,
  onCancel,
}: {
  user: UserData
  onSave: (data: Partial<UserData>) => void
  onCancel: () => void
}) {
  const [role, setRole] = useState(user.role)
  const [contractHours, setContractHours] = useState(user.contractHours.toString())
  const [saving, setSaving] = useState(false)

  const handleSave = () => {
    setSaving(true)
    onSave({
      role,
      contractHours: parseInt(contractHours) || 35,
    })
  }

  return (
    <div className="space-y-4 pt-4">
      <h4 className="text-sm font-semibold">Modifier l'utilisateur</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground">Rôle</label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="rounded-xl bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="employe">Employé</SelectItem>
              <SelectItem value="assistant_manager">Assistant Manager</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="directeur">Directeur</SelectItem>
              <SelectItem value="gerant">Gérant</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground">Heures/semaine</label>
          <Input
            type="number"
            value={contractHours}
            onChange={(e) => setContractHours(e.target.value)}
            className="rounded-xl bg-background"
            min="1"
            max="60"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button className="flex-1 rounded-xl" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Check className="w-4 h-4 mr-2" />}
          Sauvegarder
        </Button>
        <Button variant="outline" className="flex-1 rounded-xl bg-transparent" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </div>
  )
}

// --- COMPOSANT LISTE HISTORIQUE ---
function UserHistoryList({ userId }: { userId: string }) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // On cherche les logs où l'utilisateur est concerné (userId)
    const q = query(
      collection(db, "logs"),
      where("userId", "==", userId),
      orderBy("timestamp", "desc"),
      limit(20)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LogEntry[]
      setLogs(fetchedLogs)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [userId])

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground space-y-2">
        <History className="w-8 h-8 opacity-20" />
        <p className="text-sm">Aucune activité enregistrée</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 overflow-y-auto h-full pb-10 pr-2">
      {logs.map((log) => (
        <div key={log.id} className="flex gap-3 text-sm">
          <div className="flex flex-col items-center">
            <div className={cn(
              "w-2 h-2 rounded-full mt-1.5",
              log.action === "login" ? "bg-emerald-500" : 
              log.action === "modification_compte" ? "bg-amber-500" : "bg-blue-500"
            )} />
            <div className="w-px h-full bg-border mt-1" />
          </div>
          <div className="pb-4 flex-1">
            <div className="flex justify-between items-start">
              <p className="font-medium">
                {log.action === "login" ? "Connexion" : 
                 log.action === "modification_compte" ? "Modification du compte" : log.action}
              </p>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleDateString("fr-FR", {
                  day: "numeric", month: "short", hour:"2-digit", minute:"2-digit"
                }) : "Date inconnue"}
              </span>
            </div>
            
            {log.details && (
              <p className="text-xs text-muted-foreground mt-1 bg-muted/30 p-2 rounded-lg">
                {log.details}
              </p>
            )}
            
            {log.performedBy && log.action === "modification_compte" && (
              <p className="text-[10px] text-muted-foreground mt-1 italic">
                Modifié par : {log.performedBy}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

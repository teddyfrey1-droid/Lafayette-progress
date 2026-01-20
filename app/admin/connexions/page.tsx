"use client"

import { useState, useEffect, useMemo } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { 
  Shield, Search, Building2, User, Clock, 
  ChevronDown, ChevronRight, Activity, LogIn, 
  FileEdit, Trash2, MousePointerClick
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

// Imports Firebase
import { collection, query, orderBy, limit, onSnapshot, where } from "firebase/firestore"
import { db } from "@/lib/firebase/client"

// --- TYPES ---

interface LogEntry {
  id: string
  userId: string
  userName: string
  userRole: string
  companyId: string
  companyName: string
  action: "LOGIN" | "CREATE" | "UPDATE" | "DELETE" | "NAVIGATE"
  details: string
  timestamp: string // ISO string
}

// Structure de données groupées
interface GroupedUser {
  userId: string
  userName: string
  userRole: string
  lastActive: string
  logs: LogEntry[]
}

interface GroupedCompany {
  companyId: string
  companyName: string
  lastActive: string
  users: GroupedUser[]
}

export default function ConnectionControlCenter() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedCompanies, setExpandedCompanies] = useState<string[]>([])
  const [expandedUsers, setExpandedUsers] = useState<string[]>([])

  // 1. Récupération des logs (Temps réel)
  useEffect(() => {
    // On récupère les 500 derniers logs pour ne pas surcharger
    const q = query(collection(db, "system_logs"), orderBy("timestamp", "desc"), limit(500))
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LogEntry[]
      setLogs(fetchedLogs)
    })

    return () => unsubscribe()
  }, [])

  // 2. Traitement et Groupement des données
  const structuredData = useMemo(() => {
    const companiesMap: Record<string, GroupedCompany> = {}

    logs.forEach(log => {
      // Filtre de recherche
      if (searchQuery && 
          !log.companyName.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !log.userName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return
      }

      // Init Entreprise si n'existe pas
      if (!companiesMap[log.companyId]) {
        companiesMap[log.companyId] = {
          companyId: log.companyId,
          companyName: log.companyName || "Entreprise Inconnue",
          lastActive: log.timestamp, // Sera écrasé par le plus récent car logs triés desc
          users: []
        }
      }

      // Trouver ou créer l'utilisateur dans l'entreprise
      let userGroup = companiesMap[log.companyId].users.find(u => u.userId === log.userId)
      
      if (!userGroup) {
        userGroup = {
          userId: log.userId,
          userName: log.userName || "Utilisateur Inconnu",
          userRole: log.userRole,
          lastActive: log.timestamp,
          logs: []
        }
        companiesMap[log.companyId].users.push(userGroup)
      }

      // Ajouter le log à l'utilisateur
      userGroup.logs.push(log)
    })

    // Conversion en tableau et Tri
    const sortedCompanies = Object.values(companiesMap).sort((a, b) => 
      new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
    )

    return sortedCompanies
  }, [logs, searchQuery])

  // --- Helpers d'affichage ---

  const toggleCompany = (id: string) => {
    setExpandedCompanies(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  const toggleUser = (id: string) => {
    setExpandedUsers(prev => prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id])
  }

  const getActionIcon = (action: string) => {
    switch(action) {
      case "LOGIN": return <LogIn className="w-4 h-4 text-green-500" />
      case "CREATE": return <Activity className="w-4 h-4 text-blue-500" />
      case "UPDATE": return <FileEdit className="w-4 h-4 text-amber-500" />
      case "DELETE": return <Trash2 className="w-4 h-4 text-red-500" />
      default: return <MousePointerClick className="w-4 h-4 text-gray-500" />
    }
  }

  const getActionColor = (action: string) => {
    switch(action) {
      case "LOGIN": return "bg-green-500/10 text-green-600 border-green-500/20"
      case "CREATE": return "bg-blue-500/10 text-blue-600 border-blue-500/20"
      case "UPDATE": return "bg-amber-500/10 text-amber-600 border-amber-500/20"
      case "DELETE": return "bg-red-500/10 text-red-600 border-red-500/20"
      default: return "bg-gray-500/10 text-gray-600 border-gray-500/20"
    }
  }

  return (
    <PermissionGate moduleId="admin" redirect>
      <div className="min-h-screen bg-background pb-32">
        <Header />
        
        <main className="px-4 py-6 max-w-4xl mx-auto space-y-6">
          
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Centre de Contrôle</h1>
              <p className="text-sm text-muted-foreground">Traçabilité des accès et actions par entreprise</p>
            </div>
          </div>

          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Rechercher une entreprise, un utilisateur..." 
              className="pl-10 bg-card"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Liste Principale */}
          <div className="space-y-4">
            {structuredData.map((company) => {
              const isExpanded = expandedCompanies.includes(company.companyId)
              
              return (
                <div key={company.companyId} className="border border-border rounded-xl bg-card overflow-hidden shadow-sm transition-all">
                  
                  {/* Niveau 1 : Entreprise */}
                  <div 
                    onClick={() => toggleCompany(company.companyId)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{company.companyName}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Dernière activité : {format(new Date(company.lastActive), "d MMM HH:mm", { locale: fr })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{company.users.length} Utilisateurs</Badge>
                      {isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Niveau 2 : Utilisateurs (Menu Déroulant) */}
                  {isExpanded && (
                    <div className="bg-muted/20 border-t border-border p-2 space-y-2">
                      {company.users.map((user) => {
                        const isUserExpanded = expandedUsers.includes(user.userId)
                        
                        return (
                          <div key={user.userId} className="ml-2 mr-2 border border-border/50 rounded-lg bg-background overflow-hidden">
                            <div 
                              onClick={() => toggleUser(user.userId)}
                              className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/30"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                  {user.userName.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-sm">{user.userName}</p>
                                  <p className="text-[10px] text-muted-foreground uppercase">{user.userRole}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground hidden sm:inline">Dernière: {format(new Date(user.lastActive), "HH:mm")}</span>
                                {isUserExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </div>
                            </div>

                            {/* Niveau 3 : Logs / Actions */}
                            {isUserExpanded && (
                              <ScrollArea className="h-[300px] bg-muted/10 border-t border-border/50">
                                <div className="p-2 space-y-2">
                                  {user.logs.map((log) => (
                                    <div key={log.id} className="flex gap-3 items-start p-2 rounded hover:bg-muted/50 text-sm">
                                      <div className="mt-0.5 min-w-[60px] text-xs text-muted-foreground font-mono">
                                        {format(new Date(log.timestamp), "HH:mm")}
                                        <div className="text-[10px] opacity-70">{format(new Date(log.timestamp), "dd/MM")}</div>
                                      </div>
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 gap-1", getActionColor(log.action))}>
                                            {getActionIcon(log.action)}
                                            {log.action}
                                          </Badge>
                                        </div>
                                        <p className="text-sm text-foreground/80">{log.details}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {structuredData.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Aucune activité enregistrée pour le moment.</p>
              </div>
            )}
          </div>

        </main>
        <BottomNav />
      </div>
    </PermissionGate>
  )
}

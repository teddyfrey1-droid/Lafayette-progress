"use client"

import { useState, useEffect, useMemo } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { 
  Shield, Search, Building2, ChevronDown, ChevronRight, 
  LogIn, Activity, FileEdit, Trash2, MousePointerClick, Clock
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

// Firebase
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore"
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
  timestamp: string
}

export default function ConnectionControlCenter() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  
  // États pour les menus déroulants (Accordéons)
  const [openCompanies, setOpenCompanies] = useState<string[]>([])
  const [openUsers, setOpenUsers] = useState<string[]>([])

  // 1. Récupération des logs en temps réel
  useEffect(() => {
    // On prend les 200 derniers événements pour garder l'app fluide
    const q = query(collection(db, "system_logs"), orderBy("timestamp", "desc"), limit(200))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LogEntry)))
    })
    return () => unsubscribe()
  }, [])

  // 2. Structuration des données (Algorithme de regroupement)
  const groupedData = useMemo(() => {
    const companies: Record<string, any> = {}

    logs.forEach(log => {
      // Filtre de recherche
      if (searchQuery && !log.companyName.toLowerCase().includes(searchQuery.toLowerCase()) && !log.userName.toLowerCase().includes(searchQuery.toLowerCase())) return

      // Création Entreprise si inexistante
      if (!companies[log.companyId]) {
        companies[log.companyId] = {
          id: log.companyId,
          name: log.companyName || "Entreprise Inconnue",
          lastActive: log.timestamp,
          users: {}
        }
      }

      // Mise à jour date dernière activité entreprise
      if (new Date(log.timestamp) > new Date(companies[log.companyId].lastActive)) {
        companies[log.companyId].lastActive = log.timestamp
      }

      // Création Utilisateur si inexistant
      if (!companies[log.companyId].users[log.userId]) {
        companies[log.companyId].users[log.userId] = {
          id: log.userId,
          name: log.userName || "Inconnu",
          role: log.userRole,
          lastActive: log.timestamp,
          logs: []
        }
      }

      // Ajout du log à l'utilisateur
      companies[log.companyId].users[log.userId].logs.push(log)
    })

    // Conversion en tableau trié par date
    return Object.values(companies)
      .sort((a: any, b: any) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime())
      .map((company: any) => ({
        ...company,
        users: Object.values(company.users).sort((a: any, b: any) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime())
      }))
  }, [logs, searchQuery])

  // --- Gestionnaires d'ouverture ---
  const toggleCompany = (id: string) => setOpenCompanies(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  const toggleUser = (id: string) => setOpenUsers(prev => prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id])

  // --- Visuels ---
  const getActionIcon = (action: string) => {
    switch(action) {
      case "LOGIN": return <LogIn className="w-3.5 h-3.5" />
      case "CREATE": return <Activity className="w-3.5 h-3.5" />
      case "DELETE": return <Trash2 className="w-3.5 h-3.5" />
      case "UPDATE": return <FileEdit className="w-3.5 h-3.5" />
      default: return <MousePointerClick className="w-3.5 h-3.5" />
    }
  }

  const getActionColor = (action: string) => {
    switch(action) {
      case "LOGIN": return "text-green-500 bg-green-500/10 border-green-500/20"
      case "CREATE": return "text-blue-500 bg-blue-500/10 border-blue-500/20"
      case "DELETE": return "text-red-500 bg-red-500/10 border-red-500/20"
      case "UPDATE": return "text-amber-500 bg-amber-500/10 border-amber-500/20"
      default: return "text-gray-500 bg-gray-500/10 border-gray-500/20"
    }
  }

  return (
    <PermissionGate moduleId="admin" redirect>
      <div className="min-h-screen bg-background pb-32">
        <Header />
        
        <main className="px-4 py-6 max-w-3xl mx-auto space-y-6">
          {/* Titre */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Centre de Contrôle</h1>
              <p className="text-xs text-muted-foreground">Traçabilité des accès en temps réel</p>
            </div>
          </div>

          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Filtrer par entreprise ou nom..." 
              className="pl-10 bg-card rounded-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Liste Principale */}
          <div className="space-y-3">
            {groupedData.map((company: any) => {
              const isOpen = openCompanies.includes(company.id)
              return (
                <div key={company.id} className="bg-card border border-border rounded-xl overflow-hidden transition-all duration-200">
                  
                  {/* Niveau 1 : ENTREPRISE */}
                  <div 
                    onClick={() => toggleCompany(company.id)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm">{company.name}</h3>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {format(new Date(company.lastActive), "d MMM HH:mm", { locale: fr })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-[10px] h-5">{company.users.length} Utilisateurs</Badge>
                      {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Niveau 2 : UTILISATEURS (Déroulé) */}
                  {isOpen && (
                    <div className="bg-muted/20 border-t border-border p-2 space-y-2">
                      {company.users.map((user: any) => {
                        const isUserOpen = openUsers.includes(user.id)
                        return (
                          <div key={user.id} className="bg-background border border-border/50 rounded-lg overflow-hidden">
                            
                            <div 
                              onClick={() => toggleUser(user.id)}
                              className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/30"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-600 flex items-center justify-center text-xs font-bold border border-purple-500/30">
                                  {user.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs font-semibold">{user.name}</span>
                                  <span className="text-[9px] text-muted-foreground uppercase">{user.role}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {user.logs.some((l: LogEntry) => l.action === 'LOGIN') && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
                                {isUserOpen ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                              </div>
                            </div>

                            {/* Niveau 3 : LOGS (Déroulé) */}
                            {isUserOpen && (
                              <ScrollArea className="h-48 border-t border-border/40 bg-muted/5">
                                <div className="p-2 space-y-1">
                                  {user.logs.map((log: LogEntry) => (
                                    <div key={log.id} className="flex gap-3 p-2 rounded hover:bg-white/50 text-xs">
                                      <div className="min-w-[40px] text-[10px] text-muted-foreground font-mono pt-0.5">
                                        {format(new Date(log.timestamp), "HH:mm")}
                                      </div>
                                      <div className="flex-1 space-y-1">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className={`h-5 px-1.5 gap-1 text-[9px] font-bold ${getActionColor(log.action)}`}>
                                            {getActionIcon(log.action)}
                                            {log.action}
                                          </Badge>
                                        </div>
                                        <p className="text-muted-foreground leading-snug">{log.details}</p>
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

            {groupedData.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Aucune activité récente trouvée.
              </div>
            )}
          </div>
        </main>
        
        <BottomNav />
      </div>
    </PermissionGate>
  )
}

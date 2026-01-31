"use client"

import { useState, useEffect, useMemo } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { 
  Shield, Search, Building2, User, Clock, 
  Activity, LogIn, LogOut, FileEdit, Trash2, MousePointerClick,
  Laptop, Smartphone, MapPin, Zap, CalendarDays
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import { format, formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"

// Imports Firebase
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase/client"

// --- TYPES ---

interface SessionEntry {
  id: string
  userId: string
  userName: string
  userRole: string
  companyId: string
  companyName: string
  startedAt: string
  endedAt: string | null
  durationSec?: number | null
  device?: string
  ip?: string | null
}

interface LogEntry {
  id: string
  userId: string
  userName: string
  userRole: string
  companyId: string
  companyName: string
  action: "LOGIN" | "CREATE" | "UPDATE" | "DELETE" | "NAVIGATE" | string
  details: string
  device?: string
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
  const [sessions, setSessions] = useState<SessionEntry[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  // On gère l'ouverture des utilisateurs individuellement
  const [expandedUserIds, setExpandedUserIds] = useState<string[]>([])

  // 1. Récupération des logs (Temps réel - 500 derniers)
  useEffect(() => {
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


  // 1bis. Récupération des sessions (connexions + durée)
  useEffect(() => {
    const q = query(collection(db, "user_sessions"), orderBy("startedAt", "desc"), limit(1500))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SessionEntry[]
      setSessions(fetched)
    })

    return () => unsubscribe()
  }, [])

  // 2. Traitement et Groupement des données
  const { sortedCompanies, stats } = useMemo(() => {
    const companiesMap: Record<string, GroupedCompany> = {}
    let activeToday = 0;
    
    // Set pour compter les users uniques aujourd'hui
    const uniqueUsersToday = new Set();
    const todayStr = new Date().toDateString();

    logs.forEach(log => {
      const logDate = new Date(log.timestamp);
      if (logDate.toDateString() === todayStr) {
          uniqueUsersToday.add(log.userId);
      }

      // Filtre de recherche
      if (searchQuery && 
          !log.companyName.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !log.userName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return
      }

      // Init Entreprise
      if (!companiesMap[log.companyId]) {
        companiesMap[log.companyId] = {
          companyId: log.companyId,
          companyName: log.companyName || "Entreprise Inconnue",
          lastActive: log.timestamp,
          users: []
        }
      }

      // Init Utilisateur dans l'entreprise
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

      userGroup.logs.push(log)
    })

    // Tri des entreprises par activité récente
    const sorted = Object.values(companiesMap).sort((a, b) => 
      new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
    )

    // Tri des utilisateurs dans chaque entreprise
    sorted.forEach(company => {
        company.users.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime())
    })

    return { 
        sortedCompanies: sorted,
        stats: {
            totalLogs: logs.length,
            activeUsers24h: uniqueUsersToday.size,
            lastActivity: logs[0]?.timestamp || null
        }
    }
  }, [logs, searchQuery])

  
  const sessionsByUserKey = useMemo(() => {
    const map: Record<string, SessionEntry[]> = {}
    sessions.forEach((s) => {
      const key = `${s.companyId || "unknown"}::${s.userId}`
      if (!map[key]) map[key] = []
      map[key].push(s)
    })
    // Ensure sessions are sorted by startedAt desc
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    })
    return map
  }, [sessions])

  const formatDuration = (sec?: number | null) => {
    if (sec == null) return "—"
    const m = Math.round(sec / 60)
    if (m < 60) return `${m} min`
    const h = Math.floor(m / 60)
    const rm = m % 60
    return `${h}h${rm.toString().padStart(2, "0")}`
  }

// --- Helpers d'affichage ---

  const toggleUser = (userId: string) => {
      setExpandedUserIds(prev => 
        prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
      )
  }

  const getActionIcon = (action: string) => {
    const a = action.toUpperCase();
    if (a.includes("LOGIN")) return <LogIn className="w-3.5 h-3.5" />
    if (a.includes("LOGOUT")) return <LogOut className="w-3.5 h-3.5" />
    if (a.includes("CREATE")) return <Zap className="w-3.5 h-3.5" />
    if (a.includes("UPDATE")) return <FileEdit className="w-3.5 h-3.5" />
    if (a.includes("DELETE")) return <Trash2 className="w-3.5 h-3.5" />
    return <MousePointerClick className="w-3.5 h-3.5" />
  }

  const getActionStyle = (action: string) => {
    const a = action.toUpperCase();
    if (a.includes("LOGIN")) return "bg-emerald-500/10 text-emerald-600 border-emerald-200"
    if (a.includes("LOGOUT")) return "bg-red-500/10 text-red-600 border-red-200"
    if (a.includes("CREATE")) return "bg-blue-500/10 text-blue-600 border-blue-200"
    if (a.includes("UPDATE")) return "bg-amber-500/10 text-amber-600 border-amber-200"
    if (a.includes("DELETE")) return "bg-red-500/10 text-red-600 border-red-200"
    return "bg-slate-100 text-slate-600 border-slate-200"
  }

  return (
    <PermissionGate moduleId="admin" redirect>
      <div className="min-h-screen bg-background pb-32">
        <Header />
        
        <main className="px-4 py-6 max-w-5xl mx-auto space-y-8">
          
          {/* Header Dashboard */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                <h1 className="text-2xl font-bold tracking-tight">Centre de Contrôle</h1>
                <p className="text-sm text-muted-foreground">Surveillance des accès en temps réel</p>
                </div>
            </div>
            
            {/* Barre de recherche */}
            <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                placeholder="Chercher une entreprise, un user..." 
                className="pl-10 bg-card/50 backdrop-blur-sm border-indigo-100/50 focus:border-indigo-500 rounded-xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
          </div>

          {/* 📊 Cartes Statistiques (Le côté Ludique) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="pulse-card p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
                  <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-600"><User className="w-5 h-5"/></div>
                      <span className="text-sm font-medium text-emerald-900/70 dark:text-emerald-100/70">Actifs (24h)</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{stats.activeUsers24h} Utilisateurs</p>
              </div>

              <div className="pulse-card p-4 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
                  <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-blue-500/20 rounded-lg text-blue-600"><Activity className="w-5 h-5"/></div>
                      <span className="text-sm font-medium text-blue-900/70 dark:text-blue-100/70">Total Logs</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{stats.totalLogs} Événements</p>
              </div>

              <div className="pulse-card p-4 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
                  <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-purple-500/20 rounded-lg text-purple-600"><Clock className="w-5 h-5"/></div>
                      <span className="text-sm font-medium text-purple-900/70 dark:text-purple-100/70">Dernière Activité</span>
                  </div>
                  <p className="text-lg font-bold text-purple-700 dark:text-purple-400 truncate">
                      {stats.lastActivity ? formatDistanceToNow(new Date(stats.lastActivity), { addSuffix: true, locale: fr }) : "Aucune"}
                  </p>
              </div>
          </div>

          {/* Liste Principale : Accordéon par Entreprise */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider ml-1">Flux d'activité par Structure</h2>
            
            <Accordion type="multiple" className="space-y-4">
            {sortedCompanies.map((company) => (
                <AccordionItem 
                    key={company.companyId} 
                    value={company.companyId} 
                    className="border border-border/60 rounded-2xl bg-card shadow-sm overflow-hidden"
                >
                  <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4 w-full">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="text-left flex-1">
                        <h3 className="font-bold text-lg leading-none">{company.companyName}</h3>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                           {company.users.length} collaborateurs • <span className="text-indigo-500">Actif {formatDistanceToNow(new Date(company.lastActive), { addSuffix: true, locale: fr })}</span>
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="px-0 pb-0 bg-muted/20 border-t border-border/50">
                    <div className="p-3 grid gap-3">
                      {company.users.map((user) => {
                        const isExpanded = expandedUserIds.includes(user.userId)
                        const sessions = sessionsByUserKey[`${company.companyId}::${user.userId}`] || []
                        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
                        const totalSec7d = sessions.reduce((acc: number, s: any) => {
                          const t = new Date(s.startedAt).getTime()
                          if (!Number.isFinite(t)) return acc
                          if (t < sevenDaysAgo) return acc
                          const d = typeof s.durationSec === "number" ? s.durationSec : 0
                          return acc + d
                        }, 0)

                        return (
                          <div key={user.userId} className={cn("rounded-xl border transition-all duration-300 overflow-hidden bg-background", isExpanded ? "border-indigo-200 shadow-md" : "border-transparent shadow-sm")}>
                            
                            {/* En-tête Utilisateur */}
                            <div 
                              onClick={() => toggleUser(user.userId)}
                              className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50"
                            >
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold border border-slate-300">
                                    {user.userName.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-sm">{user.userName}</p>
                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground">{user.userRole}</Badge>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground">
                                    {user.logs.length} actions • Dernier: {format(new Date(user.lastActive), "HH:mm")}
                                  </p>
                                </div>
                              </div>
                              <div className={cn("w-8 h-8 flex items-center justify-center rounded-full transition-transform bg-muted/50", isExpanded && "rotate-180 bg-indigo-50 text-indigo-600")}>
                                <Shield className="w-4 h-4" />
                              </div>
                            </div>

                            {/* Timeline des Logs */}
                            {isExpanded && (
                              <div className="bg-slate-50/50 dark:bg-slate-900/50 p-4 border-t border-border/50">
                                {/* Sessions */}
                                <div className="mb-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dernières connexions</p>
                                    <p className="text-[10px] text-muted-foreground">7j: {formatDuration(totalSec7d)} • {sessions.length} sessions</p>
                                  </div>
                                  <div className="space-y-2">
                                    {sessions.slice(0, 8).map((s) => (
                                      <div key={s.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-white/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
                                        <div className="min-w-0">
                                          <p className="text-xs font-semibold truncate">{format(new Date(s.startedAt), "dd MMM • HH:mm", { locale: fr })} → {s.endedAt ? format(new Date(s.endedAt), "HH:mm", { locale: fr }) : "En cours"}</p>
                                          <p className="text-[10px] text-muted-foreground truncate">{s.device || ""}{s.ip ? ` • ${s.ip}` : ""}</p>
                                        </div>
                                        <Badge variant="outline" className="text-[10px] h-5">{s.endedAt ? formatDuration(s.durationSec) : "…"}</Badge>
                                      </div>
                                    ))}
                                    {sessions.length === 0 && (
                                      <div className="text-xs text-muted-foreground italic">Aucune session enregistrée.</div>
                                    )}
                                  </div>
                                </div>

                                {/* Timeline des Logs */}
                                <div className="relative pl-4 space-y-6">
                                    {/* Ligne verticale de timeline */}
                                    <div className="absolute left-[21px] top-2 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-800" />

                                    {user.logs.map((log, index) => (
                                        <div key={log.id} className="relative flex gap-4 items-start group">
                                            {/* Point sur la timeline */}
                                            <div className="z-10 w-3 h-3 rounded-full bg-white border-2 border-indigo-400 mt-1.5 shrink-0 group-hover:scale-125 transition-transform shadow-sm" />
                                            
                                            <div className="flex-1 min-w-0 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex justify-between items-start mb-1">
                                                    <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 gap-1.5 border font-bold", getActionStyle(log.action))}>
                                                        {getActionIcon(log.action)}
                                                        {log.action}
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground font-mono bg-muted/50 px-1.5 rounded">
                                                        {format(new Date(log.timestamp), "HH:mm:ss")}
                                                    </span>
                                                </div>
                                                
                                                <p className="text-sm text-foreground/90 leading-snug">{log.details}</p>
                                                
                                                <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                                                    {log.device && (
                                                        <span className="flex items-center gap-1">
                                                            {log.device.toLowerCase().includes("mobile") ? <Smartphone className="w-3 h-3"/> : <Laptop className="w-3 h-3"/>}
                                                            {log.device}
                                                        </span>
                                                    )}
                                                    <span className="flex items-center gap-1">
                                                        <CalendarDays className="w-3 h-3"/>
                                                        {format(new Date(log.timestamp), "dd MMM yyyy", { locale: fr })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {sortedCompanies.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-card rounded-2xl border border-dashed">
                <Activity className="w-12 h-12 mb-3 opacity-20" />
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

"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { formatDistanceToNow, format } from "date-fns"
import { fr } from "date-fns/locale"

// --- IMPORTS UI & ICONS ---
import {
  Shield, Users, Search, Building2, ChevronRight, Edit3, CheckCircle2,
  XCircle, Activity, TrendingUp, LogIn, LogOut, Monitor, Smartphone, MapPin,
  Calendar, Mail, Phone, ArrowLeft, Settings, History, BarChart3, Globe,
  Truck, Target, Coins, FileText, Plus, Trash2, Briefcase, AlertCircle,
  ClipboardList, Bell,
  PieChart, UserX, MoreHorizontal, ChevronDown, KeyRound, Send, Loader2,
  User, Lock, Save, X, Clock, FileEdit, Zap, MousePointerClick, CalendarDays, Laptop, UserPlus
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"

// --- IMPORTS COMPOSANTS APP ---
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { normalizeCompanyModuleId } from "@/lib/company-modules-config"

// --- IMPORTS FIREBASE ---
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, deleteDoc, serverTimestamp, limit } from "firebase/firestore"
import { signInWithCustomToken, signOut } from "firebase/auth"
import { db, auth } from "@/lib/firebase/client"

// --- TYPES ---

interface CompanyFeature {
  id: string
  name: string
  description: string
  icon: any
  enabled: boolean
  isDefault: boolean
}

interface Company {
  id: string
  name: string
  logo: string
  plan: "starter" | "pro" | "enterprise"
  status: "active" | "suspended" | "trial"
  usersCount: number
  createdAt: string
  lastActivity: string
  industry: string
  contactEmail: string
  contactPhone: string
  features: CompanyFeature[]
}

interface User {
  id: string
  name: string
  firstName?: string
  lastName?: string
  email: string
  avatar: string
  role: "employe" | "assistant_manager" | "manager" | "directeur" | "gerant" | "admin" | "super_admin"
  companyId: string
  companyName: string
  contractHours?: number
  status: "active" | "inactive" | "suspended"
  lastLogin: any
  createdAt: string
}

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
  action: string
  details: string
  timestamp: string
  device?: string
  ip?: string
}

interface GroupedCompanyLog {
  companyId: string
  companyName: string
  lastActive: string
  users: {
    userId: string
    userName: string
    userRole: string
    lastActive: string
    logs: LogEntry[]
  }[]
}

// --- CONFIGURATION ---

const defaultFeatures: Omit<CompanyFeature, "enabled">[] = [
  // ✅ IDs alignés avec les moduleId du système de permissions
  { id: "sites", name: "Sites & Contacts", description: "Raccourcis et contacts utiles", icon: Globe, isDefault: true },
  { id: "fournisseurs", name: "Fournisseurs", description: "Gestion des contacts fournisseurs", icon: Truck, isDefault: true },
  { id: "objectifs", name: "Objectifs", description: "Suivi des objectifs et paliers", icon: Target, isDefault: true },
  { id: "primes", name: "Primes", description: "Historique et calcul des primes", icon: Coins, isDefault: true },
  { id: "equipes", name: "Équipes", description: "Gestion des collaborateurs", icon: Users, isDefault: true },
  { id: "diffusion", name: "Relevés température", description: "Suivi des températures frigos", icon: FileText, isDefault: false },
  { id: "gestion", name: "Hub de Gestion", description: "Hub de gestion & opérations", icon: ClipboardList, isDefault: true },
  { id: "pilotage", name: "Pilotage", description: "Pilotage & simulateur", icon: BarChart3, isDefault: false },
  { id: "parametres", name: "Paramètres", description: "Paramètres et utilisateurs", icon: Settings, isDefault: false },
  { id: "notifications", name: "Notifications", description: "Centre de notifications", icon: Bell, isDefault: true },
]

type TabType = "overview" | "companies" | "users" | "logs"

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function CentreControlePage() {
  return (
    <PermissionGate moduleId="centre_controle" redirect>
      <CentreControlePageContent />
    </PermissionGate>
  )
}

function CentreControlePageContent() {
  const { toast } = useToast()
  const router = useRouter()
  
  // --- ÉTATS ---
  const [activeTab, setActiveTab] = useState<TabType>("logs")
  const [searchQuery, setSearchQuery] = useState("")
  
  // États de sélection
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  
  // États des tiroirs (Drawers)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [invitingToCompany, setInvitingToCompany] = useState<Company | null>(null)
  
  // États UI divers
  const [isAddCompanyOpen, setIsAddCompanyOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isCompanySelectorOpen, setIsCompanySelectorOpen] = useState(false)
  const [companySearchQuery, setCompanySearchQuery] = useState("")
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [expandedUserIds, setExpandedUserIds] = useState<string[]>([])

  // Données Firebase
  const [companiesState, setCompaniesState] = useState<Company[]>([])
  const [usersState, setUsersState] = useState<User[]>([])
  const [logsState, setLogsState] = useState<LogEntry[]>([])
  const [sessionsState, setSessionsState] = useState<SessionEntry[]>([])

  // Formulaire Création Entreprise
  const [newCompany, setNewCompany] = useState({
    name: "",
    industry: "",
    plan: "starter",
    status: "active",
    contactEmail: ""
  })

  // --- LOGIQUE DE TRI & FILTRE ---

  const groupedLogs = useMemo(() => {
    const companiesMap: Record<string, GroupedCompanyLog> = {}
    
    logsState.forEach(log => {
      if (searchQuery && activeTab === "logs" &&
          !log.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !log.userName?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return
      }

      const cId = log.companyId || "unknown"
      if (!companiesMap[cId]) {
        companiesMap[cId] = {
          companyId: cId,
          companyName: log.companyName || "Entreprise Inconnue",
          lastActive: log.timestamp,
          users: []
        }
      }

      let userGroup = companiesMap[cId].users.find(u => u.userId === log.userId)
      if (!userGroup) {
        userGroup = {
          userId: log.userId,
          userName: log.userName || "Utilisateur Inconnu",
          userRole: log.userRole,
          lastActive: log.timestamp,
          logs: []
        }
        companiesMap[cId].users.push(userGroup)
      }
      userGroup.logs.push(log)
    })

    const sorted = Object.values(companiesMap).sort((a, b) => 
      new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
    )

    sorted.forEach(company => {
        company.users.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime())
    })

    return sorted
  }, [logsState, searchQuery, activeTab])


  const sessionsByUserKey = useMemo(() => {
    const map: Record<string, SessionEntry[]> = {}
    sessionsState.forEach((s) => {
      const key = `${s.companyId || "unknown"}::${s.userId}`
      if (!map[key]) map[key] = []
      map[key].push(s)
    })
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    })
    return map
  }, [sessionsState])

  const formatDuration = (sec?: number | null) => {
    if (sec == null) return "—"
    const m = Math.round(sec / 60)
    if (m < 60) return `${m} min`
    const h = Math.floor(m / 60)
    const rm = m % 60
    return `${h}h${rm.toString().padStart(2, "0")}`
  }

  // --- HELPERS ---

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20">Actif</Badge>
      case "trial": return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 hover:bg-blue-500/20">Essai</Badge>
      case "suspended": return <Badge className="bg-red-500/10 text-red-600 border-red-200 hover:bg-red-500/20">Suspendu</Badge>
      default: return <Badge variant="secondary">Inactif</Badge>
    }
  }

  const getActionIcon = (action: string) => {
    const a = (action || "").toUpperCase();
    if (a.includes("LOGIN")) return <LogIn className="w-3.5 h-3.5" />
    if (a.includes("LOGOUT")) return <LogOut className="w-3.5 h-3.5" />
    if (a.includes("CREATE")) return <Zap className="w-3.5 h-3.5" />
    if (a.includes("UPDATE")) return <FileEdit className="w-3.5 h-3.5" />
    if (a.includes("DELETE")) return <Trash2 className="w-3.5 h-3.5" />
    return <MousePointerClick className="w-3.5 h-3.5" />
  }

  const getActionStyle = (action: string) => {
    const a = (action || "").toUpperCase();
    if (a.includes("LOGIN")) return "bg-emerald-500/10 text-emerald-600 border-emerald-200"
    if (a.includes("LOGOUT")) return "bg-red-500/10 text-red-600 border-red-200"
    if (a.includes("CREATE")) return "bg-blue-500/10 text-blue-600 border-blue-200"
    if (a.includes("UPDATE")) return "bg-amber-500/10 text-amber-600 border-amber-200"
    if (a.includes("DELETE")) return "bg-red-500/10 text-red-600 border-red-200"
    return "bg-slate-100 text-slate-600 border-slate-200"
  }

  // --- ACTIONS ---

  const handleFullUpdateUser = async (formData: any) => {
    try {
        const res = await fetch("/api/admin/invite-user", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid: editingUser?.id, ...formData }),
        });
        if (!res.ok) throw new Error("Erreur API");
        setEditingUser(null);
        toast({ title: "Utilisateur mis à jour", variant: "success" });
    } catch (error) {
        toast({ title: "Erreur", description: "Échec de la mise à jour.", variant: "destructive" });
    }
  };

  const handleImpersonate = async (uid: string) => {
    if (!confirm("⚠️ Vous allez être connecté en tant que cet utilisateur.")) return;
    try {
        const res = await fetch("/api/admin/user-actions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "impersonate", uid })
        });
        const data = await res.json();
        if (data.success && data.token) {
            await signOut(auth);
            await signInWithCustomToken(auth, data.token);
            router.push("/dashboard"); 
            toast({ title: "Connexion réussie", description: "Vous êtes connecté sur le compte utilisateur." });
        } else {
            throw new Error(data.error);
        }
    } catch (e: any) {
        toast({ title: "Erreur", description: "Impossible de se connecter.", variant: "destructive" });
    }
  }

  const handleSendResetEmail = async (email: string, name: string) => {
    if (!email) return;
    try {
        await fetch("/api/admin/user-actions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reset_password", email, name })
        });
        toast({ title: "Email envoyé", description: `Lien envoyé à ${email}.`, variant: "success" });
    } catch (e) {
        toast({ title: "Erreur", variant: "destructive" });
    }
  }

  const handleCreateCompany = async () => {
    try {
      await addDoc(collection(db, "companies"), {
        ...newCompany,
        logo: newCompany.name.substring(0, 2).toUpperCase(),
        usersCount: 0,
        createdAt: serverTimestamp(),
        features: defaultFeatures.map(f => ({ id: f.id, enabled: f.isDefault }))
      })
      setIsAddCompanyOpen(false)
      setNewCompany({ name: "", industry: "", plan: "starter", status: "active", contactEmail: "" })
      toast({ title: "Entreprise créée", variant: "success" })
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleUpdateCompany = async (companyId: string, data: Partial<Company>) => {
    try {
      await updateDoc(doc(db, "companies", companyId), data)
      if (selectedCompany && selectedCompany.id === companyId) {
        setSelectedCompany({ ...selectedCompany, ...data })
      }
      setEditingCompany(null)
      toast({ title: "Mise à jour réussie", variant: "success" })
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleDeleteCompany = async () => {
    if (!selectedCompany) return
    try {
      await deleteDoc(doc(db, "companies", selectedCompany.id))
      setSelectedCompany(null)
      setIsDeleteConfirmOpen(false)
      toast({ title: "Entreprise supprimée" })
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleUpdateUserSimple = async (userId: string, data: any) => {
    try {
      if (data.companyId) {
        const targetCompany = companiesState.find(c => c.id === data.companyId)
        if (targetCompany) {
          data.companyName = targetCompany.name
          data.company = targetCompany.name
        } else if (data.companyId === "none") {
            data.companyId = ""
            data.companyName = "Non assigné"
            data.company = ""
        }
      }
      await updateDoc(doc(db, "users", userId), data)
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser({ ...selectedUser, ...data })
      }
      toast({ title: "Utilisateur mis à jour", variant: "success" })
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleDeleteUser = async (uid: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cet utilisateur définitivement ?")) return;
    try {
        await fetch(`/api/admin/invite-user?uid=${uid}`, { method: "DELETE" });
        if (selectedUser?.id === uid) setSelectedUser(null);
        toast({ title: "Utilisateur supprimé" });
    } catch (e) {
        toast({ title: "Erreur", variant: "destructive" });
    }
  }

  const toggleFeature = async (companyId: string, featureId: string, nextEnabled?: boolean) => {
  const company = companiesState.find((c) => c.id === companyId)
  if (!company) return

  // IMPORTANT: never persist non-serializable fields (like React icon components) to Firestore.
  const updatedFeatures = (company.features || []).map((f) =>
    f.id === featureId ? { ...f, enabled: typeof nextEnabled === "boolean" ? nextEnabled : !Boolean(f.enabled) } : f
  )

  const serializableFeatures = updatedFeatures.map((f) => ({
    id: String(f.id),
    enabled: Boolean(f.enabled),
  }))

  // Extra safety: ensure payload contains no Symbols / Functions (Firestore would crash on non-serializables)
  const payload = JSON.parse(JSON.stringify({ features: serializableFeatures }))

  try {
    await updateDoc(doc(db, "companies", companyId), payload)

    // Optimistic UI update (also updated by onSnapshot)
    setCompaniesState((prev) =>
      prev.map((c) => (c.id === companyId ? { ...c, features: updatedFeatures } : c))
    )
    if (selectedCompany?.id === companyId) setSelectedCompany({ ...company, features: updatedFeatures })

    toast({ title: "Module mis à jour", variant: "success" })
  } catch (error) {
    toast({ title: "Erreur lors de la mise à jour du module", variant: "destructive" })
    // eslint-disable-next-line no-console
    console.error("toggleFeature error", error)
  }
}

  // --- DATA FETCHING ---

  useEffect(() => {
    const unsubUsers = onSnapshot(query(collection(db, "users")), (snapshot) => {
      setUsersState(snapshot.docs.map(doc => {
        const d = doc.data()
        return {
          id: doc.id,
          name: d.displayName || d.email || "Utilisateur",
          firstName: d.firstName,
          lastName: d.lastName,
          email: d.email || "",
          avatar: (d.displayName || d.email || "U").substring(0, 2).toUpperCase(),
          role: d.role || "employe",
          companyId: d.companyId || "",
          companyName: d.company || d.companyName || "Non assigné",
          contractHours: d.contractHours || 35,
          status: d.disabled ? "suspended" : "active",
          lastLogin: d.lastLogin || null,
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString() : "Récemment"
        } as User
      }))
    })

    const unsubCompanies = onSnapshot(query(collection(db, "companies")), (snapshot) => {
      setCompaniesState(snapshot.docs.map(doc => {
        const d = doc.data()
        const storedFeatures = Array.isArray(d.features) ? d.features : []

        // Map des features stockées (avec compat aliases)
        const storedMap = new Map<string, boolean>()
        for (const f of storedFeatures) {
          const nid = normalizeCompanyModuleId((f as any)?.id)
          if (!nid) continue
          storedMap.set(nid, Boolean((f as any)?.enabled))
        }

        const mergedFeatures = defaultFeatures.map(def => {
          const enabled = storedMap.has(def.id) ? Boolean(storedMap.get(def.id)) : def.isDefault
          return { ...def, enabled }
        })
        return {
          id: doc.id,
          name: d.name || "Sans nom",
          logo: d.logo || "CO",
          plan: d.plan || "starter",
          status: d.status || "active",
          usersCount: d.usersCount || 0,
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString() : "Récemment",
          lastActivity: "Aujourd'hui",
          industry: d.industry || "Autre",
          contactEmail: d.contactEmail || "",
          contactPhone: d.contactPhone || "",
          features: mergedFeatures
        } as Company
      }))
    })

    const unsubLogs = onSnapshot(query(collection(db, "system_logs"), orderBy("timestamp", "desc"), limit(500)), (snapshot) => {
      setLogsState(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LogEntry)))
    })



    const unsubSessions = onSnapshot(
      query(collection(db, "user_sessions"), orderBy("startedAt", "desc"), limit(1500)),
      (snapshot) => {
        setSessionsState(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SessionEntry)))
      }
    )

    return () => { unsubUsers(); unsubCompanies(); unsubLogs(); unsubSessions() }
  }, [])

  // Stats & Filtres UI
  const activeCompanies = companiesState.filter(c => c.status === "active").length
  const activeUsers = usersState.filter(u => u.status === "active").length
  const orphanedUsers = usersState.filter(u => (!u.companyId || u.companyId === "" || u.companyName === "Non assigné") && u.role !== 'super_admin')

  const filteredCompanies = companiesState.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
  const filteredUsers = usersState.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  const filteredCompaniesForSelect = companiesState.filter(c => c.name.toLowerCase().includes(companySearchQuery.toLowerCase()))

  const toggleUserLogs = (userId: string) => {
      setExpandedUserIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId])
  }

  // ==========================================================================
  // RENDUS CONDITIONNELS (VUES DÉTAILLÉES)
  // ==========================================================================

  // --- VUE DÉTAIL ENTREPRISE ---
  if (selectedCompany) {
    const companyUsers = usersState.filter(u => u.companyId === selectedCompany.id)
    return (
      <div className="min-h-screen bg-background pb-32">
        <Header />
        <main className="px-4 py-6 max-w-lg mx-auto space-y-4">
          <button onClick={() => setSelectedCompany(null)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>

          <div className="pulse-card p-4 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                <span className="text-xl font-bold text-white">{selectedCompany.logo}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold truncate">{selectedCompany.name}</h1>
                <p className="text-sm text-muted-foreground">{selectedCompany.industry}</p>
                <div className="flex gap-2 mt-2">
                    <Select value={selectedCompany.status} onValueChange={(v) => handleUpdateCompany(selectedCompany.id, { status: v as any })}>
                        <SelectTrigger className="h-7 text-xs w-auto border-none bg-muted/50"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="active">Actif</SelectItem><SelectItem value="trial">Essai</SelectItem><SelectItem value="suspended">Suspendu</SelectItem></SelectContent>
                    </Select>
                    <Select value={selectedCompany.plan} onValueChange={(v) => handleUpdateCompany(selectedCompany.id, { plan: v as any })}>
                        <SelectTrigger className="h-7 text-xs w-auto border-none bg-muted/50"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="starter">Starter</SelectItem><SelectItem value="pro">Pro</SelectItem><SelectItem value="enterprise">Enterprise</SelectItem></SelectContent>
                    </Select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t border-border">
                <Button variant="outline" className="flex-1 text-xs h-9" onClick={() => setEditingCompany(selectedCompany)}>
                    <Edit3 className="w-3.5 h-3.5 mr-2" /> Éditer
                </Button>
                <Button variant="ghost" className="text-xs h-9 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setIsDeleteConfirmOpen(true)}>
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Supprimer
                </Button>
            </div>
          </div>

          <div className="pulse-card p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2"><Settings className="w-4 h-4 text-primary" /> Modules activés</h2>
            <div className="space-y-3">
              {selectedCompany.features.map((feature) => (
                  <div key={feature.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", feature.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                        <feature.icon className="w-4 h-4" />
                      </div>
                      <p className="text-sm font-medium">{feature.name}</p>
                    </div>
                    <Switch checked={feature.enabled} onCheckedChange={(v) => toggleFeature(selectedCompany.id, feature.id, Boolean(v))} />
                  </div>
              ))}
            </div>
          </div>

          <div className="pulse-card p-4">
             <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Utilisateurs ({companyUsers.length})</h2>
                <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10 h-8" onClick={() => setInvitingToCompany(selectedCompany)}>
                    <Plus className="w-4 h-4 mr-1.5" /> Inviter
                </Button>
             </div>
            <div className="space-y-2">
                {companyUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-lg transition-colors group">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary cursor-pointer border border-transparent group-hover:border-primary/20" onClick={() => { setSelectedCompany(null); setSelectedUser(u); }}>{u.avatar}</div>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setSelectedCompany(null); setSelectedUser(u); }}>
                            <div className="flex items-center gap-2"><p className="text-sm font-medium truncate">{u.name}</p>{getStatusBadge(u.status)}</div>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => { setSelectedCompany(null); setSelectedUser(u); }}><Edit3 className="w-4 h-4 mr-2" /> Détails</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSendResetEmail(u.email, u.name)}><KeyRound className="w-4 h-4 mr-2" /> Reset MDP</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleImpersonate(u.id)}><LogIn className="w-4 h-4 mr-2" /> Se connecter en tant que</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ))}
                {companyUsers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucun utilisateur.</p>}
            </div>
          </div>
        </main>
        
        {/* Modale Suppression */}
        <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
            <DialogContent className="max-w-xs rounded-2xl">
                <DialogHeader><DialogTitle>Supprimer l'entreprise ?</DialogTitle></DialogHeader>
                <p className="text-sm text-muted-foreground">Cette action est irréversible et supprimera l'accès à tous les utilisateurs liés.</p>
                <DialogFooter className="flex gap-2 sm:justify-between">
                    <Button variant="outline" className="flex-1" onClick={() => setIsDeleteConfirmOpen(false)}>Annuler</Button>
                    <Button variant="destructive" className="flex-1" onClick={handleDeleteCompany}>Confirmer</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        {/* DRAWERS D'EDITION */}
        {editingCompany && <CompanyEditDrawer company={editingCompany} onClose={() => setEditingCompany(null)} onSave={(data) => handleUpdateCompany(editingCompany.id, data)} />}
        {invitingToCompany && <CompanyInviteDrawer company={invitingToCompany} onClose={() => setInvitingToCompany(null)} />}
        
        <BottomNav />
      </div>
    )
  }

  // --- VUE DÉTAIL UTILISATEUR ---
  if (selectedUser) {
    const userLogs = logsState.filter((l) => l.userId === selectedUser.id)
    return (
      <div className="min-h-screen bg-background pb-32">
        <Header />
        <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
            <button onClick={() => setSelectedUser(null)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" /> Retour
            </button>

            <div className="pulse-card p-5">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-primary/20">{selectedUser.avatar}</div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold">{selectedUser.name}</h1>
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-full" onClick={() => setEditingUser(selectedUser)}>
                                    <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                                </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                            <div className="mt-2">{getStatusBadge(selectedUser.status)}</div>
                        </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-xl"><MoreHorizontal className="w-5 h-5 text-muted-foreground" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Administration</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setEditingUser(selectedUser)}>
                                <Edit3 className="w-4 h-4 mr-2" /> Modifier informations
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleImpersonate(selectedUser.id)}>
                                <LogIn className="w-4 h-4 mr-2" /> Se connecter en tant que
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSendResetEmail(selectedUser.email, selectedUser.name)}>
                                <KeyRound className="w-4 h-4 mr-2" /> Envoyer reset MDP
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDeleteUser(selectedUser.id)} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                                <Trash2 className="w-4 h-4 mr-2" /> Supprimer compte
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="space-y-4">
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground uppercase font-bold ml-1">Entreprise</Label>
                        <Dialog open={isCompanySelectorOpen} onOpenChange={setIsCompanySelectorOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full justify-between h-12 text-left font-normal border-muted-foreground/20 bg-muted/30 hover:bg-muted/50">
                                    <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-muted-foreground" /><span className={selectedUser.companyId ? "text-foreground" : "text-muted-foreground"}>{selectedUser.companyName || "Choisir..."}</span></div>
                                    <ChevronRight className="w-4 h-4 opacity-50" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-sm rounded-3xl h-[80vh] flex flex-col p-0 gap-0">
                                <div className="p-4 border-b">
                                    <DialogTitle className="mb-2">Assigner une entreprise</DialogTitle>
                                    <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Rechercher..." value={companySearchQuery} onChange={(e) => setCompanySearchQuery(e.target.value)} className="pl-9 rounded-xl bg-muted/50"/></div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2">
                                    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted cursor-pointer mb-1" onClick={() => { handleUpdateUserSimple(selectedUser.id, { companyId: "none" }); setIsCompanySelectorOpen(false); }}>
                                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center border border-dashed"><XCircle className="w-5 h-5 text-muted-foreground" /></div>
                                        <div><p className="font-medium text-sm">Non assigné</p><p className="text-xs text-muted-foreground">Retirer de l'entreprise</p></div>
                                    </div>
                                    {filteredCompaniesForSelect.map(c => (
                                        <div key={c.id} className={cn("flex items-center gap-3 p-3 rounded-xl hover:bg-muted cursor-pointer mb-1 transition-colors", selectedUser.companyId === c.id && "bg-primary/5 border border-primary/20")} onClick={() => { handleUpdateUserSimple(selectedUser.id, { companyId: c.id }); setIsCompanySelectorOpen(false); }}>
                                            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-xs font-bold shadow-sm border border-border/50">{c.logo}</div>
                                            <div><p className="font-medium text-sm">{c.name}</p><p className="text-xs text-muted-foreground">{c.industry}</p></div>
                                            {selectedUser.companyId === c.id && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                                        </div>
                                    ))}
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground uppercase font-bold ml-1">Rôle</Label>
                            <Select value={selectedUser.role} onValueChange={(val) => handleUpdateUserSimple(selectedUser.id, { role: val })}>
                                <SelectTrigger className="w-full h-10 rounded-xl bg-muted/30 border-muted-foreground/20"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="employe">Employé</SelectItem>
                                    <SelectItem value="assistant_manager">Assistant Manager</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                    <SelectItem value="directeur">Directeur</SelectItem>
                                    <SelectItem value="gerant">Gérant</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground uppercase font-bold ml-1">Statut</Label>
                            <Select value={selectedUser.status === "suspended" ? "suspended" : "active"} onValueChange={(val) => handleUpdateUserSimple(selectedUser.id, { disabled: val === "suspended" })}>
                                <SelectTrigger className="w-full h-10 rounded-xl bg-muted/30 border-muted-foreground/20"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="active">Actif</SelectItem><SelectItem value="suspended">Suspendu</SelectItem></SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Historique Pliable */}
            <div className="pulse-card overflow-hidden">
                <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setIsHistoryOpen(!isHistoryOpen)}>
                        <h3 className="font-semibold flex items-center gap-2"><History className="w-4 h-4 text-primary" /> Historique d'activité</h3>
                        <CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="h-6 w-6 p-0"><ChevronDown className={cn("w-4 h-4 transition-transform", isHistoryOpen && "rotate-180")} /></Button></CollapsibleTrigger>
                    </div>
                    <CollapsibleContent>
                        <div className="px-4 pb-4 space-y-3 pt-0 border-t border-dashed border-border/50 mt-2">
                            {userLogs.length === 0 && <p className="text-sm text-muted-foreground py-2">Aucune donnée.</p>}
                            {userLogs.slice(0, 5).map(log => (
                                <div key={log.id} className="flex gap-3 text-sm bg-muted/30 p-2 rounded-lg items-start">
                                    <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", log.action.includes("DELETE") || log.action.includes("SUSPEND") ? "bg-red-500" : "bg-emerald-500")} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between">
                                            <p className="font-medium truncate">{log.action}</p>
                                            <span className="text-xs text-muted-foreground">{log.timestamp?.split("T")[1]?.slice(0,5)}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">{log.details || log.ip}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </div>
        </main>
        
        {editingUser && <UserEditDrawer user={editingUser} onClose={() => setEditingUser(null)} onSave={handleFullUpdateUser} />}
        <BottomNav />
      </div>
    )
  }

  // --- VUE PRINCIPALE (DASHBOARD) ---
  return (
    <div className="min-h-screen bg-background pb-32">
      <Header />
      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20"><Shield className="w-7 h-7 text-white" /></div>
          <div><h1 className="text-2xl font-bold tracking-tight">Centre de contrôle</h1><p className="text-sm text-muted-foreground font-medium">Super Admin</p></div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted/50 rounded-xl overflow-x-auto no-scrollbar">
          {[{ id: "logs", icon: History, label: "Activité" }, { id: "companies", icon: Building2, label: "Entreprises" }, { id: "users", icon: Users, label: "Utilisateurs" }, { id: "overview", icon: BarChart3, label: "Stats" }].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={cn("flex items-center gap-2 py-2 px-3.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap", activeTab === tab.id ? "bg-card text-foreground shadow-sm ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}><tab.icon className="w-4 h-4" /><span className="">{tab.label}</span></button>
          ))}
        </div>

        {/* Search */}
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-xl bg-card border-muted-foreground/20" /></div>

        {/* --- ONGLETS --- */}
        {activeTab === "overview" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            {/* Accès rapide Gestion des droits */}
            <Link href="/centre-controle/acces" className="pulse-card p-4 flex items-center justify-between hover:border-primary/50 transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Gestion des droits</h3>
                  <p className="text-xs text-muted-foreground">Permissions par rôle et par page</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </Link>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="pulse-card p-4"><div className="flex items-center gap-2 mb-2"><Building2 className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground font-medium uppercase">Entreprises</span></div><p className="text-3xl font-bold">{companiesState.length}</p><p className="text-xs text-emerald-500 font-medium">{activeCompanies} actives</p></div>
              <div className="pulse-card p-4"><div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-accent" /><span className="text-xs text-muted-foreground font-medium uppercase">Utilisateurs</span></div><p className="text-3xl font-bold">{usersState.length}</p><p className="text-xs text-emerald-500 font-medium">{activeUsers} actifs</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="pulse-card p-4 border-l-4 border-slate-300"><div className="flex items-center gap-2 mb-2"><UserX className="w-4 h-4 text-slate-500" /><span className="text-xs text-muted-foreground font-medium uppercase">Orphelins</span></div><p className="text-3xl font-bold text-slate-600">{orphanedUsers.length}</p><p className="text-[10px] text-muted-foreground">Sans entreprise</p></div>
                <div className="pulse-card p-4"><div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-blue-500" /><span className="text-xs text-muted-foreground font-medium uppercase">Remplissage</span></div><p className="text-3xl font-bold">{companiesState.length > 0 ? Math.round(usersState.length / companiesState.length) : 0}</p><p className="text-[10px] text-muted-foreground">Moy. users / société</p></div>
            </div>
          </div>
        )}

        {activeTab === "companies" && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
            <Dialog open={isAddCompanyOpen} onOpenChange={setIsAddCompanyOpen}>
                <DialogTrigger asChild><Button className="w-full rounded-xl border-dashed border-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 shadow-none h-12"><Plus className="w-5 h-5 mr-2" /> Ajouter une entreprise</Button></DialogTrigger>
                <DialogContent className="max-w-sm rounded-3xl">
                    <DialogHeader><DialogTitle>Nouvelle Entreprise</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1"><Label>Nom</Label><Input value={newCompany.name} onChange={e => setNewCompany({...newCompany, name: e.target.value})} placeholder="Ex: Ma Boite SAS" /></div>
                        <div className="space-y-1"><Label>Secteur</Label><Input value={newCompany.industry} onChange={e => setNewCompany({...newCompany, industry: e.target.value})} placeholder="Ex: Restauration" /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1"><Label>Plan</Label><Select onValueChange={v => setNewCompany({...newCompany, plan: v as any})} defaultValue="starter"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="starter">Starter</SelectItem><SelectItem value="pro">Pro</SelectItem><SelectItem value="enterprise">Enterprise</SelectItem></SelectContent></Select></div>
                            <div className="space-y-1"><Label>Statut</Label><Select onValueChange={v => setNewCompany({...newCompany, status: v as any})} defaultValue="active"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Actif</SelectItem><SelectItem value="suspended">Suspendu</SelectItem><SelectItem value="trial">Essai</SelectItem></SelectContent></Select></div>
                        </div>
                    </div>
                    <Button onClick={handleCreateCompany} disabled={!newCompany.name} className="w-full rounded-xl">Créer</Button>
                </DialogContent>
            </Dialog>
            
            {filteredCompanies.map((company) => (
              <div key={company.id} className="pulse-card p-3 pl-4 flex items-center justify-between hover:border-primary/50 transition-all group">
                <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => setSelectedCompany(company)}>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center shrink-0 shadow-sm"><span className="text-sm font-bold text-white">{company.logo}</span></div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2"><h3 className="font-semibold text-sm truncate">{company.name}</h3>{getStatusBadge(company.status)}</div>
                        <div className="flex items-center gap-2 mt-1"><span className="text-xs text-muted-foreground">{company.industry}</span><span className="text-muted-foreground">•</span><span className="text-xs text-muted-foreground">{company.usersCount} utilisateurs</span></div>
                    </div>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-60 group-hover:opacity-100"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setEditingCompany(company)}>
                            <Edit3 className="w-4 h-4 mr-2" /> Modifier entreprise
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setInvitingToCompany(company)}>
                            <UserPlus className="w-4 h-4 mr-2" /> Inviter Gérant
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setSelectedCompany(company)}>
                            <Settings className="w-4 h-4 mr-2" /> Gérer modules
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}

        {/* ONGLETS UTILISATEURS */}
        {activeTab === "users" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            {orphanedUsers.length > 0 && (
                <Accordion type="single" collapsible defaultValue="orphans" className="border rounded-xl bg-orange-50/50 border-orange-100 dark:bg-orange-950/10 dark:border-orange-900/50">
                    <AccordionItem value="orphans" className="border-none">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                            <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                                <AlertCircle className="w-4 h-4" />
                                <span className="font-semibold text-sm">En attente d'affectation ({orphanedUsers.length})</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-3 pb-3 pt-0">
                            <div className="space-y-2">
                                {orphanedUsers.map(user => (
                                    <div key={user.id} className="flex justify-between items-center p-2 rounded-lg bg-background border border-orange-200/50 shadow-sm">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">{user.avatar}</div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm truncate">{user.name}</p>
                                                <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" onClick={() => handleDeleteUser(user.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400" onClick={() => setSelectedUser(user)}>
                                                <Settings className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            )}

            <div className="space-y-4">
               <Accordion type="multiple" className="space-y-3">
                {filteredCompanies.map(company => {
                    const companyUsers = filteredUsers.filter(u => u.companyId === company.id);
                    if (companyUsers.length === 0 && searchQuery) return null;
                    
                    return (
                        <AccordionItem key={company.id} value={company.id} className="border-none rounded-xl bg-card shadow-sm border overflow-hidden">
                            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-3 text-left w-full">
                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                        {company.logo}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm truncate">{company.name}</p>
                                        <p className="text-[10px] text-muted-foreground">{companyUsers.length} users</p>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-0 pb-0 bg-muted/5">
                                <div className="divide-y divide-border/40 border-t border-border/40">
                                    {companyUsers.map(user => (
                                        <div key={user.id} className="p-3 flex items-center justify-between hover:bg-muted/20 transition-colors">
                                            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedUser(user)}>
                                                <div className="w-7 h-7 rounded-full bg-background border flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                                    {user.avatar}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">{user.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">{user.role}</p>
                                                </div>
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 opacity-60 hover:opacity-100"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleImpersonate(user.id)}>
                                                        <LogIn className="w-4 h-4 mr-2" /> Se connecter en tant que
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleSendResetEmail(user.email, user.name)}>
                                                        <KeyRound className="w-4 h-4 mr-2" /> Reset MDP (Brevo)
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => setSelectedUser(user)}>
                                                        <Settings className="w-4 h-4 mr-2" /> Gérer profil
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    )
                })}
               </Accordion>
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === "logs" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <Accordion type="multiple" className="space-y-4">
            {groupedLogs.map((company) => (
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
                        <h3 className="font-bold text-base leading-none">{company.companyName}</h3>
                        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                           {company.users.length} actifs • <span className="text-indigo-500 font-medium">Dernier mvmt {formatDistanceToNow(new Date(company.lastActive), { addSuffix: true, locale: fr })}</span>
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
                          <div key={user.userId} className={cn("rounded-xl border transition-all duration-300 overflow-hidden bg-background", isExpanded ? "border-indigo-200 shadow-md ring-1 ring-indigo-100" : "border-transparent shadow-sm")}>
                            
                            {/* En-tête Utilisateur */}
                            <div 
                              onClick={() => toggleUserLogs(user.userId)}
                              className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50"
                            >
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold border border-slate-300">
                                    {user.userName.substring(0, 2).toUpperCase()}
                                    </div>
                                    {/* Indicateur activité récente (< 24h) */}
                                    {new Date(user.lastActive).getTime() > Date.now() - 86400000 && (
                                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                                    )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-sm">{user.userName}</p>
                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground border-border bg-transparent">{user.userRole}</Badge>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {user.logs.length} actions • Dernier: {format(new Date(user.lastActive), "HH:mm", { locale: fr })}
                                  </p>
                                </div>
                              </div>
                              <div className={cn("w-8 h-8 flex items-center justify-center rounded-full transition-all bg-muted/50 text-muted-foreground", isExpanded && "rotate-180 bg-indigo-50 text-indigo-600")}>
                                <ChevronDown className="w-4 h-4" />
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

                                    {user.logs.map((log) => (
                                        <div key={log.id} className="relative flex gap-4 items-start group">
                                            {/* Point sur la timeline */}
                                            <div className="z-10 w-3 h-3 rounded-full bg-white border-2 border-indigo-400 mt-1.5 shrink-0 group-hover:scale-125 transition-transform shadow-sm" />
                                            
                                            <div className="flex-1 min-w-0 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex justify-between items-start mb-1.5">
                                                    <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 gap-1.5 border font-bold h-5", getActionStyle(log.action))}>
                                                        {getActionIcon(log.action)}
                                                        {log.action}
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground font-mono bg-muted/50 px-1.5 rounded">
                                                        {format(new Date(log.timestamp), "HH:mm:ss")}
                                                    </span>
                                                </div>
                                                
                                                <p className="text-sm text-foreground/90 leading-snug break-words">{log.details}</p>
                                                
                                                <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground border-t border-dashed pt-2">
                                                    {log.device && (
                                                        <span className="flex items-center gap-1">
                                                            {log.device.toLowerCase().includes("mobile") ? <Smartphone className="w-3 h-3"/> : <Laptop className="w-3 h-3"/>}
                                                            {log.device}
                                                        </span>
                                                    )}
                                                    <span className="flex items-center gap-1">
                                                        <CalendarDays className="w-3 h-3"/>
                                                        {format(new Date(log.timestamp), "dd MMM", { locale: fr })}
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

            {groupedLogs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-card rounded-2xl border border-dashed border-border/60">
                <Activity className="w-12 h-12 mb-3 opacity-20" />
                <p>Aucune activité enregistrée pour le moment.</p>
              </div>
            )}
          </div>
        )}
      </main>
      
      {/* DRAWERS GLOBAUX */}
      {editingUser && <UserEditDrawer user={editingUser} onClose={() => setEditingUser(null)} onSave={handleFullUpdateUser} />}
      {editingCompany && <CompanyEditDrawer company={editingCompany} onClose={() => setEditingCompany(null)} onSave={(data) => handleUpdateCompany(editingCompany.id, data)} />}
      {invitingToCompany && <CompanyInviteDrawer company={invitingToCompany} onClose={() => setInvitingToCompany(null)} />}

      <BottomNav />
    </div>
  )
}

// ============================================================================
// SOUS-COMPOSANTS (DRAWERS)
// ============================================================================

function UserEditDrawer({ user, onClose, onSave }: { user: any, onClose: () => void, onSave: (data: any) => void }) {
    // Parsing intelligent du nom
    const initialFirst = user.firstName || user.name?.split(' ')[0] || "";
    const initialLast = user.lastName || user.name?.split(' ').slice(1).join(' ') || "";

    const [firstName, setFirstName] = useState(initialFirst);
    const [lastName, setLastName] = useState(initialLast);
    const [email, setEmail] = useState(user.email || "");
    const [role, setRole] = useState(user.role || "employee");
    const [contractHours, setContractHours] = useState(user.contractHours || 35);

    const handleSave = () => {
        onSave({ firstName, lastName, email, role, contractHours });
    }

    return (
        <>
            <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
                <div className="sticky top-0 bg-card rounded-t-3xl p-4 border-b border-border z-10 flex justify-between items-center">
                    <h2 className="font-semibold text-lg">Modifier l'utilisateur</h2>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-muted"><X className="w-5 h-5" /></Button>
                </div>

                <div className="p-5 space-y-5 pb-10">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground"><User className="w-4 h-4"/> Prénom</label>
                            <Input value={firstName} onChange={e => setFirstName(e.target.value)} className="rounded-xl h-11" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Nom</label>
                            <Input value={lastName} onChange={e => setLastName(e.target.value)} className="rounded-xl h-11" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground"><Mail className="w-4 h-4"/> Email</label>
                        <Input value={email} onChange={e => setEmail(e.target.value)} className="rounded-xl h-11" />
                        <p className="text-[10px] text-orange-500 bg-orange-500/10 p-2 rounded-lg border border-orange-500/20">
                            Attention: modifier l'email changera ses identifiants de connexion.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground"><Shield className="w-4 h-4"/> Rôle</label>
                            <Select value={role} onValueChange={setRole}>
                                <SelectTrigger className="w-full h-11 rounded-xl"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="employe">Employé</SelectItem>
                                    <SelectItem value="assistant_manager">Assistant Manager</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                    <SelectItem value="directeur">Directeur</SelectItem>
                                    <SelectItem value="gerant">Gérant</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground"><Clock className="w-4 h-4"/> Contrat (h)</label>
                            <Input type="number" value={contractHours} onChange={e => setContractHours(Number(e.target.value))} className="rounded-xl h-11" />
                        </div>
                    </div>

                    <Button className="w-full py-6 text-lg rounded-xl mt-4 font-semibold shadow-lg shadow-primary/20" onClick={handleSave}>
                        <Save className="w-5 h-5 mr-2" /> Enregistrer
                    </Button>
                </div>
            </div>
        </>
    )
}

function CompanyEditDrawer({ company, onClose, onSave }: { company: Company, onClose: () => void, onSave: (data: Partial<Company>) => void }) {
    const [name, setName] = useState(company.name);
    const [status, setStatus] = useState(company.status);
    const [plan, setPlan] = useState(company.plan);
    const [industry, setIndustry] = useState(company.industry);

    const handleSave = () => {
        onSave({ name, status, plan, industry });
        onClose();
    }

    return (
        <>
            <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
                <div className="sticky top-0 bg-card rounded-t-3xl p-4 border-b border-border z-10 flex justify-between items-center">
                    <h2 className="font-semibold text-lg">Modifier l'entreprise</h2>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-muted"><X className="w-5 h-5" /></Button>
                </div>
                <div className="p-5 space-y-5 pb-10">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Nom de la société</label>
                        <Input value={name} onChange={e => setName(e.target.value)} className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Secteur</label>
                        <Input value={industry} onChange={e => setIndustry(e.target.value)} className="rounded-xl h-11" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Statut</label>
                            <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="active">Actif</SelectItem><SelectItem value="suspended">Suspendu</SelectItem><SelectItem value="trial">Essai</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Plan</label>
                            <Select value={plan} onValueChange={(v: any) => setPlan(v)}>
                                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="starter">Starter</SelectItem><SelectItem value="pro">Pro</SelectItem><SelectItem value="enterprise">Enterprise</SelectItem></SelectContent>
                            </Select>
                        </div>
                    </div>
                    <Button className="w-full py-6 text-lg rounded-xl mt-4 font-semibold shadow-lg shadow-primary/20" onClick={handleSave}>
                        <Save className="w-5 h-5 mr-2" /> Enregistrer
                    </Button>
                </div>
            </div>
        </>
    )
}

function CompanyInviteDrawer({ company, onClose }: { company: Company, onClose: () => void }) {
    const { toast } = useToast();
    const [email, setEmail] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [role, setRole] = useState("gerant");
    const [isLoading, setIsLoading] = useState(false);

    const handleInvite = async () => {
        if (!email || !firstName) return;
        setIsLoading(true);
        try {
            const res = await fetch("/api/admin/invite-user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email, firstName, lastName, role,
                    contractHours: 35,
                    company: company.name, // Nom lisible
                    companyId: company.id  // IDENTIFIANT TECHNIQUE (CRITIQUE)
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur invitation");
            
            toast({ title: "Invitation envoyée", description: `L'utilisateur a été ajouté à ${company.name}`, variant: "success" });
            onClose();
        } catch (e: any) {
            toast({ title: "Erreur", description: e.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <>
            <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
                <div className="sticky top-0 bg-card rounded-t-3xl p-4 border-b border-border z-10 flex justify-between items-center">
                    <h2 className="font-semibold text-lg">Inviter un utilisateur</h2>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-muted"><X className="w-5 h-5" /></Button>
                </div>
                <div className="p-5 space-y-5 pb-10">
                    <div className="p-4 bg-muted/40 rounded-xl border border-dashed border-muted-foreground/30 text-center mb-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Ajout d'un utilisateur pour</p>
                        <p className="font-bold text-lg text-primary flex items-center justify-center gap-2">
                            <Building2 className="w-4 h-4"/> {company.name}
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Prénom</label>
                            <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jean" className="rounded-xl h-11" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Nom</label>
                            <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Dupont" className="rounded-xl h-11" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Email professionnel</label>
                        <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="jean@entreprise.com" className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Rôle</label>
                        <Select value={role} onValueChange={setRole}>
                            <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="gerant">Gérant / Admin</SelectItem>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="employe">Employé</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button className="w-full py-6 text-lg rounded-xl mt-4 font-semibold shadow-lg shadow-primary/20" onClick={handleInvite} disabled={isLoading || !email}>
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                        Envoyer l'invitation
                    </Button>
                </div>
            </div>
        </>
    )
}

"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import {
  Shield, Users, Search, Building2, ChevronRight, Edit3, CheckCircle2,
  XCircle, Activity, TrendingUp, LogIn, Monitor, Smartphone, MapPin,
  Calendar, Mail, Phone, ArrowLeft, Settings, History, BarChart3, Globe,
  Truck, Target, Coins, FileText, Plus, Trash2, Briefcase, AlertCircle,
  PieChart, UserX, MoreHorizontal, ChevronDown, KeyRound, Send, Loader2,
  User, Lock, Save, X, Clock, FileEdit, Zap, MousePointerClick, CalendarDays, Laptop
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

// Imports Firebase
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, deleteDoc, serverTimestamp, limit } from "firebase/firestore"
import { signInWithCustomToken, signOut } from "firebase/auth"
import { db, auth } from "@/lib/firebase/client"
import { format, formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"

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
  role: "employe" | "assistant_manager" | "manager" | "directeur" | "gerant"
  companyId: string
  companyName: string
  contractHours?: number
  status: "active" | "inactive" | "suspended"
  lastLogin: any
  createdAt: string
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
}

interface GroupedUserLog {
  userId: string
  userName: string
  userRole: string
  lastActive: string
  logs: LogEntry[]
}

interface GroupedCompanyLog {
  companyId: string
  companyName: string
  lastActive: string
  users: GroupedUserLog[]
}

const defaultFeatures: Omit<CompanyFeature, "enabled">[] = [
  { id: "sites-contacts", name: "Sites & Contacts", description: "Raccourcis et contacts utiles", icon: Globe, isDefault: true },
  { id: "fournisseurs", name: "Fournisseurs", description: "Gestion des contacts fournisseurs", icon: Truck, isDefault: true },
  { id: "objectifs", name: "Objectifs", description: "Suivi des objectifs et paliers", icon: Target, isDefault: true },
  { id: "primes", name: "Primes", description: "Historique et calcul des primes", icon: Coins, isDefault: true },
  { id: "equipes", name: "Équipes", description: "Gestion des collaborateurs", icon: Users, isDefault: true },
  { id: "diffusion", name: "Relevés température", description: "Suivi des températures frigos", icon: FileText, isDefault: false },
]

type TabType = "overview" | "companies" | "users" | "logs"

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
  const [activeTab, setActiveTab] = useState<TabType>("logs")
  const [searchQuery, setSearchQuery] = useState("")
  
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  
  const [isAddCompanyOpen, setIsAddCompanyOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isCompanySelectorOpen, setIsCompanySelectorOpen] = useState(false)
  const [companySearchQuery, setCompanySearchQuery] = useState("")
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [expandedUserIds, setExpandedUserIds] = useState<string[]>([]) 

  const [companiesState, setCompaniesState] = useState<Company[]>([])
  const [usersState, setUsersState] = useState<User[]>([])
  const [logsState, setLogsState] = useState<LogEntry[]>([])

  const [newCompany, setNewCompany] = useState({
    name: "",
    industry: "",
    plan: "starter",
    status: "active",
    contactEmail: ""
  })

  // --- TRAITEMENT DES LOGS ---
  const groupedLogs = useMemo(() => {
    const companiesMap: Record<string, GroupedCompanyLog> = {}
    
    logsState.forEach(log => {
      if (searchQuery && activeTab === "logs" &&
          !log.companyName.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !log.userName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return
      }

      if (!companiesMap[log.companyId]) {
        companiesMap[log.companyId] = {
          companyId: log.companyId,
          companyName: log.companyName || "Entreprise Inconnue",
          lastActive: log.timestamp,
          users: []
        }
      }

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

    const sorted = Object.values(companiesMap).sort((a, b) => 
      new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
    )

    sorted.forEach(company => {
        company.users.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime())
    })

    return sorted
  }, [logsState, searchQuery, activeTab])

  // --- HELPERS VISUELS ---

  const getRoleBadge = (role: string) => {
     switch (role) {
      case "gerant": return <Badge className="bg-amber-500 text-white border-0 hover:bg-amber-600">Gérant</Badge>
      case "directeur": return <Badge className="bg-red-500 text-white border-0 hover:bg-red-600">Directeur</Badge>
      case "manager": return <Badge className="bg-purple-500 text-white border-0 hover:bg-purple-600">Manager</Badge>
      case "assistant_manager": return <Badge className="bg-blue-500 text-white border-0 hover:bg-blue-600">Assistant M.</Badge>
      default: return <Badge variant="outline" className="text-muted-foreground">Employé</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
     switch (status) {
      case "active": return <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-200">Actif</Badge>
      case "trial": return <Badge className="bg-blue-500/20 text-blue-600 border-blue-200">Essai</Badge>
      case "suspended": return <Badge className="bg-red-500/20 text-red-600 border-red-200">Suspendu</Badge>
      default: return <Badge variant="secondary">Inactif</Badge>
    }
  }

  const getActionIcon = (action: string) => {
    const a = (action || "").toUpperCase();
    if (a.includes("LOGIN")) return <LogIn className="w-3.5 h-3.5" />
    if (a.includes("CREATE")) return <Zap className="w-3.5 h-3.5" />
    if (a.includes("UPDATE")) return <FileEdit className="w-3.5 h-3.5" />
    if (a.includes("DELETE")) return <Trash2 className="w-3.5 h-3.5" />
    return <MousePointerClick className="w-3.5 h-3.5" />
  }

  const getActionStyle = (action: string) => {
    const a = (action || "").toUpperCase();
    if (a.includes("LOGIN")) return "bg-emerald-500/10 text-emerald-700 border-emerald-200" 
    if (a.includes("CREATE")) return "bg-blue-500/10 text-blue-700 border-blue-200"
    if (a.includes("UPDATE")) return "bg-amber-500/10 text-amber-700 border-amber-200"
    if (a.includes("DELETE")) return "bg-red-500/10 text-red-700 border-red-200"
    return "bg-slate-100 text-slate-700 border-slate-200"
  }

  // --- ACTIONS LOGIQUE ---

  const handleFullUpdateUser = async (formData: any) => {
    try {
        const res = await fetch("/api/admin/invite-user", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid: editingUser?.id, ...formData }),
        });
        if (!res.ok) throw new Error("Erreur API");
        setEditingUser(null);
        toast({ title: "Utilisateur mis à jour" });
    } catch (error) {
        toast({ title: "Erreur", description: "Échec de la mise à jour.", variant: "destructive" });
    }
  };

  const handleImpersonate = async (uid: string) => {
    if (!confirm("⚠️ ATTENTION : Vous allez être connecté en tant que cet utilisateur.")) return;
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
            toast({ title: "Mode Incarnation", description: "Vous êtes connecté sur le compte utilisateur." });
        } else {
            throw new Error(data.error);
        }
    } catch (e: any) {
        toast({ title: "Erreur", description: "Impossible de se connecter au compte.", variant: "destructive" });
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
        toast({ title: "Email envoyé", description: `Lien de réinitialisation envoyé à ${email}.` });
    } catch (e) {
        toast({ title: "Erreur", description: "Échec de l'envoi du mail.", variant: "destructive" });
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
      toast({ title: "Entreprise créée" })
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
      toast({ title: "Mise à jour réussie" })
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
      toast({ title: "Utilisateur mis à jour" })
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

  const toggleFeature = async (companyId: string, featureId: string) => {
    const company = companiesState.find(c => c.id === companyId)
    if (!company) return
    const updatedFeatures = company.features.map(f => f.id === featureId ? { ...f, enabled: !f.enabled } : f)
    try {
        await updateDoc(doc(db, "companies", companyId), { features: updatedFeatures })
        if (selectedCompany?.id === companyId) setSelectedCompany({ ...company, features: updatedFeatures })
        toast({ title: "Module mis à jour" })
    } catch (error) { toast({ title: "Erreur", variant: "destructive" }) }
  }


  // --- CHARGEMENT ---
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
          lastLogin: "N/A",
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString() : "Récemment"
        } as User
      }))
    })

    const unsubCompanies = onSnapshot(query(collection(db, "companies")), (snapshot) => {
      setCompaniesState(snapshot.docs.map(doc => {
        const d = doc.data()
        const storedFeatures = d.features || []
        const mergedFeatures = defaultFeatures.map(def => {
            const stored = storedFeatures.find((f: any) => f.id === def.id)
            return { ...def, enabled: stored ? stored.enabled : def.isDefault }
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

    return () => { unsubUsers(); unsubCompanies(); unsubLogs() }
  }, [])

  // Stats & Filtres
  const activeCompanies = companiesState.filter(c => c.status === "active").length
  const activeUsers = usersState.filter(u => u.status === "active").length
  const orphanedUsers = usersState.filter(u => (!u.companyId || u.companyId === "" || u.companyName === "Non assigné") && u.role !== 'super_admin')

  const filteredCompanies = companiesState.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
  const filteredUsers = usersState.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  const filteredCompaniesForSelect = companiesState.filter(c => c.name.toLowerCase().includes(companySearchQuery.toLowerCase()))

  const toggleUserLogs = (userId: string) => {
      setExpandedUserIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId])
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <Header />
      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20"><Shield className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-2xl font-bold tracking-tight">Centre de contrôle</h1><p className="text-sm text-muted-foreground">Super Admin</p></div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted/30 rounded-xl overflow-x-auto border border-border/50">
          {[{ id: "logs", icon: History, label: "Activité" }, { id: "overview", icon: BarChart3, label: "Stats" }, { id: "companies", icon: Building2, label: "Entreprises" }, { id: "users", icon: Users, label: "Utilisateurs" }].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={cn("flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap", activeTab === tab.id ? "bg-background text-foreground shadow-sm ring-1 ring-black/5" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}><tab.icon className="w-4 h-4" /><span className="hidden sm:inline">{tab.label}</span></button>
          ))}
        </div>

        {/* Search */}
        <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
            <Input placeholder="Rechercher une entreprise, un utilisateur..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-xl bg-background/80 backdrop-blur-sm border-border/60 relative z-10 focus:ring-primary/20" />
        </div>

        {/* --- ONGLETS --- */}
        {activeTab === "overview" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="pulse-card p-4"><div className="flex items-center gap-2 mb-2"><Building2 className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Entreprises</span></div><p className="text-2xl font-bold">{companiesState.length}</p><p className="text-xs text-emerald-500">{activeCompanies} actives</p></div>
              <div className="pulse-card p-4"><div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-accent" /><span className="text-xs text-muted-foreground">Utilisateurs</span></div><p className="text-2xl font-bold">{usersState.length}</p><p className="text-xs text-emerald-500">{activeUsers} actifs</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="pulse-card p-4 border-l-4 border-amber-300 bg-amber-50/50"><div className="flex items-center gap-2 mb-2"><UserX className="w-4 h-4 text-amber-600" /><span className="text-xs text-amber-700 font-medium">Orphelins</span></div><p className="text-2xl font-bold text-amber-800">{orphanedUsers.length}</p><p className="text-[10px] text-amber-600/80">Sans entreprise</p></div>
                <div className="pulse-card p-4"><div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-blue-500" /><span className="text-xs text-muted-foreground">Remplissage</span></div><p className="text-2xl font-bold">{companiesState.length > 0 ? Math.round(usersState.length / companiesState.length) : 0}</p><p className="text-[10px] text-muted-foreground">Moy. users / société</p></div>
            </div>
          </div>
        )}

        {/* --- ONGLET LOGS / CONNEXIONS (VUE LUDIQUE) --- */}
        {activeTab === "logs" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex justify-between items-end px-1">
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Flux d'activité</h2>
                <Badge variant="outline" className="text-[10px] bg-background/50 backdrop-blur-sm">Live</Badge>
            </div>
            
            {/* VRAI ACCORDÉON (Fermé par défaut) */}
            <Accordion type="multiple" className="space-y-4">
            {groupedLogs.map((company) => (
                <AccordionItem 
                    key={company.companyId} 
                    value={company.companyId} 
                    className="border-none rounded-2xl bg-white dark:bg-card shadow-sm border border-black/5 dark:border-white/5 overflow-hidden"
                >
                  <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30 transition-colors group">
                    <div className="flex items-center gap-4 w-full">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900">
                        <Building2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="text-left flex-1">
                        <h3 className="font-bold text-base leading-none text-foreground">{company.companyName}</h3>
                        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-2">
                           <Badge variant="secondary" className="h-5 px-1.5 font-normal bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-100">{company.users.length} actifs</Badge>
                           <span className="text-[10px] opacity-70">Activité {formatDistanceToNow(new Date(company.lastActive), { addSuffix: true, locale: fr })}</span>
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="px-0 pb-0 bg-slate-50/50 dark:bg-slate-900/20 border-t border-border/40">
                    <div className="p-3 grid gap-3">
                      {company.users.map((user) => {
                        const isExpanded = expandedUserIds.includes(user.userId)
                        
                        return (
                          <div key={user.userId} className={cn("rounded-2xl border transition-all duration-300 overflow-hidden bg-background shadow-sm hover:shadow-md", isExpanded ? "border-indigo-300 ring-1 ring-indigo-100" : "border-transparent")}>
                            
                            {/* En-tête Utilisateur */}
                            <div 
                              onClick={() => toggleUserLogs(user.userId)}
                              className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/30"
                            >
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-white flex items-center justify-center text-slate-700 text-xs font-bold border border-slate-200 shadow-sm">
                                    {user.userName.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-[3px] border-white dark:border-slate-900 rounded-full"></span>
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-sm text-foreground">{user.userName}</p>
                                    <Badge variant="outline" className="text-[9px] h-4 px-1 rounded-md font-normal text-muted-foreground uppercase tracking-wide">{user.userRole}</Badge>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                                    {user.logs.length} événements récents
                                  </p>
                                </div>
                              </div>
                              <div className={cn("w-8 h-8 flex items-center justify-center rounded-full transition-all duration-300", isExpanded ? "bg-indigo-100 text-indigo-600 rotate-180" : "bg-muted/50 text-muted-foreground")}>
                                <ChevronDown className="w-4 h-4" />
                              </div>
                            </div>

                            {/* Timeline des Logs */}
                            {isExpanded && (
                              <div className="bg-slate-50/80 dark:bg-slate-950/30 p-4 border-t border-border/50">
                                <div className="relative pl-2 space-y-6">
                                    {/* Ligne verticale de timeline */}
                                    <div className="absolute left-[19px] top-3 bottom-6 w-0.5 bg-gradient-to-b from-indigo-200 to-transparent dark:from-indigo-900" />

                                    {user.logs.map((log, idx) => (
                                        <div key={log.id} className="relative flex gap-4 items-start group animate-in slide-in-from-left-2" style={{ animationDelay: `${idx * 50}ms` }}>
                                            {/* Point sur la timeline */}
                                            <div className="z-10 w-3 h-3 rounded-full bg-white border-[3px] border-indigo-400 mt-1.5 shrink-0 group-hover:scale-125 group-hover:border-indigo-600 transition-all shadow-sm ring-2 ring-white dark:ring-slate-900" />
                                            
                                            <div className="flex-1 min-w-0 bg-white dark:bg-card p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] hover:shadow-md transition-shadow">
                                                <div className="flex justify-between items-center mb-2">
                                                    <Badge variant="secondary" className={cn("text-[10px] px-2 py-0.5 gap-1.5 font-bold border", getActionStyle(log.action))}>
                                                        {getActionIcon(log.action)}
                                                        {log.action}
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground font-mono bg-muted/30 px-1.5 py-0.5 rounded-md border border-border/50">
                                                        {format(new Date(log.timestamp), "HH:mm")}
                                                    </span>
                                                </div>
                                                
                                                <p className="text-sm text-foreground/80 leading-snug font-medium">{log.details}</p>
                                                
                                                <div className="mt-2.5 pt-2 border-t border-dashed border-border/60 flex items-center gap-4 text-[10px] text-muted-foreground">
                                                    {log.device && (
                                                        <span className="flex items-center gap-1.5 bg-muted/20 px-2 py-0.5 rounded-full">
                                                            {log.device.toLowerCase().includes("mobile") ? <Smartphone className="w-3 h-3 text-slate-400"/> : <Laptop className="w-3 h-3 text-slate-400"/>}
                                                            {log.device}
                                                        </span>
                                                    )}
                                                    <span className="flex items-center gap-1.5">
                                                        <CalendarDays className="w-3 h-3 text-slate-400"/>
                                                        {format(new Date(log.timestamp), "d MMM", { locale: fr })}
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
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-white dark:bg-card rounded-3xl border border-dashed border-border/60 shadow-sm">
                <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4 animate-pulse">
                    <Activity className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="font-medium">Aucune activité enregistrée</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Les connexions apparaîtront ici en temps réel.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "users" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            
            {/* ORPHELINS (FERMÉ PAR DÉFAUT + STYLE D'ALERTE) */}
            {orphanedUsers.length > 0 && (
                <Accordion type="single" collapsible className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900 rounded-2xl shadow-sm overflow-hidden">
                    <AccordionItem value="orphans" className="border-none">
                        <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-amber-100/50 transition-colors">
                            <div className="flex items-center gap-3 text-amber-800 dark:text-amber-200">
                                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div className="text-left">
                                    <span className="font-bold text-sm block">En attente d'affectation</span>
                                    <span className="text-xs font-normal opacity-80">{orphanedUsers.length} utilisateurs sans entreprise</span>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 pt-0">
                            <div className="space-y-2 mt-2">
                                {orphanedUsers.map(user => (
                                    <div key={user.id} className="flex justify-between items-center p-3 rounded-xl bg-white dark:bg-card border border-amber-100 dark:border-amber-900/30 shadow-sm">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs border-2 border-white shadow-sm">{user.avatar}</div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm text-foreground truncate">{user.name}</p>
                                                <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" onClick={() => handleDeleteUser(user.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                            <Button size="icon" variant="secondary" className="h-8 w-8 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full shadow-sm" onClick={() => setSelectedUser(user)}>
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

             {/* LISTE PRINCIPALE UTILISATEURS */}
            <div className="space-y-4">
               <div className="flex items-center justify-between px-1">
                   <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Équipes par structure</h3>
                   <Badge variant="outline" className="text-[10px]">{filteredUsers.length} total</Badge>
               </div>
               
               <Accordion type="multiple" className="space-y-3">
                {filteredCompanies.map(company => {
                    const companyUsers = filteredUsers.filter(u => u.companyId === company.id);
                    if (companyUsers.length === 0 && searchQuery) return null;
                    
                    return (
                        <AccordionItem key={company.id} value={company.id} className="border-none rounded-2xl bg-white dark:bg-card shadow-sm border border-black/5 overflow-hidden">
                            <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-3 text-left w-full">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-primary font-bold text-xs shrink-0 border border-primary/10">
                                        {company.logo}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm truncate">{company.name}</p>
                                        <p className="text-[10px] text-muted-foreground font-medium">{companyUsers.length} collaborateurs</p>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-0 pb-0 bg-slate-50/50 border-t border-border/50">
                                <div className="divide-y divide-border/40">
                                    {companyUsers.map(user => (
                                        <div key={user.id} className="p-3 pl-5 flex items-center justify-between hover:bg-white transition-colors group">
                                            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedUser(user)}>
                                                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm group-hover:scale-105 transition-transform">
                                                    {user.avatar}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{user.name}</p>
                                                    <p className="text-[10px] text-muted-foreground capitalize">{user.role.replace('_', ' ')}</p>
                                                </div>
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="rounded-xl">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleImpersonate(user.id)}>
                                                        <LogIn className="w-4 h-4 mr-2" /> Se connecter
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleSendResetEmail(user.email, user.name)}>
                                                        <KeyRound className="w-4 h-4 mr-2" /> Reset MDP
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => setSelectedUser(user)}>
                                                        <Settings className="w-4 h-4 mr-2" /> Profil complet
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
        
         {activeTab === "companies" && (
          <div className="space-y-3">
             <Dialog open={isAddCompanyOpen} onOpenChange={setIsAddCompanyOpen}>
                <DialogTrigger asChild><Button className="w-full rounded-xl border-dashed border-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 shadow-none"><Plus className="w-4 h-4 mr-2" /> Ajouter une entreprise</Button></DialogTrigger>
                <DialogContent className="max-w-sm rounded-3xl">
                    <DialogHeader><DialogTitle>Nouvelle Entreprise</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1"><Label>Nom</Label><Input value={newCompany.name} onChange={e => setNewCompany({...newCompany, name: e.target.value})} placeholder="Ex: Ma Boite SAS" /></div>
                        <div className="space-y-1"><Label>Secteur</Label><Input value={newCompany.industry} onChange={e => setNewCompany({...newCompany, industry: e.target.value})} placeholder="Ex: Restauration" /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1"><Label>Plan</Label><Select onValueChange={v => setNewCompany({...newCompany, plan: v as any})} defaultValue="starter"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="starter">Starter</SelectItem><SelectItem value="pro">Pro</SelectItem><SelectItem value="enterprise">Enterprise</SelectItem></SelectContent></Select></div>
                            <div className="space-y-1"><Label>Statut</Label><Select onValueChange={v => setNewCompany({...newCompany, status: v as any})} defaultValue="active"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Actif</SelectItem><SelectItem value="suspended">Suspendu</SelectItem><SelectItem value="trial">Essai</SelectItem></SelectContent></Select></div>
                        </div>
                    </div>
                    <Button onClick={handleCreateCompany} disabled={!newCompany.name}>Créer</Button>
                </DialogContent>
            </Dialog>
            {filteredCompanies.map((company) => (
              <div key={company.id} className="pulse-card p-4 cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedCompany(company)}>
                <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center shrink-0"><span className="text-sm font-bold text-white">{company.logo}</span></div><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><h3 className="font-semibold text-sm truncate">{company.name}</h3>{getStatusBadge(company.status)}</div><div className="flex items-center gap-2 mt-1"><span className="text-xs text-muted-foreground">{company.industry}</span><span className="text-muted-foreground">•</span><span className="text-xs text-muted-foreground">{company.usersCount} utilisateurs</span></div></div><ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" /></div>
              </div>
            ))}
          </div>
        )}

      </main>
      
      {/* DRAWER D'ÉDITION GLOBAL */}
      {editingUser && (
        <UserEditDrawer 
            user={editingUser} 
            onClose={() => setEditingUser(null)} 
            onSave={handleFullUpdateUser} 
        />
      )}

      {/* DRAWER DÉTAIL ENTREPRISE (Remis car il manquait) */}
      {selectedCompany && !selectedUser && (
        <div className="fixed inset-0 bg-background z-50 overflow-y-auto animate-in slide-in-from-right">
             <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
              <button onClick={() => setSelectedCompany(null)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" /> Retour
              </button>
              <div className="pulse-card p-4 space-y-4">
                 <div className="flex items-start gap-4">
                   <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                     <span className="text-xl font-bold text-white">{selectedCompany.logo}</span>
                   </div>
                   <div className="flex-1">
                     <h1 className="text-xl font-bold">{selectedCompany.name}</h1>
                     <p className="text-sm text-muted-foreground">{selectedCompany.industry}</p>
                   </div>
                 </div>
                 <div className="flex gap-2 pt-2 border-t border-border">
                    <Button variant="outline" className="flex-1 text-xs h-8"><Edit3 className="w-3 h-3 mr-2" /> Éditer</Button>
                    <Button variant="destructive" className="text-xs h-8" onClick={() => setIsDeleteConfirmOpen(true)}><Trash2 className="w-3 h-3 mr-2" /> Supprimer</Button>
                 </div>
              </div>
              
              <div className="pulse-card p-4">
                <h2 className="font-semibold mb-4">Modules</h2>
                <div className="space-y-3">
                   {selectedCompany.features.map((feature) => (
                      <div key={feature.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                        <span className="text-sm font-medium">{feature.name}</span>
                        <Switch checked={feature.enabled} onCheckedChange={() => toggleFeature(selectedCompany.id, feature.id)} />
                      </div>
                   ))}
                </div>
              </div>
             </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

// --- COMPOSANT FORMULAIRE D'ÉDITION (Drawer) ---
function UserEditDrawer({ user, onClose, onSave }: { user: any, onClose: () => void, onSave: (data: any) => void }) {
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
            <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom">
                <div className="sticky top-0 bg-card rounded-t-3xl p-4 border-b border-border z-10 flex justify-between items-center">
                    <h2 className="font-semibold text-lg">Modifier l'utilisateur</h2>
                    <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
                </div>
                <div className="p-5 space-y-5 pb-10">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><label className="text-sm font-medium">Prénom</label><Input value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
                        <div className="space-y-2"><label className="text-sm font-medium">Nom</label><Input value={lastName} onChange={e => setLastName(e.target.value)} /></div>
                    </div>
                    <div className="space-y-2"><label className="text-sm font-medium">Email</label><Input value={email} onChange={e => setEmail(e.target.value)} /></div>
                    <Button className="w-full py-6 text-lg rounded-xl mt-4" onClick={handleSave}><Save className="w-5 h-5 mr-2" /> Enregistrer</Button>
                </div>
            </div>
        </>
    )
}

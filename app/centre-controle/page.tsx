"use client"

import { useState, useEffect } from "react"
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
  User, Lock, Save, X, Clock
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

// Imports Firebase
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore"
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
  role: "employe" | "assistant_manager" | "manager" | "directeur" | "gerant"
  companyId: string
  companyName: string
  contractHours?: number
  status: "active" | "inactive" | "suspended"
  lastLogin: any
  createdAt: string
}

interface ConnectionLog {
  id: string
  userId: string
  userName: string
  companyName: string
  action: string
  device: string
  browser: string
  ip: string
  location: string
  timestamp: string
  success: boolean
}

// Fonctionnalités par défaut
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
  const [activeTab, setActiveTab] = useState<TabType>("overview")
  const [searchQuery, setSearchQuery] = useState("")
  
  // Sélections & Édition
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null) // Pour le drawer d'édition
  
  // Modales & Collapsibles
  const [isAddCompanyOpen, setIsAddCompanyOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isCompanySelectorOpen, setIsCompanySelectorOpen] = useState(false)
  const [companySearchQuery, setCompanySearchQuery] = useState("")
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  // Données Firebase
  const [companiesState, setCompaniesState] = useState<Company[]>([])
  const [usersState, setUsersState] = useState<User[]>([])
  const [logsState, setLogsState] = useState<ConnectionLog[]>([])

  // Formulaire Nouvelle Entreprise
  const [newCompany, setNewCompany] = useState({
    name: "",
    industry: "",
    plan: "starter",
    status: "active",
    contactEmail: ""
  })

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

  // --- ACTIONS SUPER ADMIN ---

  // 1. Mise à jour complète utilisateur via API
  const handleFullUpdateUser = async (formData: any) => {
    try {
        const res = await fetch("/api/admin/invite-user", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
               uid: editingUser?.id,
               ...formData
            }),
        });
        
        if (!res.ok) throw new Error("Erreur API");
        
        setEditingUser(null);
        toast({ title: "Utilisateur mis à jour", description: "Les informations ont été synchronisées." });
    } catch (error) {
        console.error(error);
        toast({ title: "Erreur", description: "Échec de la mise à jour.", variant: "destructive" });
    }
  };

  // 2. Se connecter en tant que (Impersonate)
  const handleImpersonate = async (uid: string) => {
    if (!confirm("⚠️ ATTENTION : Vous allez être déconnecté de votre compte Admin et connecté en tant que cet utilisateur.")) return;
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

  // 3. Reset Mot de Passe (API)
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

  // --- ACTIONS FIREBASE EXISTANTES ---

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
      toast({ title: "Erreur", description: "Impossible de créer l'entreprise.", variant: "destructive" })
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
      toast({ title: "Erreur", description: "La mise à jour a échoué.", variant: "destructive" })
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
        toast({ title: "Erreur", description: "Impossible de supprimer le compte.", variant: "destructive" });
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

  // --- CHARGEMENT DES DONNÉES ---

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

    const unsubLogs = onSnapshot(query(collection(db, "logs"), orderBy("timestamp", "desc")), (snapshot) => {
      setLogsState(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ConnectionLog)))
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

  // --- VUE DÉTAIL ENTREPRISE ---
  if (selectedCompany) {
    const companyUsers = usersState.filter(u => u.companyId === selectedCompany.id)
    return (
      <div className="min-h-screen bg-background pb-32">
        <Header />
        <main className="px-4 py-6 max-w-lg mx-auto space-y-4">
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
                <Button variant="outline" className="flex-1 text-xs h-8"><Edit3 className="w-3 h-3 mr-2" /> Éditer</Button>
                <Button variant="destructive" className="text-xs h-8 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200" onClick={() => setIsDeleteConfirmOpen(true)}>
                    <Trash2 className="w-3 h-3 mr-2" /> Supprimer
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
                    <Switch checked={feature.enabled} onCheckedChange={() => toggleFeature(selectedCompany.id, feature.id)} />
                  </div>
              ))}
            </div>
          </div>

          <div className="pulse-card p-4">
             <h2 className="font-semibold mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Utilisateurs ({companyUsers.length})</h2>
            <div className="space-y-2">
                {companyUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary cursor-pointer" onClick={() => { setSelectedCompany(null); setSelectedUser(u); }}>{u.avatar}</div>
                        <div className="flex-1 cursor-pointer" onClick={() => { setSelectedCompany(null); setSelectedUser(u); }}>
                            <div className="flex items-center gap-2"><p className="text-sm font-medium">{u.name}</p>{getStatusBadge(u.status)}</div>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => { setSelectedCompany(null); setSelectedUser(u); }}><Edit3 className="w-4 h-4 mr-2" /> Détails</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSendResetEmail(u.email, u.name)}><KeyRound className="w-4 h-4 mr-2" /> Reset MDP</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleImpersonate(u.id)}><LogIn className="w-4 h-4 mr-2" /> Se connecter en tant que</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ))}
            </div>
          </div>
        </main>
        <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
            <DialogContent className="max-w-xs rounded-2xl">
                <DialogHeader><DialogTitle>Supprimer l'entreprise ?</DialogTitle></DialogHeader>
                <p className="text-sm text-muted-foreground">Action irréversible.</p>
                <DialogFooter className="flex gap-2"><Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Annuler</Button><Button variant="destructive" onClick={handleDeleteCompany}>Confirmer</Button></DialogFooter>
            </DialogContent>
        </Dialog>
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
            <button onClick={() => setSelectedUser(null)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" /> Retour
            </button>

            <div className="pulse-card p-5">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl font-bold text-white">{selectedUser.avatar}</div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold">{selectedUser.name}</h1>
                                {/* BOUTON MODIFIER */}
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-full" onClick={() => setEditingUser(selectedUser)}>
                                    <Edit3 className="w-3 h-3 text-muted-foreground" />
                                </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                            <div className="mt-1">{getStatusBadge(selectedUser.status)}</div>
                        </div>
                    </div>
                    {/* Bouton Action Rapide */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="rounded-xl"><MoreHorizontal className="w-5 h-5 text-muted-foreground" /></Button>
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
                        <Label className="text-xs text-muted-foreground uppercase font-bold">Entreprise</Label>
                        <Dialog open={isCompanySelectorOpen} onOpenChange={setIsCompanySelectorOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full justify-between h-12 text-left font-normal border-muted-foreground/20 bg-muted/30">
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
                                        <div key={c.id} className={cn("flex items-center gap-3 p-3 rounded-xl hover:bg-muted cursor-pointer mb-1", selectedUser.companyId === c.id && "bg-primary/5 border border-primary/20")} onClick={() => { handleUpdateUserSimple(selectedUser.id, { companyId: c.id }); setIsCompanySelectorOpen(false); }}>
                                            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-xs font-bold shadow-sm">{c.logo}</div>
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
                            <Label className="text-xs text-muted-foreground uppercase font-bold">Rôle</Label>
                            <Select value={selectedUser.role} onValueChange={(val) => handleUpdateUserSimple(selectedUser.id, { role: val })}>
                                <SelectTrigger className="w-full h-10 rounded-xl bg-muted/30"><SelectValue /></SelectTrigger>
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
                            <Label className="text-xs text-muted-foreground uppercase font-bold">Statut</Label>
                            <Select value={selectedUser.status === "suspended" ? "suspended" : "active"} onValueChange={(val) => handleUpdateUserSimple(selectedUser.id, { disabled: val === "suspended" })}>
                                <SelectTrigger className="w-full h-10 rounded-xl bg-muted/30"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="active">Actif</SelectItem><SelectItem value="suspended">Suspendu</SelectItem></SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Historique Pliable */}
            <div className="pulse-card overflow-hidden">
                <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                    <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setIsHistoryOpen(!isHistoryOpen)}>
                        <h3 className="font-semibold flex items-center gap-2"><History className="w-4 h-4 text-primary" /> Historique d'activité</h3>
                        <CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="h-6 w-6 p-0"><ChevronDown className={cn("w-4 h-4 transition-transform", isHistoryOpen && "rotate-180")} /></Button></CollapsibleTrigger>
                    </div>
                    <CollapsibleContent>
                        <div className="px-4 pb-4 space-y-3 pt-0">
                            {userLogs.length === 0 && <p className="text-sm text-muted-foreground">Aucune donnée.</p>}
                            {userLogs.slice(0, 5).map(log => (
                                <div key={log.id} className="flex gap-3 text-sm bg-muted/30 p-2 rounded-lg">
                                    <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", log.success ? "bg-emerald-500" : "bg-red-500")} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between">
                                            <p className="font-medium truncate">{log.action}</p>
                                            <span className="text-xs text-muted-foreground">{log.timestamp?.split(" ")[1]}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">{log.browser} • {log.ip}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </div>
        </main>
        
        {/* DRAWER D'ÉDITION UTILISATEUR */}
        {editingUser && (
            <UserEditDrawer 
                user={editingUser} 
                onClose={() => setEditingUser(null)} 
                onSave={handleFullUpdateUser} 
            />
        )}

        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <Header />
      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center"><Shield className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-2xl font-bold tracking-tight">Centre de contrôle</h1><p className="text-sm text-muted-foreground">Super Admin</p></div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted/50 rounded-xl overflow-x-auto">
          {[{ id: "overview", icon: BarChart3, label: "Vue d'ensemble" }, { id: "companies", icon: Building2, label: "Entreprises" }, { id: "users", icon: Users, label: "Utilisateurs" }, { id: "logs", icon: History, label: "Connexions" }].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={cn("flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap", activeTab === tab.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}><tab.icon className="w-4 h-4" /><span className="hidden sm:inline">{tab.label}</span></button>
          ))}
        </div>

        {/* Search */}
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-xl" /></div>

        {/* --- ONGLETS --- */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="pulse-card p-4"><div className="flex items-center gap-2 mb-2"><Building2 className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Entreprises</span></div><p className="text-2xl font-bold">{companiesState.length}</p><p className="text-xs text-emerald-500">{activeCompanies} actives</p></div>
              <div className="pulse-card p-4"><div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-accent" /><span className="text-xs text-muted-foreground">Utilisateurs</span></div><p className="text-2xl font-bold">{usersState.length}</p><p className="text-xs text-emerald-500">{activeUsers} actifs</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="pulse-card p-4 border-l-4 border-slate-300"><div className="flex items-center gap-2 mb-2"><UserX className="w-4 h-4 text-slate-500" /><span className="text-xs text-muted-foreground">Orphelins</span></div><p className="text-2xl font-bold text-slate-600">{orphanedUsers.length}</p><p className="text-[10px] text-muted-foreground">Sans entreprise</p></div>
                <div className="pulse-card p-4"><div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-blue-500" /><span className="text-xs text-muted-foreground">Remplissage</span></div><p className="text-2xl font-bold">{companiesState.length > 0 ? Math.round(usersState.length / companiesState.length) : 0}</p><p className="text-[10px] text-muted-foreground">Moy. users / société</p></div>
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

        {/* ONGLETS UTILISATEURS */}
        {activeTab === "users" && (
          <div className="space-y-6">
            {orphanedUsers.length > 0 && (
                <Accordion type="single" collapsible defaultValue="orphans" className="border rounded-xl bg-slate-50/50 border-slate-200">
                    <AccordionItem value="orphans" className="border-none">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                            <div className="flex items-center gap-2 text-slate-700">
                                <AlertCircle className="w-4 h-4 text-slate-500" />
                                <span className="font-semibold text-sm">En attente d'affectation ({orphanedUsers.length})</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-3 pb-3 pt-0">
                            <div className="space-y-2">
                                {orphanedUsers.map(user => (
                                    <div key={user.id} className="flex justify-between items-center p-2 rounded-lg bg-white border border-slate-100 shadow-sm">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">{user.avatar}</div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm text-slate-700 truncate">{user.name}</p>
                                                <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
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
               <h3 className="text-sm font-semibold text-foreground px-1">Équipes par entreprise</h3>
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
                                        <div key={user.id} className="p-3 flex items-center justify-between hover:bg-muted/20">
                                            <div className="flex items-center gap-3" onClick={() => setSelectedUser(user)}>
                                                <div className="w-7 h-7 rounded-full bg-white border flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                                    {user.avatar}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">{user.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">{user.role}</p>
                                                </div>
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions Super Admin</DropdownMenuLabel>
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
          <div className="space-y-3">
            {logsState.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Aucun log récent.</p>}
            {logsState.map((log) => (
              <div key={log.id} className="pulse-card p-3 flex items-center gap-3"><div className={cn("w-2 h-2 rounded-full", log.success ? "bg-emerald-500" : "bg-red-500")} /><div className="flex-1"><p className="text-sm font-medium">{log.userName}</p><p className="text-xs text-muted-foreground">{log.action}</p></div><span className="text-xs text-muted-foreground">{log.timestamp?.split(" ")[1]}</span></div>
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

      <BottomNav />
    </div>
  )
}

// --- COMPOSANT FORMULAIRE D'ÉDITION (Drawer) ---
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
            <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom">
                <div className="sticky top-0 bg-card rounded-t-3xl p-4 border-b border-border z-10 flex justify-between items-center">
                    <h2 className="font-semibold text-lg">Modifier l'utilisateur</h2>
                    <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
                </div>

                <div className="p-5 space-y-5 pb-10">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2"><User className="w-4 h-4"/> Prénom</label>
                            <Input value={firstName} onChange={e => setFirstName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nom</label>
                            <Input value={lastName} onChange={e => setLastName(e.target.value)} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2"><Mail className="w-4 h-4"/> Email (Connexion)</label>
                        <Input value={email} onChange={e => setEmail(e.target.value)} />
                        <p className="text-xs text-muted-foreground">Attention: modifier l'email changera ses identifiants de connexion.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2"><Shield className="w-4 h-4"/> Rôle</label>
                            <Select value={role} onValueChange={setRole}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
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
                            <label className="text-sm font-medium flex items-center gap-2"><Clock className="w-4 h-4"/> Heures Contrat</label>
                            <Input type="number" value={contractHours} onChange={e => setContractHours(Number(e.target.value))} />
                        </div>
                    </div>

                    <Button className="w-full py-6 text-lg rounded-xl mt-4" onClick={handleSave}>
                        <Save className="w-5 h-5 mr-2" /> Enregistrer les modifications
                    </Button>
                </div>
            </div>
        </>
    )
}

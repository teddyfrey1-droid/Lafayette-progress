"use client"

import { useState } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import {
  Shield,
  Users,
  Search,
  Building2,
  ChevronRight,
  Eye,
  Ban,
  Trash2,
  Edit3,
  CheckCircle2,
  XCircle,
  Activity,
  TrendingUp,
  UserPlus,
  LogIn,
  Monitor,
  Smartphone,
  MapPin,
  Calendar,
  Mail,
  Phone,
  ArrowLeft,
  Settings,
  History,
  BarChart3,
  Globe,
  Truck,
  Target,
  Coins,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"

// Types
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
  email: string
  avatar: string
  role: "admin" | "manager" | "user"
  companyId: string
  companyName: string
  status: "active" | "inactive" | "suspended"
  lastLogin: string
  createdAt: string
}

interface ConnectionLog {
  id: string
  userId: string
  userName: string
  userEmail: string
  companyName: string
  action: "login" | "logout" | "failed_login" | "password_reset"
  device: "desktop" | "mobile" | "tablet"
  browser: string
  ip: string
  location: string
  timestamp: string
  success: boolean
}

// Default features that can be enabled/disabled per company
const defaultFeatures: Omit<CompanyFeature, "enabled">[] = [
  {
    id: "sites-contacts",
    name: "Sites & Contacts",
    description: "Raccourcis et contacts utiles",
    icon: Globe,
    isDefault: true,
  },
  {
    id: "fournisseurs",
    name: "Fournisseurs",
    description: "Gestion des contacts fournisseurs",
    icon: Truck,
    isDefault: true,
  },
  { id: "objectifs", name: "Objectifs", description: "Suivi des objectifs et paliers", icon: Target, isDefault: true },
  { id: "primes", name: "Primes", description: "Historique et calcul des primes", icon: Coins, isDefault: true },
  { id: "equipes", name: "Équipes", description: "Gestion des collaborateurs", icon: Users, isDefault: true },
  {
    id: "diffusion",
    name: "Relevés température",
    description: "Suivi des températures frigos",
    icon: FileText,
    isDefault: false,
  },
]

// Demo data - Companies
const companies: Company[] = [
  {
    id: "c1",
    name: "Heiko Poké",
    logo: "HP",
    plan: "enterprise",
    status: "active",
    usersCount: 24,
    createdAt: "2024-01-15",
    lastActivity: "Il y a 2 min",
    industry: "Restauration",
    contactEmail: "contact@heiko-poke.com",
    contactPhone: "+33 6 12 34 56 78",
    features: defaultFeatures.map((f) => ({ ...f, enabled: f.isDefault })),
  },
  {
    id: "c2",
    name: "TechStartup SAS",
    logo: "TS",
    plan: "pro",
    status: "active",
    usersCount: 12,
    createdAt: "2024-03-22",
    lastActivity: "Il y a 1h",
    industry: "Tech",
    contactEmail: "admin@techstartup.fr",
    contactPhone: "+33 6 98 76 54 32",
    features: defaultFeatures.map((f) => ({ ...f, enabled: f.isDefault })),
  },
  {
    id: "c3",
    name: "Boulangerie Martin",
    logo: "BM",
    plan: "starter",
    status: "trial",
    usersCount: 5,
    createdAt: "2025-01-02",
    lastActivity: "Il y a 3h",
    industry: "Commerce",
    contactEmail: "martin@boulangerie.fr",
    contactPhone: "+33 6 55 44 33 22",
    features: defaultFeatures.map((f) => ({ ...f, enabled: f.isDefault })),
  },
  {
    id: "c4",
    name: "Fitness Club Paris",
    logo: "FC",
    plan: "pro",
    status: "suspended",
    usersCount: 8,
    createdAt: "2024-06-10",
    lastActivity: "Il y a 15 jours",
    industry: "Sport",
    contactEmail: "contact@fitnessclub.fr",
    contactPhone: "+33 6 11 22 33 44",
    features: defaultFeatures.map((f) => ({ ...f, enabled: f.isDefault })),
  },
]

// Demo data - Users
const users: User[] = [
  {
    id: "u1",
    name: "Florian Nappo",
    email: "florian@heiko-poke.com",
    avatar: "FN",
    role: "admin",
    companyId: "c1",
    companyName: "Heiko Poké",
    status: "active",
    lastLogin: "Il y a 2 min",
    createdAt: "2024-01-15",
  },
  {
    id: "u2",
    name: "Julien Martin",
    email: "julien@heiko-poke.com",
    avatar: "JM",
    role: "admin",
    companyId: "c1",
    companyName: "Heiko Poké",
    status: "active",
    lastLogin: "Il y a 30 min",
    createdAt: "2024-01-15",
  },
  {
    id: "u3",
    name: "Marie Dupont",
    email: "marie@heiko-poke.com",
    avatar: "MD",
    role: "manager",
    companyId: "c1",
    companyName: "Heiko Poké",
    status: "active",
    lastLogin: "Il y a 1h",
    createdAt: "2024-02-10",
  },
  {
    id: "u4",
    name: "Lucas Bernard",
    email: "lucas@heiko-poke.com",
    avatar: "LB",
    role: "user",
    companyId: "c1",
    companyName: "Heiko Poké",
    status: "inactive",
    lastLogin: "Il y a 5 jours",
    createdAt: "2024-03-05",
  },
  {
    id: "u5",
    name: "Sophie Tech",
    email: "sophie@techstartup.fr",
    avatar: "ST",
    role: "admin",
    companyId: "c2",
    companyName: "TechStartup SAS",
    status: "active",
    lastLogin: "Il y a 1h",
    createdAt: "2024-03-22",
  },
  {
    id: "u6",
    name: "Pierre Dev",
    email: "pierre@techstartup.fr",
    avatar: "PD",
    role: "user",
    companyId: "c2",
    companyName: "TechStartup SAS",
    status: "active",
    lastLogin: "Il y a 2h",
    createdAt: "2024-04-01",
  },
  {
    id: "u7",
    name: "Jean Martin",
    email: "jean@boulangerie.fr",
    avatar: "JM",
    role: "admin",
    companyId: "c3",
    companyName: "Boulangerie Martin",
    status: "active",
    lastLogin: "Il y a 3h",
    createdAt: "2025-01-02",
  },
  {
    id: "u8",
    name: "Claire Fitness",
    email: "claire@fitnessclub.fr",
    avatar: "CF",
    role: "admin",
    companyId: "c4",
    companyName: "Fitness Club Paris",
    status: "suspended",
    lastLogin: "Il y a 15 jours",
    createdAt: "2024-06-10",
  },
]

// Demo data - Connection logs
const connectionLogs: ConnectionLog[] = [
  {
    id: "l1",
    userId: "u1",
    userName: "Florian Nappo",
    userEmail: "florian@heiko-poke.com",
    companyName: "Heiko Poké",
    action: "login",
    device: "desktop",
    browser: "Chrome 120",
    ip: "92.184.xxx.xxx",
    location: "Paris, France",
    timestamp: "12/01/2025 14:32",
    success: true,
  },
  {
    id: "l2",
    userId: "u2",
    userName: "Julien Martin",
    userEmail: "julien@heiko-poke.com",
    companyName: "Heiko Poké",
    action: "login",
    device: "mobile",
    browser: "Safari iOS",
    ip: "86.215.xxx.xxx",
    location: "Lyon, France",
    timestamp: "12/01/2025 14:15",
    success: true,
  },
  {
    id: "l3",
    userId: "u5",
    userName: "Sophie Tech",
    userEmail: "sophie@techstartup.fr",
    companyName: "TechStartup SAS",
    action: "login",
    device: "desktop",
    browser: "Firefox 121",
    ip: "77.136.xxx.xxx",
    location: "Marseille, France",
    timestamp: "12/01/2025 13:45",
    success: true,
  },
  {
    id: "l4",
    userId: "u1",
    userName: "Florian Nappo",
    userEmail: "florian@heiko-poke.com",
    companyName: "Heiko Poké",
    action: "logout",
    device: "desktop",
    browser: "Chrome 120",
    ip: "92.184.xxx.xxx",
    location: "Paris, France",
    timestamp: "12/01/2025 12:00",
    success: true,
  },
  {
    id: "l5",
    userId: "u8",
    userName: "Claire Fitness",
    userEmail: "claire@fitnessclub.fr",
    companyName: "Fitness Club Paris",
    action: "failed_login",
    device: "mobile",
    browser: "Chrome Android",
    ip: "90.112.xxx.xxx",
    location: "Paris, France",
    timestamp: "11/01/2025 18:30",
    success: false,
  },
  {
    id: "l6",
    userId: "u3",
    userName: "Marie Dupont",
    userEmail: "marie@heiko-poke.com",
    companyName: "Heiko Poké",
    action: "password_reset",
    device: "desktop",
    browser: "Chrome 120",
    ip: "92.184.xxx.xxx",
    location: "Paris, France",
    timestamp: "11/01/2025 10:15",
    success: true,
  },
  {
    id: "l7",
    userId: "u7",
    userName: "Jean Martin",
    userEmail: "jean@boulangerie.fr",
    companyName: "Boulangerie Martin",
    action: "login",
    device: "tablet",
    browser: "Safari iPad",
    ip: "88.165.xxx.xxx",
    location: "Bordeaux, France",
    timestamp: "11/01/2025 08:00",
    success: true,
  },
]

type TabType = "overview" | "companies" | "users" | "logs"

export default function CentreControlePage() {
  const [activeTab, setActiveTab] = useState<TabType>("overview")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [companiesState, setCompaniesState] = useState<Company[]>(companies)

  // Stats
  const totalCompanies = companiesState.length
  const activeCompanies = companiesState.filter((c) => c.status === "active").length
  const totalUsers = users.length
  const activeUsers = users.filter((u) => u.status === "active").length
  const todayLogins = connectionLogs.filter((l) => l.action === "login" && l.timestamp.includes("12/01/2025")).length

  // Filter functions
  const filteredCompanies = companiesState.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.industry.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.companyName.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const filteredLogs = connectionLogs.filter(
    (l) =>
      l.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.companyName.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  // Get users for a specific company
  const getCompanyUsers = (companyId: string) => users.filter((u) => u.companyId === companyId)

  // Get logs for a specific user
  const getUserLogs = (userId: string) => connectionLogs.filter((l) => l.userId === userId)

  // Toggle feature for a company
  const toggleFeature = (companyId: string, featureId: string) => {
    setCompaniesState(
      companiesState.map((company) => {
        if (company.id === companyId) {
          return {
            ...company,
            features: company.features.map((feature) =>
              feature.id === featureId ? { ...feature, enabled: !feature.enabled } : feature,
            ),
          }
        }
        return company
      }),
    )
    // Also update selectedCompany if it's the one being modified
    if (selectedCompany?.id === companyId) {
      setSelectedCompany({
        ...selectedCompany,
        features: selectedCompany.features.map((feature) =>
          feature.id === featureId ? { ...feature, enabled: !feature.enabled } : feature,
        ),
      })
    }
  }

  const getPlanBadge = (plan: Company["plan"]) => {
    switch (plan) {
      case "enterprise":
        return <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">Enterprise</Badge>
      case "pro":
        return <Badge className="bg-gradient-to-r from-primary to-accent text-white border-0">Pro</Badge>
      default:
        return <Badge variant="secondary">Starter</Badge>
    }
  }

  const getStatusBadge = (status: "active" | "inactive" | "suspended" | "trial") => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Actif</Badge>
      case "trial":
        return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">Essai</Badge>
      case "suspended":
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Suspendu</Badge>
      default:
        return <Badge variant="secondary">Inactif</Badge>
    }
  }

  const getDeviceIcon = (device: ConnectionLog["device"]) => {
    switch (device) {
      case "mobile":
        return <Smartphone className="w-4 h-4" />
      case "tablet":
        return <Monitor className="w-4 h-4" />
      default:
        return <Monitor className="w-4 h-4" />
    }
  }

  const getActionLabel = (action: ConnectionLog["action"]) => {
    switch (action) {
      case "login":
        return { label: "Connexion", color: "text-emerald-500" }
      case "logout":
        return { label: "Déconnexion", color: "text-muted-foreground" }
      case "failed_login":
        return { label: "Échec connexion", color: "text-red-500" }
      case "password_reset":
        return { label: "Réinit. MDP", color: "text-amber-500" }
    }
  }

  // Company Detail View with Features Management
  if (selectedCompany) {
    const companyUsers = getCompanyUsers(selectedCompany.id)
    const currentCompany = companiesState.find((c) => c.id === selectedCompany.id) || selectedCompany

    return (
      <div className="min-h-screen bg-background pb-24">
        <Header />
        <main className="px-4 py-6 max-w-lg mx-auto space-y-4">
          <button
            onClick={() => setSelectedCompany(null)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Retour</span>
          </button>

          {/* Company Header */}
          <div className="pulse-card p-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                <span className="text-xl font-bold text-white">{currentCompany.logo}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold">{currentCompany.name}</h1>
                  {getStatusBadge(currentCompany.status)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{currentCompany.industry}</p>
                <div className="flex items-center gap-2 mt-2">{getPlanBadge(currentCompany.plan)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="truncate text-muted-foreground">{currentCompany.contactEmail}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{currentCompany.contactPhone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Créé le {currentCompany.createdAt}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{currentCompany.lastActivity}</span>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" className="flex-1 rounded-xl bg-transparent">
                <Edit3 className="w-4 h-4 mr-2" />
                Modifier
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-amber-500 border-amber-500/30 hover:bg-amber-500/10 bg-transparent"
              >
                <Ban className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-red-500 border-red-500/30 hover:bg-red-500/10 bg-transparent"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Features Management */}
          <div className="pulse-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Fonctionnalités
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Activez ou désactivez les pages disponibles pour cette entreprise
            </p>
            <div className="space-y-3">
              {currentCompany.features.map((feature) => {
                const IconComponent = feature.icon
                return (
                  <div key={feature.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center",
                          feature.enabled ? "bg-primary/10" : "bg-muted",
                        )}
                      >
                        <IconComponent
                          className={cn("w-4 h-4", feature.enabled ? "text-primary" : "text-muted-foreground")}
                        />
                      </div>
                      <div>
                        <p className={cn("text-sm font-medium", !feature.enabled && "text-muted-foreground")}>
                          {feature.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{feature.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={feature.enabled}
                      onCheckedChange={() => toggleFeature(currentCompany.id, feature.id)}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Company Users */}
          <div className="pulse-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Utilisateurs ({companyUsers.length})
              </h2>
              <Button size="sm" className="rounded-xl h-8">
                <UserPlus className="w-4 h-4 mr-1" />
                Ajouter
              </Button>
            </div>
            <div className="space-y-2">
              {companyUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedCompany(null)
                    setSelectedUser(user)
                  }}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{user.avatar}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {getStatusBadge(user.status)}
                    <span className="text-[10px] text-muted-foreground capitalize">{user.role}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // User Detail View
  if (selectedUser) {
    const userLogs = getUserLogs(selectedUser.id)
    return (
      <div className="min-h-screen bg-background pb-24">
        <Header />
        <main className="px-4 py-6 max-w-lg mx-auto space-y-4">
          <button
            onClick={() => setSelectedUser(null)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Retour</span>
          </button>

          {/* User Header */}
          <div className="pulse-card p-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <span className="text-xl font-bold text-white">{selectedUser.avatar}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold">{selectedUser.name}</h1>
                  {getStatusBadge(selectedUser.status)}
                </div>
                <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="capitalize">
                    {selectedUser.role}
                  </Badge>
                  <span className="text-xs text-muted-foreground">• {selectedUser.companyName}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border">
              <div className="text-sm">
                <p className="text-muted-foreground text-xs">Dernière connexion</p>
                <p className="font-medium">{selectedUser.lastLogin}</p>
              </div>
              <div className="text-sm">
                <p className="text-muted-foreground text-xs">Membre depuis</p>
                <p className="font-medium">{selectedUser.createdAt}</p>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" className="flex-1 rounded-xl bg-transparent">
                <Eye className="w-4 h-4 mr-2" />
                Se connecter en tant que
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl bg-transparent">
                <Edit3 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* User Connection History */}
          <div className="pulse-card p-4">
            <h2 className="font-semibold flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-primary" />
              Historique de connexion
            </h2>
            <div className="space-y-3">
              {userLogs.length > 0 ? (
                userLogs.map((log) => {
                  const actionInfo = getActionLabel(log.action)
                  return (
                    <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center",
                          log.success ? "bg-emerald-500/20" : "bg-red-500/20",
                        )}
                      >
                        {log.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-medium", actionInfo.color)}>{actionInfo.label}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          {getDeviceIcon(log.device)}
                          <span>{log.browser}</span>
                          <span>•</span>
                          <span>{log.ip}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          <span>{log.location}</span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">{log.timestamp}</span>
                    </div>
                  )
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun historique</p>
              )}
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // Main View with Tabs
  const tabs = [
    { id: "overview" as TabType, label: "Vue d'ensemble", icon: BarChart3 },
    { id: "companies" as TabType, label: "Entreprises", icon: Building2 },
    { id: "users" as TabType, label: "Utilisateurs", icon: Users },
    { id: "logs" as TabType, label: "Connexions", icon: History },
  ]

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Centre de contrôle</h1>
            <p className="text-sm text-muted-foreground">Administration globale</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted/50 rounded-xl overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="pulse-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Entreprises</span>
                </div>
                <p className="text-2xl font-bold">{totalCompanies}</p>
                <p className="text-xs text-emerald-500">{activeCompanies} actives</p>
              </div>
              <div className="pulse-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-accent" />
                  <span className="text-xs text-muted-foreground">Utilisateurs</span>
                </div>
                <p className="text-2xl font-bold">{totalUsers}</p>
                <p className="text-xs text-emerald-500">{activeUsers} actifs</p>
              </div>
              <div className="pulse-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <LogIn className="w-4 h-4 text-chart-3" />
                  <span className="text-xs text-muted-foreground">Connexions</span>
                </div>
                <p className="text-2xl font-bold">{todayLogins}</p>
                <p className="text-xs text-muted-foreground">Aujourd'hui</p>
              </div>
              <div className="pulse-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-chart-4" />
                  <span className="text-xs text-muted-foreground">Taux activité</span>
                </div>
                <p className="text-2xl font-bold">{Math.round((activeUsers / totalUsers) * 100)}%</p>
                <p className="text-xs text-muted-foreground">Ce mois</p>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="pulse-card p-4">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Activité récente
              </h2>
              <div className="space-y-3">
                {connectionLogs.slice(0, 5).map((log) => {
                  const actionInfo = getActionLabel(log.action)
                  return (
                    <div key={log.id} className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center",
                          log.success ? "bg-emerald-500/20" : "bg-red-500/20",
                        )}
                      >
                        {log.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{log.userName}</p>
                        <p className={cn("text-xs", actionInfo.color)}>{actionInfo.label}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{log.timestamp.split(" ")[1]}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Companies Tab */}
        {activeTab === "companies" && (
          <div className="space-y-3">
            {filteredCompanies.map((company) => (
              <div
                key={company.id}
                className="pulse-card p-4 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedCompany(company)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-white">{company.logo}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm truncate">{company.name}</h3>
                      {getStatusBadge(company.status)}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{company.industry}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{company.usersCount} utilisateurs</span>
                    </div>
                    <div className="mt-2">{getPlanBadge(company.plan)}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
              </div>
            ))}

            {filteredCompanies.length === 0 && (
              <div className="pulse-card p-8 text-center">
                <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Aucune entreprise trouvée</p>
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="space-y-3">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="pulse-card p-4 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedUser(user)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white">{user.avatar}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm truncate">{user.name}</h3>
                      {getStatusBadge(user.status)}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{user.companyName}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="capitalize text-[10px]">
                      {user.role}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-1">{user.lastLogin}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
              </div>
            ))}

            {filteredUsers.length === 0 && (
              <div className="pulse-card p-8 text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Aucun utilisateur trouvé</p>
              </div>
            )}
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === "logs" && (
          <div className="space-y-3">
            {filteredLogs.map((log) => {
              const actionInfo = getActionLabel(log.action)
              return (
                <div key={log.id} className="pulse-card p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        log.success ? "bg-emerald-500/20" : "bg-red-500/20",
                      )}
                    >
                      {log.success ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm truncate">{log.userName}</h3>
                        <span className={cn("text-xs font-medium", actionInfo.color)}>{actionInfo.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{log.companyName}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          {getDeviceIcon(log.device)}
                          <span>{log.browser}</span>
                        </div>
                        <span>•</span>
                        <span>{log.ip}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span>{log.location}</span>
                        <span className="ml-auto">{log.timestamp}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {filteredLogs.length === 0 && (
              <div className="pulse-card p-8 text-center">
                <History className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Aucun historique trouvé</p>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}

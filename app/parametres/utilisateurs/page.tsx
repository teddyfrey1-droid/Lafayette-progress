"use client"

import { useState } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { ArrowLeft, Users, Search, UserPlus, Edit3, X, Check, EyeOff, Eye, Shield, Mail, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { teamMembers, type TeamMember } from "@/lib/demo-data"

type UserStatus = "active" | "inactive" | "pending"

interface UserWithStatus extends TeamMember {
  status: UserStatus
  lastLogin?: Date
}

const usersWithStatus: UserWithStatus[] = teamMembers.map((member, index) => ({
  ...member,
  status: index === 3 ? "pending" : "active",
  lastLogin: index === 3 ? undefined : new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
}))

export default function UtilisateursPage() {
  const [users, setUsers] = useState<UserWithStatus[]>(usersWithStatus)
  const [searchQuery, setSearchQuery] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const activeUsers = users.filter((u) => u.status === "active").length
  const observerUsers = users.filter((u) => u.excludeFromPrimes).length

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="px-4 py-6 max-w-4xl mx-auto space-y-6">
        {/* Back link */}
        <Link
          href="/parametres"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Parametres</span>
        </Link>

        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Utilisateurs</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gestion des comptes et statuts utilisateurs</p>
          </div>
          <Button size="sm" className="rounded-xl gap-2" onClick={() => setShowAdd(true)}>
            <UserPlus className="w-4 h-4" />
            Ajouter
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="pulse-card p-4 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xl font-bold">{users.length}</p>
            <p className="text-[11px] text-muted-foreground">Total</p>
          </div>
          <div className="pulse-card p-4 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Check className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-xl font-bold">{activeUsers}</p>
            <p className="text-[11px] text-muted-foreground">Actifs</p>
          </div>
          <div className="pulse-card p-4 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <EyeOff className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-xl font-bold">{observerUsers}</p>
            <p className="text-[11px] text-muted-foreground">Observateurs</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un utilisateur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>

        {/* Info Banner */}
        <div className="pulse-card p-4 bg-gradient-to-r from-amber-500/5 to-amber-600/5 border-amber-500/20">
          <div className="flex gap-3">
            <EyeOff className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">Mode Observateur</p>
              <p>
                Les utilisateurs en mode observateur ont acces a l'application mais ne comptent pas dans le calcul des
                primes. Ideal pour les gerants ou superviseurs qui souhaitent suivre les performances sans participer au
                systeme de primes.
              </p>
            </div>
          </div>
        </div>

        {/* Users List */}
        <section className="space-y-3">
          <h2 className="font-semibold text-sm">Liste des utilisateurs</h2>

          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className={cn(
                "pulse-card overflow-hidden transition-all",
                user.excludeFromPrimes && "border-amber-500/30",
                user.status === "inactive" && "opacity-60",
              )}
            >
              <div className="p-4">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center shrink-0 relative">
                    <span className="text-sm font-bold text-white">
                      {user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                    {user.excludeFromPrimes && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center border-2 border-card">
                        <EyeOff className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-base truncate">{user.name}</h3>
                      {user.excludeFromPrimes && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 font-medium shrink-0">
                          Observateur
                        </span>
                      )}
                      {user.status === "pending" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 font-medium shrink-0">
                          En attente
                        </span>
                      )}
                      {user.status === "inactive" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium shrink-0">
                          Inactif
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        {user.role}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {user.contractHours}h/sem
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {user.email}
                    </p>
                    {user.lastLogin && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Derniere connexion:{" "}
                        {user.lastLogin.toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg shrink-0"
                    onClick={() => setEditingId(user.id)}
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Edit Panel */}
              {editingId === user.id && (
                <div className="p-4 pt-0 border-t border-border mt-4">
                  <UserEditPanel
                    user={user}
                    onSave={(updated) => {
                      setUsers(users.map((u) => (u.id === updated.id ? updated : u)))
                      setEditingId(null)
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              )}
            </div>
          ))}

          {filteredUsers.length === 0 && (
            <div className="pulse-card p-8 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Aucun utilisateur trouve</p>
            </div>
          )}
        </section>
      </main>

      {/* Add User Drawer */}
      {showAdd && (
        <AddUserDrawer
          onClose={() => setShowAdd(false)}
          onAdd={(newUser) => {
            setUsers([...users, { ...newUser, id: `u${Date.now()}`, status: "pending" as UserStatus }])
            setShowAdd(false)
          }}
        />
      )}

      <BottomNav />
    </div>
  )
}

function UserEditPanel({
  user,
  onSave,
  onCancel,
}: {
  user: UserWithStatus
  onSave: (user: UserWithStatus) => void
  onCancel: () => void
}) {
  const [role, setRole] = useState(user.role)
  const [contractHours, setContractHours] = useState(user.contractHours.toString())
  const [excludeFromPrimes, setExcludeFromPrimes] = useState(user.excludeFromPrimes)
  const [status, setStatus] = useState<UserStatus>(user.status)

  const handleSave = () => {
    onSave({
      ...user,
      role,
      contractHours: Number.parseInt(contractHours) || user.contractHours,
      excludeFromPrimes,
      status,
    })
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-1 block">Role</label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Commercial">Commercial</SelectItem>
              <SelectItem value="Commercial Junior">Commercial Junior</SelectItem>
              <SelectItem value="Manager">Manager</SelectItem>
              <SelectItem value="Admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Heures/semaine</label>
          <Input
            type="number"
            value={contractHours}
            onChange={(e) => setContractHours(e.target.value)}
            className="rounded-xl"
            min="1"
            max="48"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Statut du compte</label>
        <Select value={status} onValueChange={(v) => setStatus(v as UserStatus)}>
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Actif</SelectItem>
            <SelectItem value="inactive">Inactif</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <div className="flex items-center gap-2">
          {excludeFromPrimes ? (
            <EyeOff className="w-4 h-4 text-amber-600" />
          ) : (
            <Eye className="w-4 h-4 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium">Mode Observateur</p>
            <p className="text-xs text-muted-foreground">Acces sans participation aux primes</p>
          </div>
        </div>
        <Switch checked={excludeFromPrimes} onCheckedChange={setExcludeFromPrimes} />
      </div>

      <div className="flex gap-2">
        <Button className="flex-1 rounded-xl" onClick={handleSave}>
          <Check className="w-4 h-4 mr-2" />
          Sauvegarder
        </Button>
        <Button variant="outline" className="flex-1 rounded-xl bg-transparent" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </div>
  )
}

function AddUserDrawer({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (user: Omit<UserWithStatus, "id" | "status">) => void
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("Commercial")
  const [contractHours, setContractHours] = useState("35")
  const [excludeFromPrimes, setExcludeFromPrimes] = useState(false)

  const handleAdd = () => {
    onAdd({
      name,
      email,
      role,
      objectives: 4,
      completedObjectives: 0,
      contractHours: Number.parseInt(contractHours) || 35,
      baseHours: 35,
      excludeFromPrimes,
    })
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-card rounded-t-3xl p-4 border-b border-border z-10">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Ajouter un utilisateur</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-4 pb-8">
          <div>
            <label className="text-sm font-medium">Nom complet *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl mt-1"
              placeholder="Ex: Jean Dupont"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Email *</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl mt-1"
              placeholder="jean@entreprise.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Role</label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="rounded-xl mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Commercial">Commercial</SelectItem>
                  <SelectItem value="Commercial Junior">Commercial Junior</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Heures/semaine</label>
              <Input
                type="number"
                value={contractHours}
                onChange={(e) => setContractHours(e.target.value)}
                className="rounded-xl mt-1"
                min="1"
                max="48"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2">
              {excludeFromPrimes ? (
                <EyeOff className="w-4 h-4 text-amber-600" />
              ) : (
                <Eye className="w-4 h-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">Mode Observateur</p>
                <p className="text-xs text-muted-foreground">Acces sans participation aux primes</p>
              </div>
            </div>
            <Switch checked={excludeFromPrimes} onCheckedChange={setExcludeFromPrimes} />
          </div>

          <Button className="w-full rounded-xl" onClick={handleAdd} disabled={!name || !email}>
            <UserPlus className="w-4 h-4 mr-2" />
            Ajouter l'utilisateur
          </Button>
        </div>
      </div>
    </>
  )
}

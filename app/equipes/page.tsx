"use client"

import { useState } from "react"
import { Header } from "@/components/pulse/header"
import { useAuth } from "@/components/pulse/auth/auth-provider"
import { BottomNav } from "@/components/pulse/bottom-nav"
import {
  teamMembers,
  type TeamMember,
  calculateProRataPrime,
  calculateTotalPotentialPrime,
} from "@/lib/demo-data"
import {
  Users,
  Search,
  ChevronRight,
  Mail,
  Target,
  X,
  UserPlus,
  Clock,
  Send,
  Edit3,
  Check,
  RotateCcw,
  EyeOff,
  Eye,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

export default function TeamsPage() {
  const { profile } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [showInvite, setShowInvite] = useState(false)

  const filteredMembers = teamMembers.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.role.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const isAdmin = (profile?.role || "") === "admin" || (profile?.role || "") === "manager"
  const totalPotential = calculateTotalPotentialPrime()

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Équipes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{teamMembers.length} collaborateurs</p>
          </div>
          {isAdmin && (
            <Button size="sm" className="rounded-xl gap-2" onClick={() => setShowInvite(true)}>
              <UserPlus className="w-4 h-4" />
              Inviter
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un membre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>

        {/* Team Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="pulse-card p-4 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xl font-bold">{teamMembers.length}</p>
            <p className="text-[11px] text-muted-foreground">Membres</p>
          </div>
          <div className="pulse-card p-4 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-accent/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-accent" />
            </div>
            <p className="text-xl font-bold">
              {Math.round(
                (teamMembers.reduce((sum, m) => sum + m.completedObjectives, 0) /
                  teamMembers.reduce((sum, m) => sum + m.objectives, 0)) *
                  100,
              )}
              %
            </p>
            <p className="text-[11px] text-muted-foreground">Objectifs</p>
          </div>
          <div className="pulse-card p-4 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-chart-3/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-chart-3" />
            </div>
            <p className="text-xl font-bold">{teamMembers.reduce((sum, m) => sum + m.contractHours, 0)}h</p>
            <p className="text-[11px] text-muted-foreground">Heures totales</p>
          </div>
        </div>

        {/* Members List */}
        <section className="space-y-3">
          <h2 className="font-semibold text-sm">Collaborateurs</h2>

          {filteredMembers.map((member) => {
            const completionRate = (member.completedObjectives / member.objectives) * 100
            const prorataPrime = calculateProRataPrime(totalPotential, member.contractHours, member.baseHours)

            return (
              <div key={member.id} className="pulse-card p-4 cursor-pointer" onClick={() => setSelectedMember(member)}>
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center shrink-0 relative">
                    <span className="text-sm font-bold text-white">
                      {member.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                    {member.excludeFromPrimes && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center border-2 border-card">
                        <EyeOff className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm truncate flex items-center gap-2">
                        {member.name}
                        {member.excludeFromPrimes && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 font-medium">
                            Observateur
                          </span>
                        )}
                      </h3>
                      {!member.excludeFromPrimes && (
                        <span className="text-sm font-bold text-primary">{prorataPrime}€</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">{member.role}</p>
                      <span className="text-muted-foreground">•</span>
                      <p className="text-xs text-muted-foreground">{member.contractHours}h/sem</p>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Progress value={completionRate} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground">{Math.round(completionRate)}%</span>
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
              </div>
            )
          })}

          {filteredMembers.length === 0 && (
            <div className="pulse-card p-8 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Aucun membre trouvé</p>
            </div>
          )}
        </section>
      </main>

      {/* Member Detail Drawer */}
      {selectedMember && (
        <MemberDrawer member={selectedMember} onClose={() => setSelectedMember(null)} isAdmin={isAdmin} />
      )}

      {/* Invite Drawer */}
      {showInvite && <InviteDrawer onClose={() => setShowInvite(false)} />}

      <BottomNav />
    </div>
  )
}

function MemberDrawer({
  member,
  onClose,
  isAdmin,
}: {
  member: TeamMember
  onClose: () => void
  isAdmin: boolean
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedRole, setEditedRole] = useState(member.role)
  const [editedHours, setEditedHours] = useState(member.contractHours.toString())
  const [excludeFromPrimes, setExcludeFromPrimes] = useState(member.excludeFromPrimes)
  const [linkSent, setLinkSent] = useState(false)

  const completionRate = (member.completedObjectives / member.objectives) * 100
  const totalPotential = calculateTotalPotentialPrime()
  const prorataPrime = calculateProRataPrime(totalPotential, member.contractHours, member.baseHours)
  const ratio = member.contractHours / member.baseHours

  const handleSendActivationLink = () => {
    setLinkSent(true)
    setTimeout(() => setLinkSent(false), 3000)
  }

  const handleSaveChanges = () => {
    // Ici on sauvegarderait les modifications
    setIsEditing(false)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-card rounded-t-3xl p-4 border-b border-border">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Profil</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Profile */}
          <div className="text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-3 relative">
              <span className="text-2xl font-bold text-white">
                {member.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </span>
              {excludeFromPrimes && (
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center border-2 border-card">
                  <EyeOff className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            <h3 className="font-bold text-lg">{member.name}</h3>
            <p className="text-sm text-muted-foreground">{member.role}</p>
            {excludeFromPrimes && (
              <div className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full bg-amber-500/15 text-amber-600">
                <EyeOff className="w-3 h-3" />
                <span className="text-xs font-medium">Mode Observateur</span>
              </div>
            )}
          </div>

          {/* Admin Actions */}
          {isAdmin && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl bg-transparent gap-2"
                onClick={handleSendActivationLink}
                disabled={linkSent}
              >
                {linkSent ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    Envoyé !
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Renvoyer lien
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl bg-transparent gap-2"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? (
                  <>
                    <X className="w-4 h-4" />
                    Annuler
                  </>
                ) : (
                  <>
                    <Edit3 className="w-4 h-4" />
                    Modifier
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Edit Form */}
          {isEditing && isAdmin && (
            <div className="pulse-card p-4 space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Rôle</label>
                <Select value={editedRole} onValueChange={setEditedRole}>
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
                <label className="text-sm font-medium mb-2 block">Heures de contrat</label>
                <Input
                  type="number"
                  value={editedHours}
                  onChange={(e) => setEditedHours(e.target.value)}
                  className="rounded-xl"
                  min="1"
                  max="48"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <div className="flex-1">
                    <label className="text-sm font-medium flex items-center gap-2">
                      {excludeFromPrimes ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      Mode Observateur
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      L'utilisateur a accès mais ne compte pas dans les primes (ex: gérant)
                    </p>
                  </div>
                  <Switch checked={excludeFromPrimes} onCheckedChange={setExcludeFromPrimes} />
                </div>
              </div>

              <Button className="w-full rounded-xl" onClick={handleSaveChanges}>
                <Check className="w-4 h-4 mr-2" />
                Sauvegarder
              </Button>
            </div>
          )}

          {/* Contract Info */}
          <div className="pulse-card p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xl font-bold">{member.contractHours}h</p>
                <p className="text-xs text-muted-foreground">Contrat</p>
              </div>
              <div>
                <p className="text-xl font-bold">{Math.round(ratio * 100)}%</p>
                <p className="text-xs text-muted-foreground">Ratio</p>
              </div>
              <div>
                {excludeFromPrimes ? (
                  <>
                    <p className="text-xl font-bold text-muted-foreground">-</p>
                    <p className="text-xs text-muted-foreground">Pas de prime</p>
                  </>
                ) : (
                  <>
                    <p className="text-xl font-bold text-primary">{prorataPrime}€</p>
                    <p className="text-xs text-muted-foreground">Prime max</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Objectives */}
          <div className="pulse-card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Progression objectifs</span>
              <span className="text-sm font-bold text-primary">{Math.round(completionRate)}%</span>
            </div>
            <Progress value={completionRate} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {member.completedObjectives} sur {member.objectives} objectifs complétés
            </p>
          </div>

          {/* Contact */}
          <div className="pulse-card p-4">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm">{member.email}</p>
              </div>
            </div>
          </div>

          {/* Reset Password Option */}
          {isAdmin && (
            <Button
              variant="outline"
              className="w-full rounded-xl bg-transparent gap-2 text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
            >
              <RotateCcw className="w-4 h-4" />
              Réinitialiser le mot de passe
            </Button>
          )}
        </div>
      </div>
    </>
  )
}

function InviteDrawer({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("Commercial")
  const [hours, setHours] = useState("35")

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50">
        <div className="p-4 border-b border-border">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Inviter un membre</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-4 pb-8">
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              placeholder="nom@entreprise.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Rôle</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {["Commercial", "Commercial Junior", "Manager"].map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={cn(
                    "p-3 rounded-xl text-xs font-medium transition-all",
                    role === r
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Heures de contrat</label>
            <Input
              type="number"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="rounded-xl mt-1"
              min="1"
              max="48"
            />
          </div>

          <Button className="w-full rounded-xl" disabled={!email}>
            <Mail className="w-4 h-4 mr-2" />
            Envoyer l'invitation
          </Button>
        </div>
      </div>
    </>
  )
}

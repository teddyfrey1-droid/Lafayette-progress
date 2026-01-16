"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { calculateProRataPrime, calculateTotalPotentialPrime } from "@/lib/demo-data"
import { useAuth } from "@/components/auth/auth-provider"
import { db, auth } from "@/lib/firebase/client"
import { inviteUser } from "@/lib/firebase/auth"
import { sendPasswordResetEmail } from "firebase/auth"
import { collection, doc, updateDoc, onSnapshot, query, orderBy } from "firebase/firestore"
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
  EyeOff,
  Eye,
  Ban,
  Unlock,
  Building2 // Nouvel icone
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
  objectives: number
  completedObjectives: number
  contractHours: number
  baseHours: number
  excludeFromPrimes: boolean
  disabled: boolean
  company: string // Nouveau champ
}

export default function TeamsPage() {
  const { profile } = useAuth()
  
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [showInvite, setShowInvite] = useState(false)

  // ------------------------------------------------------------------
  // 1. ÉCOUTE TEMPS RÉEL (Real-time Listener)
  // ------------------------------------------------------------------
  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const usersList: TeamMember[] = querySnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          name: data.displayName || data.name || "Utilisateur sans nom",
          email: data.email || "",
          role: data.role || "employee",
          avatar: data.photoURL || null,
          objectives: data.objectivesCount || 5, 
          completedObjectives: data.completedObjectivesCount || 0,
          contractHours: data.contractHours || 35,
          baseHours: 35,
          excludeFromPrimes: data.excludeFromPrimes || false,
          disabled: data.disabled || false,
          company: data.company || "Heiko", // Récupération de la société
        }
      })
      setMembers(usersList)
      setLoading(false)
    }, (error) => {
      console.error("Erreur temps réel:", error)
      toast({
        title: "Erreur de connexion",
        description: "Impossible d'établir la connexion temps réel avec la base de données.",
        variant: "destructive",
      })
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const filteredMembers = members.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.company.toLowerCase().includes(searchQuery.toLowerCase()) // Recherche par société
  )

  const isAdmin = profile?.role === "admin" || profile?.role === "manager" || profile?.role === "super_admin"
  const totalPotential = calculateTotalPotentialPrime()

  const handleMemberUpdated = (updatedMember: TeamMember) => {
    setSelectedMember(updatedMember)
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Équipes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {loading ? "Synchronisation..." : `${members.length} collaborateurs`}
            </p>
          </div>
          {isAdmin && (
            <Button size="sm" className="rounded-xl gap-2" onClick={() => setShowInvite(true)}>
              <UserPlus className="w-4 h-4" />
              Inviter
            </Button>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, rôle ou société..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>

        {!loading && (
          <div className="grid grid-cols-3 gap-3">
            <div className="pulse-card p-4 text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xl font-bold">{members.length}</p>
              <p className="text-[11px] text-muted-foreground">Membres</p>
            </div>
            <div className="pulse-card p-4 text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-accent/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-accent" />
              </div>
              <p className="text-xl font-bold">
                {members.length > 0 
                  ? Math.round(
                      (members.reduce((sum, m) => sum + m.completedObjectives, 0) /
                      (members.reduce((sum, m) => sum + m.objectives, 0) || 1)) * 100
                    )
                  : 0}
                %
              </p>
              <p className="text-[11px] text-muted-foreground">Objectifs</p>
            </div>
            <div className="pulse-card p-4 text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-chart-3/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-chart-3" />
              </div>
              <p className="text-xl font-bold">{members.reduce((sum, m) => sum + m.contractHours, 0)}h</p>
              <p className="text-[11px] text-muted-foreground">Total Heures</p>
            </div>
          </div>
        )}

        <section className="space-y-3">
          <h2 className="font-semibold text-sm">Collaborateurs (En direct)</h2>

          {loading ? (
             <div className="flex flex-col items-center justify-center py-12 space-y-4">
               <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
               <p className="text-sm text-muted-foreground">Connexion temps réel...</p>
             </div>
          ) : (
            filteredMembers.map((member) => {
              const completionRate = (member.completedObjectives / (member.objectives || 1)) * 100
              const prorataPrime = calculateProRataPrime(totalPotential, member.contractHours, member.baseHours)

              return (
                <div 
                  key={member.id} 
                  className={cn(
                    "pulse-card p-4 cursor-pointer hover:bg-muted/50 transition-all duration-200",
                    member.disabled && "opacity-60 grayscale"
                  )} 
                  onClick={() => setSelectedMember(member)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center shrink-0 relative overflow-hidden">
                      {member.avatar ? (
                         <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-white">
                          {member.name.substring(0, 2).toUpperCase()}
                        </span>
                      )}
                      
                      {member.excludeFromPrimes && !member.disabled && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center border-2 border-card z-10">
                          <EyeOff className="w-3 h-3 text-white" />
                        </div>
                      )}
                       {member.disabled && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20">
                          <Ban className="w-6 h-6 text-white" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm truncate flex items-center gap-2">
                          {member.name}
                          {member.disabled ? (
                             <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-600 font-medium">
                               Bloqué
                             </span>
                          ) : member.excludeFromPrimes && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 font-medium">
                              Observateur
                            </span>
                          )}
                        </h3>
                        {!member.excludeFromPrimes && !member.disabled && (
                          <span className="text-sm font-bold text-primary">{prorataPrime}€</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground capitalize">{member.role === 'employee' ? 'Salarié' : member.role}</p>
                        <span className="text-muted-foreground">•</span>
                        {/* Affichage de la société ici */}
                        <p className="text-xs text-muted-foreground truncate max-w-[120px]">{member.company}</p>
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
            })
          )}

          {!loading && filteredMembers.length === 0 && (
            <div className="pulse-card p-8 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Aucun membre trouvé</p>
            </div>
          )}
        </section>
      </main>

      {selectedMember && (
        <MemberDrawer 
          member={selectedMember} 
          onClose={() => setSelectedMember(null)} 
          isAdmin={isAdmin}
          onUpdate={handleMemberUpdated}
        />
      )}

      {showInvite && (
        <InviteDrawer 
          onClose={() => setShowInvite(false)} 
          onSuccess={() => setShowInvite(false)} 
        />
      )}

      <BottomNav />
    </div>
  )
}

function MemberDrawer({
  member,
  onClose,
  isAdmin,
  onUpdate
}: {
  member: TeamMember
  onClose: () => void
  isAdmin: boolean
  onUpdate: (m: TeamMember) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // États formulaire
  const [editedRole, setEditedRole] = useState(member.role)
  const [editedHours, setEditedHours] = useState(member.contractHours.toString())
  const [editedCompany, setEditedCompany] = useState(member.company) // Nouvel état
  const [excludeFromPrimes, setExcludeFromPrimes] = useState(member.excludeFromPrimes)
  const [linkSent, setLinkSent] = useState(false)

  const completionRate = (member.completedObjectives / (member.objectives || 1)) * 100
  const totalPotential = calculateTotalPotentialPrime()
  const prorataPrime = calculateProRataPrime(totalPotential, member.contractHours, member.baseHours)
  const ratio = member.contractHours / member.baseHours

  const handleSendActivationLink = async () => {
    try {
      await sendPasswordResetEmail(auth, member.email)
      setLinkSent(true)
      toast({ title: "Email envoyé", description: `Lien envoyé à ${member.email}` })
      setTimeout(() => setLinkSent(false), 5000)
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible d'envoyer l'email.", variant: "destructive" })
    }
  }

  const handleSaveChanges = async () => {
    setIsSaving(true)
    try {
      const userRef = doc(db, "users", member.id)
      await updateDoc(userRef, {
        role: editedRole,
        contractHours: parseInt(editedHours) || 35,
        company: editedCompany, // Sauvegarde de la société
        excludeFromPrimes: excludeFromPrimes
      })

      onUpdate({
        ...member,
        role: editedRole,
        contractHours: parseInt(editedHours) || 35,
        company: editedCompany,
        excludeFromPrimes: excludeFromPrimes
      })

      toast({ title: "Succès", description: "Profil mis à jour." })
      setIsEditing(false)
    } catch (error) {
      console.error(error)
      toast({ title: "Erreur", description: "Échec de la sauvegarde.", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleBlock = async () => {
    if(!confirm(member.disabled ? "Réactiver cet utilisateur ?" : "Bloquer cet utilisateur ? Il sera déconnecté immédiatement.")) return;
    
    try {
      const newStatus = !member.disabled
      await updateDoc(doc(db, "users", member.id), {
        disabled: newStatus
      })
      
      onUpdate({ ...member, disabled: newStatus })
      
      toast({ 
        title: newStatus ? "Utilisateur bloqué" : "Utilisateur réactivé",
        description: newStatus ? "Accès révoqué." : "Accès rétabli."
      })
    } catch (e) {
      toast({ title: "Erreur", description: "Action impossible.", variant: "destructive" })
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
        <div className="sticky top-0 bg-card rounded-t-3xl p-4 border-b border-border z-10">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Profil Collaborateur</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-6 pb-8">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-3 relative overflow-hidden">
               {member.avatar ? (
                  <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
               ) : (
                  <span className="text-2xl font-bold text-white">
                    {member.name.substring(0, 2).toUpperCase()}
                  </span>
               )}
               {member.disabled && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                    <Ban className="w-8 h-8 text-white" />
                  </div>
               )}
            </div>
            <h3 className="font-bold text-lg">{member.name}</h3>
            <p className="text-sm text-muted-foreground capitalize">{member.role === 'employee' ? 'Salarié' : member.role}</p>
            
            <div className="flex justify-center gap-2 mt-2 items-center">
              <Building2 className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">{member.company}</span>
            </div>

            <div className="flex justify-center gap-2 mt-2">
              {member.disabled && (
                <span className="px-3 py-1 rounded-full bg-red-500/15 text-red-600 text-xs font-medium border border-red-500/20">
                  Compte Bloqué
                </span>
              )}
              {member.excludeFromPrimes && !member.disabled && (
                <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-600 text-xs font-medium border border-amber-500/20">
                  Mode Observateur
                </span>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="rounded-xl bg-transparent gap-2" onClick={handleSendActivationLink} disabled={linkSent || member.disabled}>
                  {linkSent ? <Check className="w-4 h-4 text-green-500" /> : <Send className="w-4 h-4" />}
                  {linkSent ? "Envoyé !" : "Mot de passe"}
                </Button>
                <Button variant={isEditing ? "secondary" : "outline"} size="sm" className="rounded-xl gap-2" onClick={() => setIsEditing(!isEditing)} disabled={member.disabled}>
                  {isEditing ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                  {isEditing ? "Annuler" : "Modifier"}
                </Button>
              </div>
              <Button variant="outline" className={cn("w-full rounded-xl gap-2", member.disabled ? "text-green-600" : "text-red-400")} onClick={handleToggleBlock}>
                {member.disabled ? <Unlock className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                {member.disabled ? "Réactiver l'accès" : "Bloquer l'accès"}
              </Button>
            </div>
          )}

          {isEditing && isAdmin && !member.disabled && (
            <div className="pulse-card p-4 space-y-4 border-primary/20 bg-primary/5">
              <h4 className="text-sm font-semibold text-primary">Modification du profil</h4>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Société / Site</label>
                <Input value={editedCompany} onChange={(e) => setEditedCompany(e.target.value)} className="rounded-xl bg-background" />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Rôle</label>
                <Select value={editedRole} onValueChange={setEditedRole}>
                  <SelectTrigger className="rounded-xl bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Salarié / Commercial</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Heures de contrat</label>
                <Input type="number" value={editedHours} onChange={(e) => setEditedHours(e.target.value)} className="rounded-xl bg-background" min="1" max="50" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/50">
                <div className="flex-1">
                  <label className="text-sm font-medium flex items-center gap-2">
                    {excludeFromPrimes ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    Mode Observateur
                  </label>
                </div>
                <Switch checked={excludeFromPrimes} onCheckedChange={setExcludeFromPrimes} />
              </div>

              <Button className="w-full rounded-xl" onClick={handleSaveChanges} disabled={isSaving}>
                {isSaving ? "..." : <><Check className="w-4 h-4 mr-2" /> Enregistrer</>}
              </Button>
            </div>
          )}

          {!isEditing && (
             <div className="pulse-card p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-xl font-bold">{member.contractHours}h</p><p className="text-xs text-muted-foreground">Contrat</p></div>
                <div><p className="text-xl font-bold">{Math.round(ratio * 100)}%</p><p className="text-xs text-muted-foreground">Temps plein</p></div>
                <div>
                  {excludeFromPrimes || member.disabled ? (
                    <><p className="text-xl font-bold text-muted-foreground">-</p><p className="text-xs text-muted-foreground">Non éligible</p></>
                  ) : (
                    <><p className="text-xl font-bold text-primary">{prorataPrime}€</p><p className="text-xs text-muted-foreground">Prime max</p></>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="pulse-card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Progression objectifs</span>
              <span className="text-sm font-bold text-primary">{Math.round(completionRate)}%</span>
            </div>
            <Progress value={completionRate} className="h-2" />
          </div>

          <div className="pulse-card p-4">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div className="overflow-hidden">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm truncate">{member.email}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function InviteDrawer({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("employee")
  const [hours, setHours] = useState("35")
  const [company, setCompany] = useState("Heiko") // Société par défaut
  const [isLoading, setIsLoading] = useState(false)

  const handleInvite = async () => {
    if(!email) return
    setIsLoading(true)

    try {
      // On passe maintenant 4 arguments : email, role, hours, company
      await inviteUser(email, role, parseInt(hours) || 35, company)
      
      toast({
        title: "Invitation envoyée",
        description: `Un email a été envoyé à ${email} pour définir son mot de passe.`
      })
      onSuccess()
    } catch (error: any) {
      console.error(error)
      let msg = "Impossible d'envoyer l'invitation."
      if (error.code === 'auth/email-already-in-use') msg = "Cet email est déjà utilisé."
      
      toast({
        title: "Erreur",
        description: msg,
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 animate-in slide-in-from-bottom duration-300">
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
            <label className="text-sm font-medium">Société / Site</label>
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Ex: Heiko Nanterre"
              className="rounded-xl mt-1"
            />
          </div>

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
              {["employee", "manager", "admin"].map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={cn(
                    "p-3 rounded-xl text-xs font-medium transition-all capitalize",
                    role === r
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  {r === "employee" ? "Salarié" : r}
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

          <Button className="w-full rounded-xl" disabled={!email || isLoading} onClick={handleInvite}>
            {isLoading ? "Envoi..." : <><Mail className="w-4 h-4 mr-2" /> Envoyer l'invitation</>}
          </Button>
        </div>
      </div>
    </>
  )
}

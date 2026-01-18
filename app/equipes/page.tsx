"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { calculateProRataPrime, calculateTotalPotentialPrime } from "@/lib/demo-data"
import { useAuth } from "@/components/auth/auth-provider"
import { usePermissions } from "@/hooks/use-permissions"
import { PermissionGate } from "@/components/auth/permission-gate"
import { db, auth } from "@/lib/firebase/client"
import { collection, doc, updateDoc, onSnapshot, query, orderBy, deleteDoc } from "firebase/firestore"
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
  Building2,
  Trash2,
  Bell,
  BellOff,
  Circle
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast" // Changement ici : import du hook
import { Badge } from "@/components/ui/badge"

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
  company: string
  lastLogin?: any 
  pushEnabled?: boolean
}

export default function TeamsPage() {
  const { profile } = useAuth()
  const { canEdit } = usePermissions()
  const { toast } = useToast() // Utilisation du hook
  
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [showInvite, setShowInvite] = useState(false)

  // 1. ÉCOUTE TEMPS RÉEL
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
          company: data.company || "Heiko",
          lastLogin: data.lastLogin || null,
          pushEnabled: data.pushEnabled || false
        }
      })
      setMembers(usersList)
      setLoading(false)
    }, (error) => {
      console.error("Erreur temps réel:", error)
      toast({
        title: "Erreur de connexion",
        description: "Impossible d'établir la connexion temps réel.",
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
      member.company.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const canManage = canEdit("equipes")
  const totalPotential = calculateTotalPotentialPrime()

  const handleMemberUpdated = (updatedMember: TeamMember) => {
    setSelectedMember(updatedMember)
  }

  // Fonction pour supprimer un utilisateur via l'API
  const handleMemberDeleted = async (memberId: string) => {
    if(!confirm("Êtes-vous sûr de vouloir supprimer définitivement cet utilisateur ? Cette action est irréversible.")) return;

    try {
      const response = await fetch(`/api/admin/invite-user?uid=${memberId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error("Erreur serveur lors de la suppression");

      toast({ 
        title: "Utilisateur supprimé", 
        description: "Le compte a été supprimé définitivement.",
        variant: "success" // Notification verte
      });
      setSelectedMember(null); // Fermer le drawer
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer l'utilisateur.", variant: "destructive" });
    }
  }

  return (
    <PermissionGate moduleId="equipes" redirect>
      <div className="min-h-screen bg-background pb-32">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Équipes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {loading ? "Chargement..." : `${members.length} collaborateurs`}
            </p>
          </div>
          {canManage && (
            <Button size="sm" className="rounded-xl gap-2" onClick={() => setShowInvite(true)}>
              <UserPlus className="w-4 h-4" />
              Inviter
            </Button>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un membre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>

        {/* STATS RAPIDES */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3">
            <div className="pulse-card p-4 text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xl font-bold">{members.length}</p>
              <p className="text-[10px] text-muted-foreground">Effectif</p>
            </div>
            <div className="pulse-card p-4 text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-xl font-bold">
                {members.filter(m => m.lastLogin).length}
              </p>
              <p className="text-[10px] text-muted-foreground">Actifs</p>
            </div>
            <div className="pulse-card p-4 text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <p className="text-xl font-bold">
                {members.filter(m => !m.lastLogin).length}
              </p>
              <p className="text-[10px] text-muted-foreground">En attente</p>
            </div>
          </div>
        )}

        <section className="space-y-3">
          <h2 className="font-semibold text-sm">Collaborateurs</h2>

          {loading ? (
             <div className="flex flex-col items-center justify-center py-12 space-y-4">
               <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
             </div>
          ) : (
            filteredMembers.map((member) => {
              const completionRate = (member.completedObjectives / (member.objectives || 1)) * 100
              const isPending = !member.lastLogin;

              return (
                <div 
                  key={member.id} 
                  className={cn(
                    "pulse-card p-4 cursor-pointer hover:bg-muted/50 transition-all duration-200 relative group",
                    member.disabled && "opacity-60 grayscale"
                  )} 
                  onClick={() => setSelectedMember(member)}
                >
                  <div className="flex items-center gap-4">
                    {/* AVATAR + STATUS BADGE */}
                    <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center shrink-0 overflow-hidden">
                        {member.avatar ? (
                            <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-sm font-bold text-white">
                            {member.name.substring(0, 2).toUpperCase()}
                            </span>
                        )}
                        </div>
                        {/* Indicateur de statut (Point Vert ou Orange) */}
                        <div className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-card flex items-center justify-center",
                            isPending ? "bg-orange-500" : "bg-green-500"
                        )}>
                            {isPending ? (
                                <span className="sr-only">En attente</span>
                            ) : (
                                <span className="sr-only">Actif</span>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm truncate flex items-center gap-2">
                          {member.name}
                        </h3>
                        {/* Indicateurs Badges */}
                        <div className="flex items-center gap-1.5">
                            {member.pushEnabled ? (
                                <Bell className="w-3 h-3 text-primary fill-primary/20" />
                            ) : (
                                <BellOff className="w-3 h-3 text-muted-foreground/30" />
                            )}
                            
                            {isPending && (
                                <Badge variant="outline" className="text-[9px] h-5 px-1.5 bg-orange-500/10 text-orange-600 border-orange-200">
                                    En attente
                                </Badge>
                            )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground capitalize">{member.role === 'employee' ? 'Salarié' : member.role}</p>
                        <span className="text-muted-foreground">•</span>
                        <p className="text-xs text-muted-foreground truncate max-w-[120px]">{member.company}</p>
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 opacity-50 group-hover:opacity-100" />
                  </div>
                </div>
              )
            })
          )}
        </section>
      </main>

      {/* DRAWER DÉTAIL MEMBRE */}
      {selectedMember && (
        <MemberDrawer 
          member={selectedMember} 
          onClose={() => setSelectedMember(null)} 
          isAdmin={canManage}
          onUpdate={handleMemberUpdated}
          onDelete={handleMemberDeleted}
        />
      )}

      {/* DRAWER INVITATION */}
      {showInvite && canManage && (
        <InviteDrawer 
          onClose={() => setShowInvite(false)} 
          onSuccess={() => setShowInvite(false)} 
        />
      )}

      <BottomNav />
      </div>
    </PermissionGate>
  )
}

function MemberDrawer({
  member,
  onClose,
  isAdmin,
  onUpdate,
  onDelete
}: {
  member: TeamMember
  onClose: () => void
  isAdmin: boolean
  onUpdate: (m: TeamMember) => void
  onDelete: (id: string) => void
}) {
  const { toast } = useToast() // Utilisation du hook
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  const [editedRole, setEditedRole] = useState(member.role)
  const [editedHours, setEditedHours] = useState(member.contractHours.toString())
  const [editedCompany, setEditedCompany] = useState(member.company)
  const [editedEmail, setEditedEmail] = useState(member.email) // AJOUT: State Email
  const [excludeFromPrimes, setExcludeFromPrimes] = useState(member.excludeFromPrimes)
  const [linkSent, setLinkSent] = useState(false)

  const isPending = !member.lastLogin;

  const handleSendActivationLink = async () => {
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: member.email }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({} as any))
        throw new Error((data as any)?.error || "Erreur API")
      }

      setLinkSent(true)
      toast({
        title: "Email envoyé",
        description: `Lien de rappel envoyé à ${member.email}`,
        variant: "success",
      })
      setTimeout(() => setLinkSent(false), 5000)
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible d'envoyer l'email.", variant: "destructive" })
    }
  }

  const handleSaveChanges = async () => {
    setIsSaving(true)
    try {
      // UTILISATION DE L'API POUR METTRE À JOUR (Inclus changement Email)
      const res = await fetch("/api/admin/invite-user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            uid: member.id,
            email: editedEmail,
            role: editedRole,
            contractHours: parseInt(editedHours) || 35,
            company: editedCompany,
            // excludeFromPrimes non géré par l'API PATCH actuelle, on le met à jour directement en local si besoin 
            // ou on ajoute le support dans l'API. Pour l'instant l'API gère email, role, hours, company.
        })
      });

      if(!res.ok) throw new Error("Erreur API");

      // Mise à jour Firestore pour le champ local (excludeFromPrimes)
      if (excludeFromPrimes !== member.excludeFromPrimes) {
         await updateDoc(doc(db, "users", member.id), { excludeFromPrimes });
      }

      onUpdate({
        ...member,
        email: editedEmail,
        role: editedRole,
        contractHours: parseInt(editedHours) || 35,
        company: editedCompany,
        excludeFromPrimes: excludeFromPrimes
      })

      toast({ 
        title: "Profil mis à jour", 
        description: "Les modifications ont été enregistrées avec succès.", 
        variant: "success" // Notification verte
      })
      setIsEditing(false)
    } catch (error) {
      toast({ title: "Erreur", description: "Échec de la sauvegarde.", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleBlock = async () => {
    if(!confirm(member.disabled ? "Réactiver ?" : "Bloquer l'accès ?")) return;
    try {
      const newStatus = !member.disabled
      await updateDoc(doc(db, "users", member.id), { disabled: newStatus })
      onUpdate({ ...member, disabled: newStatus })
      toast({ 
        title: "Statut mis à jour", 
        description: member.disabled ? "L'accès utilisateur a été rétabli." : "L'utilisateur a été bloqué.",
        variant: "success" // Notification verte
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
            <h2 className="font-semibold">Détails du compte</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-6 pb-8">
          <div className="text-center relative">
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-3 relative overflow-hidden ring-4 ring-background shadow-xl">
               {member.avatar ? (
                  <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
               ) : (
                  <span className="text-3xl font-bold text-white">
                    {member.name.substring(0, 2).toUpperCase()}
                  </span>
               )}
            </div>
            
            <h3 className="font-bold text-xl">{member.name}</h3>
            <p className="text-sm text-muted-foreground">{member.email}</p>
            
            {/* Badges d'état */}
            <div className="flex justify-center gap-2 mt-4 flex-wrap">
                {isPending ? (
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-200">
                        <Clock className="w-3 h-3 mr-1" /> En attente d'activation
                    </Badge>
                ) : (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                        <Check className="w-3 h-3 mr-1" /> Compte actif
                    </Badge>
                )}
                
                {member.pushEnabled ? (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
                        <Bell className="w-3 h-3 mr-1" /> Notifications ON
                    </Badge>
                ) : (
                    <Badge variant="secondary" className="text-muted-foreground">
                        <BellOff className="w-3 h-3 mr-1" /> Notifications OFF
                    </Badge>
                )}
            </div>
          </div>

          {isAdmin && (
            <div className="space-y-6">
              {/* Actions Rapides */}
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="rounded-xl h-12" onClick={handleSendActivationLink}>
                  {linkSent ? <Check className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  {linkSent ? "Envoyé" : "Renvoyer mail"}
                </Button>
                <Button variant={isEditing ? "default" : "outline"} className="rounded-xl h-12" onClick={() => setIsEditing(!isEditing)}>
                  <Edit3 className="w-4 h-4 mr-2" />
                  {isEditing ? "Annuler" : "Modifier"}
                </Button>
              </div>

              {/* Formulaire d'édition */}
              {isEditing && (
                <div className="pulse-card p-5 space-y-4 border-primary/20 bg-primary/5 animate-in fade-in zoom-in-95 duration-200">
                  <h4 className="text-sm font-semibold text-primary mb-2">Modification</h4>
                  
                  <div className="space-y-3">
                    {/* AJOUT: Champ Email Modifiable */}
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Email (Modifiable)</label>
                        <Input value={editedEmail} onChange={(e) => setEditedEmail(e.target.value)} className="bg-background" />
                    </div>

                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Société</label>
                        <Input value={editedCompany} onChange={(e) => setEditedCompany(e.target.value)} className="bg-background" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Rôle</label>
                        <Select value={editedRole} onValueChange={setEditedRole}>
                        <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="employee">Salarié</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Heures Contrat</label>
                        <Input type="number" value={editedHours} onChange={(e) => setEditedHours(e.target.value)} className="bg-background" />
                    </div>
                  </div>

                  <Button className="w-full rounded-xl mt-2" onClick={handleSaveChanges} disabled={isSaving}>
                    {isSaving ? "Sauvegarde..." : "Enregistrer les modifications"}
                  </Button>
                </div>
              )}

              {/* Zone Danger */}
              <div className="pt-4 border-t border-border/50 space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Zone de danger</h4>
                
                <Button variant="outline" className={cn("w-full justify-start", member.disabled ? "text-green-600 hover:text-green-700" : "text-orange-600 hover:text-orange-700")} onClick={handleToggleBlock}>
                    {member.disabled ? <Unlock className="w-4 h-4 mr-2" /> : <Ban className="w-4 h-4 mr-2" />}
                    {member.disabled ? "Débloquer l'accès" : "Bloquer temporairement"}
                </Button>

                <Button variant="ghost" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => onDelete(member.id)}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer définitivement l'utilisateur
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function InviteDrawer({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { toast } = useToast() // Utilisation du hook
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("employee")
  const [hours, setHours] = useState("35")
  const [company, setCompany] = useState("Heiko")
  const [isLoading, setIsLoading] = useState(false)

  const handleInvite = async () => {
    if (!email || !firstName || !lastName) return;
    setIsLoading(true);

    try {
      // APPEL API AVEC LES NOUVEAUX CHAMPS
      const response = await fetch("/api/admin/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName, 
          lastName,
          displayName: `${firstName} ${lastName}`,
          role,
          contractHours: parseInt(hours) || 35,
          company: company || "Heiko",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Impossible d'envoyer l'invitation.");
      }

      toast({
        title: "Invitation envoyée",
        description: `Un email d'activation a été envoyé à ${firstName} ${lastName}.`,
        variant: "success" // Notification verte
      });
      onSuccess();
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 animate-in slide-in-from-bottom duration-300">
        <div className="p-4 border-b border-border">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Nouveau collaborateur</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-4 pb-8 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
             <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Prénom</label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jean" className="rounded-xl" />
             </div>
             <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nom</label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Dupont" className="rounded-xl" />
             </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Email professionnel</label>
            <Input type="email" placeholder="jean.dupont@entreprise.com" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Société / Site</label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} className="rounded-xl" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Rôle</label>
            <div className="grid grid-cols-3 gap-2">
              {["employee", "manager", "admin"].map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={cn(
                    "p-3 rounded-xl text-xs font-medium transition-all capitalize border",
                    role === r
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-muted",
                  )}
                >
                  {r === "employee" ? "Salarié" : r}
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full rounded-xl h-12 text-base font-semibold" disabled={!email || !firstName || !lastName || isLoading} onClick={handleInvite}>
            {isLoading ? "Envoi en cours..." : <><Mail className="w-5 h-5 mr-2" /> Envoyer l'invitation</>}
          </Button>
        </div>
      </div>
    </>
  )
}

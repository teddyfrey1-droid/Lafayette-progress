"use client"

import { useState } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import {
  messages,
  teamMembers,
  notificationGroups,
  fridgeAlerts,
  getCriticalAlerts,
  type FridgeAlert,
} from "@/lib/demo-data"
import {
  Send,
  Clock,
  Check,
  Users,
  X,
  ChevronRight,
  Mail,
  Bell,
  Thermometer,
  AlertTriangle,
  Plus,
  Eye,
  UserPlus,
  CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"

type TabValue = "messages" | "alertes" | "groupes"
type AudienceMode = "all" | "groups" | "users"

export default function DiffusionPage() {
  const [activeTab, setActiveTab] = useState<TabValue>("messages")
  const [showCompose, setShowCompose] = useState(false)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<FridgeAlert | null>(null)

  const criticalAlerts = getCriticalAlerts()

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Diffusion</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Communications et alertes</p>
          </div>
          <Button className="rounded-xl gap-2" onClick={() => setShowCompose(true)}>
            <Send className="w-4 h-4" />
            Nouveau
          </Button>
        </div>

        {/* Alert Banner if critical */}
        {criticalAlerts.length > 0 && (
          <button
            onClick={() => setActiveTab("alertes")}
            className="w-full pulse-card p-4 bg-destructive/10 border-destructive/30 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/20 flex items-center justify-center animate-pulse">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">
                  {criticalAlerts.length} alerte{criticalAlerts.length > 1 ? "s" : ""} température
                </p>
                <p className="text-xs text-muted-foreground">{criticalAlerts.map((a) => a.fridgeName).join(", ")}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-destructive" />
            </div>
          </button>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="pulse-card p-4 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-primary/10 flex items-center justify-center">
              <Send className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xl font-bold">{messages.length}</p>
            <p className="text-[11px] text-muted-foreground">Messages</p>
          </div>
          <div className="pulse-card p-4 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-accent/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-accent" />
            </div>
            <p className="text-xl font-bold">{notificationGroups.length}</p>
            <p className="text-[11px] text-muted-foreground">Groupes</p>
          </div>
          <div className="pulse-card p-4 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-chart-3/10 flex items-center justify-center">
              <Thermometer className="w-5 h-5 text-chart-3" />
            </div>
            <p className="text-xl font-bold">{fridgeAlerts.length}</p>
            <p className="text-[11px] text-muted-foreground">Capteurs</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
          <TabsList className="grid w-full grid-cols-3 h-12 p-1 bg-muted/50 rounded-xl">
            <TabsTrigger
              value="messages"
              className="rounded-lg text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              Messages
            </TabsTrigger>
            <TabsTrigger
              value="alertes"
              className="rounded-lg text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm relative"
            >
              Alertes
              {criticalAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-[10px] text-white flex items-center justify-center font-bold">
                  {criticalAlerts.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="groupes"
              className="rounded-lg text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              Groupes
            </TabsTrigger>
          </TabsList>

          {/* Messages Tab */}
          <TabsContent value="messages" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Historique</h2>
              <span className="text-xs text-muted-foreground">{messages.length} messages</span>
            </div>

            <div className="space-y-3">
              {messages.map((message) => (
                <div key={message.id} className="pulse-card p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        message.status === "sent"
                          ? "bg-chart-3/15 text-chart-3"
                          : message.status === "scheduled"
                            ? "bg-blue-500/15 text-blue-500"
                            : "bg-yellow-500/15 text-yellow-500",
                      )}
                    >
                      {message.status === "sent" && <Check className="w-5 h-5" />}
                      {message.status === "scheduled" && <Clock className="w-5 h-5" />}
                      {message.status === "draft" && <Send className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-sm truncate">{message.title}</h3>
                        <span className="text-[10px] text-muted-foreground ml-2 shrink-0">
                          {message.sentAt.toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{message.content}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {message.channels.includes("email") && (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-muted text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          Email
                        </span>
                      )}
                      {message.channels.includes("push") && (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-muted text-muted-foreground">
                          <Bell className="w-3 h-3" />
                          Push
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {message.audience.slice(0, 2).map((a) => (
                        <span key={a} className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary">
                          {a}
                        </span>
                      ))}
                      {message.audience.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{message.audience.length - 2}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Alertes Tab */}
          <TabsContent value="alertes" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Capteurs température</h2>
              <span className="text-xs text-muted-foreground">{fridgeAlerts.length} appareils</span>
            </div>

            <div className="space-y-3">
              {fridgeAlerts.map((alert) => (
                <button
                  key={alert.id}
                  className={cn(
                    "w-full pulse-card p-4 text-left transition-all",
                    alert.status === "critical" && "border-destructive/50 bg-destructive/5",
                    alert.status === "warning" && "border-yellow-500/50 bg-yellow-500/5",
                  )}
                  onClick={() => setSelectedAlert(alert)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        alert.status === "normal" && "bg-chart-3/15",
                        alert.status === "warning" && "bg-yellow-500/15",
                        alert.status === "critical" && "bg-destructive/15 animate-pulse",
                      )}
                    >
                      <Thermometer
                        className={cn(
                          "w-6 h-6",
                          alert.status === "normal" && "text-chart-3",
                          alert.status === "warning" && "text-yellow-500",
                          alert.status === "critical" && "text-destructive",
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm truncate">{alert.fridgeName}</h3>
                        {alert.status !== "normal" && (
                          <AlertTriangle
                            className={cn(
                              "w-4 h-4 shrink-0",
                              alert.status === "warning" ? "text-yellow-500" : "text-destructive",
                            )}
                          />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{alert.location}</p>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          "text-lg font-bold",
                          alert.status === "normal" && "text-chart-3",
                          alert.status === "warning" && "text-yellow-500",
                          alert.status === "critical" && "text-destructive",
                        )}
                      >
                        {alert.currentTemp}°C
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {alert.minTemp}° / {alert.maxTemp}°
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                  </div>

                  {alert.alertHistory.length > 0 && !alert.alertHistory[0].acknowledged && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Alerte depuis{" "}
                          {new Date(alert.alertHistory[0].timestamp).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs rounded-lg bg-transparent"
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Acquitter
                        </Button>
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Legend */}
            <div className="pulse-card p-4">
              <p className="text-xs font-medium mb-3">Légende</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-chart-3" />
                  <span className="text-xs text-muted-foreground">Normal</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-xs text-muted-foreground">Attention</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <span className="text-xs text-muted-foreground">Critique</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Groupes Tab */}
          <TabsContent value="groupes" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Groupes de diffusion</h2>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl gap-1 bg-transparent"
                onClick={() => setShowGroupModal(true)}
              >
                <Plus className="w-4 h-4" />
                Créer
              </Button>
            </div>

            <div className="space-y-3">
              {notificationGroups.map((group) => {
                const memberCount = group.members.length
                const memberNames = group.members
                  .map((id) => teamMembers.find((m) => m.id === id)?.name)
                  .filter(Boolean)
                  .slice(0, 3)

                return (
                  <div key={group.id} className="pulse-card p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${group.color}20` }}
                      >
                        <Users className="w-5 h-5" style={{ color: group.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm">{group.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex -space-x-2">
                            {group.members.slice(0, 4).map((memberId) => {
                              const member = teamMembers.find((m) => m.id === memberId)
                              return (
                                <div
                                  key={memberId}
                                  className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center border-2 border-card"
                                >
                                  <span className="text-[8px] font-bold text-white">
                                    {member?.name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")}
                                  </span>
                                </div>
                              )
                            })}
                            {memberCount > 4 && (
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center border-2 border-card">
                                <span className="text-[8px] font-bold text-muted-foreground">+{memberCount - 4}</span>
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {memberCount} membre{memberCount > 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg shrink-0">
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Compose Modal */}
      {showCompose && <ComposeModal onClose={() => setShowCompose(false)} />}

      {/* Create Group Modal */}
      {showGroupModal && <CreateGroupModal onClose={() => setShowGroupModal(false)} />}

      {/* Alert Detail Modal */}
      {selectedAlert && <AlertDetailModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />}

      <BottomNav />
    </div>
  )
}

function ComposeModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("all")
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [channels, setChannels] = useState<{ email: boolean; push: boolean }>({
    email: true,
    push: true,
  })
  const [showPreview, setShowPreview] = useState(false)

  const toggleGroup = (id: string) => {
    setSelectedGroups((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]))
  }

  const toggleUser = (id: string) => {
    setSelectedUsers((prev) => (prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]))
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card rounded-t-3xl p-4 border-b border-border z-10">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Nouveau message</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-5">
          {/* Title */}
          <div>
            <Label className="text-sm">Titre</Label>
            <Input
              placeholder="Objet du message..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl mt-1"
            />
          </div>

          {/* Channels */}
          <div>
            <Label className="text-sm">Canaux de diffusion</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={() => setChannels((c) => ({ ...c, email: !c.email }))}
                className={cn(
                  "p-3 rounded-xl flex items-center gap-3 transition-all border-2",
                  channels.email
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-muted/50 border-transparent text-muted-foreground",
                )}
              >
                <Mail className="w-5 h-5" />
                <span className="text-sm font-medium">Email</span>
              </button>
              <button
                onClick={() => setChannels((c) => ({ ...c, push: !c.push }))}
                className={cn(
                  "p-3 rounded-xl flex items-center gap-3 transition-all border-2",
                  channels.push
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-muted/50 border-transparent text-muted-foreground",
                )}
              >
                <Bell className="w-5 h-5" />
                <span className="text-sm font-medium">Push</span>
              </button>
            </div>
          </div>

          {/* Audience Mode */}
          <div>
            <Label className="text-sm">Destinataires</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <button
                onClick={() => setAudienceMode("all")}
                className={cn(
                  "p-3 rounded-xl text-center transition-all border-2",
                  audienceMode === "all"
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-muted/50 border-transparent text-muted-foreground",
                )}
              >
                <Users className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs font-medium">Tous</span>
              </button>
              <button
                onClick={() => setAudienceMode("groups")}
                className={cn(
                  "p-3 rounded-xl text-center transition-all border-2",
                  audienceMode === "groups"
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-muted/50 border-transparent text-muted-foreground",
                )}
              >
                <Users className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs font-medium">Groupes</span>
              </button>
              <button
                onClick={() => setAudienceMode("users")}
                className={cn(
                  "p-3 rounded-xl text-center transition-all border-2",
                  audienceMode === "users"
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-muted/50 border-transparent text-muted-foreground",
                )}
              >
                <UserPlus className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs font-medium">Sélection</span>
              </button>
            </div>
          </div>

          {/* Group Selection */}
          {audienceMode === "groups" && (
            <div className="space-y-2">
              {notificationGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => toggleGroup(group.id)}
                  className={cn(
                    "w-full p-3 rounded-xl flex items-center gap-3 transition-all border-2",
                    selectedGroups.includes(group.id)
                      ? "bg-primary/10 border-primary/30"
                      : "bg-muted/50 border-transparent",
                  )}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${group.color}20` }}
                  >
                    <Users className="w-4 h-4" style={{ color: group.color }} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{group.name}</p>
                    <p className="text-xs text-muted-foreground">{group.members.length} membres</p>
                  </div>
                  {selectedGroups.includes(group.id) && <Check className="w-5 h-5 text-primary" />}
                </button>
              ))}
            </div>
          )}

          {/* User Selection */}
          {audienceMode === "users" && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {teamMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => toggleUser(member.id)}
                  className={cn(
                    "w-full p-3 rounded-xl flex items-center gap-3 transition-all border-2",
                    selectedUsers.includes(member.id)
                      ? "bg-primary/10 border-primary/30"
                      : "bg-muted/50 border-transparent",
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">
                      {member.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.role}</p>
                  </div>
                  {selectedUsers.includes(member.id) && <Check className="w-5 h-5 text-primary" />}
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          <div>
            <Label className="text-sm">Message</Label>
            <Textarea
              placeholder="Écrivez votre message..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="rounded-xl min-h-[120px] mt-1"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pb-4">
            <Button
              variant="outline"
              className="flex-1 rounded-xl bg-transparent"
              onClick={() => setShowPreview(true)}
              disabled={!title || !content}
            >
              <Eye className="w-4 h-4 mr-2" />
              Aperçu
            </Button>
            <Button className="flex-1 rounded-xl" disabled={!title || !content || (!channels.email && !channels.push)}>
              <Send className="w-4 h-4 mr-2" />
              Envoyer
            </Button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <>
          <div className="fixed inset-0 bg-black/70 z-[60]" onClick={() => setShowPreview(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-card rounded-2xl z-[60] p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Aperçu</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowPreview(false)} className="rounded-xl">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="pulse-card p-4">
              <h4 className="font-semibold">{title || "Sans titre"}</h4>
              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{content || "Aucun contenu"}</p>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {channels.email && (
                  <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                    <Mail className="w-3 h-3" />
                    Email
                  </span>
                )}
                {channels.push && (
                  <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                    <Bell className="w-3 h-3" />
                    Push
                  </span>
                )}
              </div>
            </div>
            <Button className="w-full mt-4 rounded-xl" onClick={() => setShowPreview(false)}>
              Fermer
            </Button>
          </div>
        </>
      )}
    </>
  )
}

function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [color, setColor] = useState("#D10FA8")

  const colors = ["#D10FA8", "#7A2FF0", "#10B981", "#3B82F6", "#F59E0B", "#EF4444"]

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]))
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-card rounded-t-3xl p-4 border-b border-border">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Créer un groupe</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-5">
          <div>
            <Label className="text-sm">Nom du groupe</Label>
            <Input
              placeholder="Ex: Équipe du matin"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl mt-1"
            />
          </div>

          <div>
            <Label className="text-sm">Description</Label>
            <Input
              placeholder="Courte description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-xl mt-1"
            />
          </div>

          <div>
            <Label className="text-sm">Couleur</Label>
            <div className="flex gap-2 mt-2">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-10 h-10 rounded-xl transition-all",
                    color === c && "ring-2 ring-offset-2 ring-offset-card",
                  )}
                  style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px ${c}` : "none" }}
                />
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm">Membres ({selectedMembers.length} sélectionnés)</Label>
            <div className="space-y-2 mt-2 max-h-48 overflow-y-auto">
              {teamMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => toggleMember(member.id)}
                  className={cn(
                    "w-full p-3 rounded-xl flex items-center gap-3 transition-all border-2",
                    selectedMembers.includes(member.id)
                      ? "bg-primary/10 border-primary/30"
                      : "bg-muted/50 border-transparent",
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">
                      {member.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.role}</p>
                  </div>
                  {selectedMembers.includes(member.id) && <Check className="w-5 h-5 text-primary" />}
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full rounded-xl" disabled={!name || selectedMembers.length === 0}>
            <Plus className="w-4 h-4 mr-2" />
            Créer le groupe
          </Button>
        </div>
      </div>
    </>
  )
}

function AlertDetailModal({
  alert,
  onClose,
}: {
  alert: FridgeAlert
  onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-card rounded-t-3xl p-4 border-b border-border">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Détails du capteur</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center",
                alert.status === "normal" && "bg-chart-3/15",
                alert.status === "warning" && "bg-yellow-500/15",
                alert.status === "critical" && "bg-destructive/15",
              )}
            >
              <Thermometer
                className={cn(
                  "w-8 h-8",
                  alert.status === "normal" && "text-chart-3",
                  alert.status === "warning" && "text-yellow-500",
                  alert.status === "critical" && "text-destructive",
                )}
              />
            </div>
            <div>
              <h3 className="font-bold text-lg">{alert.fridgeName}</h3>
              <p className="text-sm text-muted-foreground">{alert.location}</p>
            </div>
          </div>

          {/* Current temp */}
          <div className="pulse-card p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Température actuelle</p>
            <p
              className={cn(
                "text-4xl font-bold",
                alert.status === "normal" && "text-chart-3",
                alert.status === "warning" && "text-yellow-500",
                alert.status === "critical" && "text-destructive",
              )}
            >
              {alert.currentTemp}°C
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Plage autorisée: {alert.minTemp}°C à {alert.maxTemp}°C
            </p>
          </div>

          {/* Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="pulse-card p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Statut</p>
              <p
                className={cn(
                  "text-sm font-bold capitalize",
                  alert.status === "normal" && "text-chart-3",
                  alert.status === "warning" && "text-yellow-500",
                  alert.status === "critical" && "text-destructive",
                )}
              >
                {alert.status === "normal" ? "Normal" : alert.status === "warning" ? "Attention" : "Critique"}
              </p>
            </div>
            <div className="pulse-card p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Dernière mise à jour</p>
              <p className="text-sm font-bold">
                {new Date(alert.lastUpdate).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          {/* Alert History */}
          {alert.alertHistory.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-3">Historique des alertes</h4>
              <div className="space-y-2">
                {alert.alertHistory.map((hist) => (
                  <div
                    key={hist.id}
                    className={cn("pulse-card p-3 flex items-center gap-3", hist.acknowledged && "opacity-60")}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        hist.type === "warning" ? "bg-yellow-500/15" : "bg-destructive/15",
                      )}
                    >
                      <AlertTriangle
                        className={cn("w-4 h-4", hist.type === "warning" ? "text-yellow-500" : "text-destructive")}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{hist.temp}°C</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(hist.timestamp).toLocaleString("fr-FR")}
                      </p>
                    </div>
                    {hist.acknowledged ? (
                      <span className="text-xs text-muted-foreground">Acquittée</span>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg bg-transparent">
                        Acquitter
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button className="w-full rounded-xl" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </>
  )
}

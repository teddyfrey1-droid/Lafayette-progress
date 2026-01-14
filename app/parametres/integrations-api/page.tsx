"use client"

import { useState } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { ArrowLeft, Key, Plug, Check, X, AlertCircle, ExternalLink, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import Link from "next/link"

interface ApiIntegration {
  id: string
  name: string
  description: string
  logo: string
  isConnected: boolean
  apiKey?: string
  syncEnabled: boolean
  lastSync?: Date
  features: string[]
  color: string
}

const availableIntegrations: ApiIntegration[] = [
  {
    id: "combo",
    name: "Combo",
    description: "Synchronisation automatique du planning et des équipes",
    logo: "🗓️",
    isConnected: false,
    syncEnabled: false,
    features: ["Planning équipe", "Horaires de travail", "Absences"],
    color: "from-blue-500/15 to-blue-600/10",
  },
  {
    id: "zelty",
    name: "Zelty",
    description: "Récupération automatique du chiffre d'affaires et des ventes",
    logo: "💰",
    isConnected: false,
    syncEnabled: false,
    features: ["CA journalier", "Tickets moyens", "Articles vendus"],
    color: "from-emerald-500/15 to-emerald-600/10",
  },
  {
    id: "lafourchette",
    name: "La Fourchette",
    description: "Import des réservations et taux de remplissage",
    logo: "🍴",
    isConnected: false,
    syncEnabled: false,
    features: ["Réservations", "Taux occupation", "Avis clients"],
    color: "from-red-500/15 to-red-600/10",
  },
  {
    id: "ubereats",
    name: "Uber Eats",
    description: "Suivi des commandes et du CA de livraison",
    logo: "🛵",
    isConnected: false,
    syncEnabled: false,
    features: ["Commandes delivery", "CA livraison", "Notes satisfaction"],
    color: "from-green-500/15 to-green-600/10",
  },
  {
    id: "deliveroo",
    name: "Deliveroo",
    description: "Statistiques de livraison en temps réel",
    logo: "🚴",
    isConnected: false,
    syncEnabled: false,
    features: ["Ventes delivery", "Performance", "Délais livraison"],
    color: "from-cyan-500/15 to-cyan-600/10",
  },
  {
    id: "eatpilot",
    name: "EAT Pilote",
    description: "Gestion centralisée des commandes et analytics",
    logo: "📊",
    isConnected: false,
    syncEnabled: false,
    features: ["Dashboard unifié", "Analytics avancées", "Multi-plateformes"],
    color: "from-purple-500/15 to-purple-600/10",
  },
]

export default function IntegrationsApiPage() {
  const [integrations, setIntegrations] = useState<ApiIntegration[]>(availableIntegrations)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState("")

  const connectedCount = integrations.filter((i) => i.isConnected).length

  const handleConnect = (id: string) => {
    if (apiKeyInput.trim()) {
      setIntegrations(
        integrations.map((i) =>
          i.id === id
            ? {
                ...i,
                isConnected: true,
                apiKey: apiKeyInput,
                lastSync: new Date(),
              }
            : i,
        ),
      )
      setEditingId(null)
      setApiKeyInput("")
    }
  }

  const handleDisconnect = (id: string) => {
    setIntegrations(
      integrations.map((i) =>
        i.id === id
          ? {
              ...i,
              isConnected: false,
              apiKey: undefined,
              syncEnabled: false,
              lastSync: undefined,
            }
          : i,
      ),
    )
  }

  const handleToggleSync = (id: string) => {
    setIntegrations(
      integrations.map((i) =>
        i.id === id
          ? {
              ...i,
              syncEnabled: !i.syncEnabled,
              lastSync: !i.syncEnabled ? new Date() : i.lastSync,
            }
          : i,
      ),
    )
  }

  const handleSync = (id: string) => {
    setIntegrations(integrations.map((i) => (i.id === id ? { ...i, lastSync: new Date() } : i)))
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Back link */}
        <Link
          href="/parametres"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Paramètres</span>
        </Link>

        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Intégrations API</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connectez vos outils pour automatiser la mise à jour des données
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="pulse-card p-4 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-primary/10 flex items-center justify-center">
              <Plug className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xl font-bold">{connectedCount}</p>
            <p className="text-[11px] text-muted-foreground">Connectées</p>
          </div>
          <div className="pulse-card p-4 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-accent/10 flex items-center justify-center">
              <Key className="w-5 h-5 text-accent" />
            </div>
            <p className="text-xl font-bold">{integrations.length}</p>
            <p className="text-[11px] text-muted-foreground">Disponibles</p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="pulse-card p-4 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">Automatisation des données</p>
              <p>
                Les intégrations permettent de mettre à jour automatiquement vos chiffres d'affaires, objectifs et KPIs
                sans saisie manuelle. Activez la synchronisation pour chaque plateforme connectée.
              </p>
            </div>
          </div>
        </div>

        {/* Integrations List */}
        <section className="space-y-3">
          <h2 className="font-semibold text-sm">Plateformes disponibles</h2>

          {integrations.map((integration) => {
            const isEditing = editingId === integration.id

            return (
              <div
                key={integration.id}
                className={cn(
                  "pulse-card overflow-hidden transition-all",
                  integration.isConnected && "border-primary/30",
                )}
              >
                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 bg-gradient-to-br",
                        integration.color,
                      )}
                    >
                      {integration.logo}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-base">{integration.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{integration.description}</p>
                        </div>
                        {integration.isConnected && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/15 text-green-600 shrink-0">
                            <Check className="w-3 h-3" />
                            <span className="text-xs font-medium">Connecté</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {integration.features.map((feature) => (
                      <span
                        key={feature}
                        className="text-[10px] px-2 py-1 rounded-md bg-muted text-muted-foreground font-medium"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>

                  {/* Connected State */}
                  {integration.isConnected ? (
                    <div className="space-y-3">
                      {/* Sync Toggle */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                        <div className="flex-1">
                          <p className="text-sm font-medium">Synchronisation automatique</p>
                          <p className="text-xs text-muted-foreground">Mise à jour quotidienne des données</p>
                        </div>
                        <Switch
                          checked={integration.syncEnabled}
                          onCheckedChange={() => handleToggleSync(integration.id)}
                        />
                      </div>

                      {/* Last Sync */}
                      {integration.lastSync && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            Dernière sync: {integration.lastSync.toLocaleDateString("fr-FR")} à{" "}
                            {integration.lastSync.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 rounded-lg"
                            onClick={() => handleSync(integration.id)}
                          >
                            <RefreshCw className="w-3 h-3" />
                            Synchroniser
                          </Button>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 rounded-xl bg-transparent gap-2"
                          onClick={() => setEditingId(integration.id)}
                        >
                          <Key className="w-4 h-4" />
                          Modifier clé API
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 rounded-xl bg-transparent gap-2 text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/30"
                          onClick={() => handleDisconnect(integration.id)}
                        >
                          <X className="w-4 h-4" />
                          Déconnecter
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" className="w-full rounded-xl gap-2" onClick={() => setEditingId(integration.id)}>
                      <Plug className="w-4 h-4" />
                      Connecter
                    </Button>
                  )}
                </div>

                {/* API Key Input (Expanded) */}
                {isEditing && (
                  <div className="p-4 pt-0 border-t border-border">
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium">Clé API</label>
                        <Input
                          type="password"
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                          className="rounded-xl mt-1"
                          placeholder="Entrez votre clé API"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Vous pouvez obtenir votre clé API depuis les paramètres de {integration.name}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 rounded-xl"
                          onClick={() => handleConnect(integration.id)}
                          disabled={!apiKeyInput.trim()}
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Valider
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 rounded-xl bg-transparent"
                          onClick={() => {
                            setEditingId(null)
                            setApiKeyInput("")
                          }}
                        >
                          Annuler
                        </Button>
                      </div>

                      <a
                        href="#"
                        className="flex items-center justify-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Comment obtenir ma clé API ?
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </section>

        {/* Help */}
        <div className="pulse-card p-4 bg-muted/30">
          <h3 className="font-semibold text-sm mb-2">Besoin d'aide ?</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Consultez notre documentation pour configurer vos intégrations ou contactez le support.
          </p>
          <Button variant="outline" size="sm" className="w-full rounded-xl gap-2 bg-transparent">
            <ExternalLink className="w-4 h-4" />
            Voir la documentation
          </Button>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}

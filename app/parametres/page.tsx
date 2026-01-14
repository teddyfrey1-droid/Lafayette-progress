"use client"

import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { Header } from "@/components/pulse/header"
import { useAuth } from "@/components/pulse/auth/auth-provider"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { profile } from "@/lib/demo-data"
import {
  User,
  Moon,
  Sun,
  Bell,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
  Palette,
  Plug,
  UsersIcon,
  Target,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import Link from "next/link"

export default function SettingsPage() {
  const { profile, signOutUser } = useAuth()
  const { theme, setTheme } = useTheme()
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await signOutUser()
    } catch {
      // ignore
    }
    router.push("/connexion")
  }
const settingsGroups = [
    {
      title: "Compte",
      items: [
        {
          icon: User,
          label: "Profil",
          description: "Modifier vos informations",
          action: "chevron",
        },
        {
          icon: Shield,
          label: "Securite",
          description: "Mot de passe et authentification",
          action: "chevron",
        },
      ],
    },
    {
      title: "Administration",
      items: [
        {
          icon: Plug,
          label: "Intégrations API",
          description: "Combo, Zelty, Uber Eats, etc.",
          action: "chevron",
          href: "/parametres/integrations-api",
        },
        {
          icon: Target,
          label: "Configuration objectifs",
          description: "Paramètres avancés des objectifs",
          action: "chevron",
          href: "/parametres/objectifs",
        },
        {
          icon: UsersIcon,
          label: "Utilisateurs",
          description: "Gérer les équipes et statuts",
          action: "chevron",
          href: "/parametres/utilisateurs",
        },
      ],
    },
    {
      title: "Preferences",
      items: [
        {
          icon: theme === "dark" ? Moon : Sun,
          label: "Mode sombre",
          description: "Basculer entre clair et sombre",
          action: "toggle",
          checked: theme === "dark",
          onToggle: () => setTheme(theme === "dark" ? "light" : "dark"),
        },
        {
          icon: Bell,
          label: "Notifications",
          description: "Gerer les alertes",
          action: "chevron",
          href: "/notifications",
        },
        {
          icon: Palette,
          label: "Theme",
          description: "Personnaliser l'apparence",
          action: "chevron",
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          icon: HelpCircle,
          label: "Aide",
          description: "FAQ et documentation",
          action: "chevron",
          href: "/aide",
        },
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Page Title */}
        <div>
          <h1 className="text-2xl font-bold">Parametres</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerez votre compte et preferences</p>
        </div>

        <div className="pulse-card p-4 bg-gradient-to-br from-primary/10 via-card to-accent/10 border-primary/20">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-xl font-bold text-white">
                {(profile?.name || "Utilisateur")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </span>
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-lg">{(profile?.name || "Utilisateur")}</h2>
              <p className="text-sm text-muted-foreground">{(profile?.email || "")}</p>
              <span className="inline-block mt-1 text-xs px-2 py-1 rounded-full bg-primary/15 text-primary font-medium capitalize">
                {(profile?.role || "") === "admin" ? "Super Admin" : (profile?.role || "")}
              </span>
            </div>
          </div>
        </div>

        {/* Settings Groups */}
        {settingsGroups.map((group) => (
          <section key={group.title} className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">{group.title}</h3>
            <div className="pulse-card divide-y divide-border/50">
              {group.items.map((item) => {
                const content = (
                  <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-muted">
                        <item.icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    {item.action === "chevron" && <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                    {item.action === "toggle" && <Switch checked={item.checked} onCheckedChange={item.onToggle} />}
                  </div>
                )

                if ("href" in item && item.href) {
                  return (
                    <Link key={item.label} href={item.href}>
                      {content}
                    </Link>
                  )
                }

                return <div key={item.label}>{content}</div>
              })}
            </div>
          </section>
        ))}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full pulse-card p-4 flex items-center justify-center gap-2 text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Se deconnecter</span>
        </button>

        {/* Version */}
        <p className="text-center text-xs text-muted-foreground">Pulse v2.0.0 - Janvier 2026</p>
      </main>

      <BottomNav />
    </div>
  )
}

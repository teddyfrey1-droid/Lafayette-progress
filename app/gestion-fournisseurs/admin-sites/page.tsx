"use client"

import type React from "react"
import { Suspense, useState, useRef } from "react"
import { Header } from "@/components/pulse/header"
import { useAuth } from "@/components/pulse/auth/auth-provider"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { adminSites, adminSiteCategories } from "@/lib/demo-data"
import type { AdminSite, AdminSiteCategory } from "@/lib/demo-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus,
  ExternalLink,
  Pencil,
  Trash2,
  Settings,
  Truck,
  MessageCircle,
  Users,
  Wallet,
  Search,
  X,
  FolderPlus,
  ArrowLeft,
  Lock,
  Shield,
  Upload,
  ImageIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import Image from "next/image"

const iconMap: Record<string, React.ElementType> = {
  settings: Settings,
  truck: Truck,
  "message-circle": MessageCircle,
  users: Users,
  wallet: Wallet,
}

function AdminSitesContent() {
  const isAdmin = (profile?.role || "") === "admin" || (profile?.role || "") === "manager"

  const [sites, setSites] = useState<AdminSite[]>(adminSites)
  const [categories, setCategories] = useState<AdminSiteCategory[]>(adminSiteCategories)
  const [activeCategory, setActiveCategory] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [editMode, setEditMode] = useState(false)

  const [siteDialogOpen, setSiteDialogOpen] = useState(false)
  const [editingSite, setEditingSite] = useState<AdminSite | null>(null)
  const [siteForm, setSiteForm] = useState({
    name: "",
    description: "",
    url: "",
    category: "",
    logo: "",
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<AdminSiteCategory | null>(null)
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    color: "#8B5CF6",
  })

  const filteredSites = sites.filter((site) => {
    const matchesCategory = activeCategory === "all" || site.category === activeCategory
    const matchesSearch =
      site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const openSiteDialog = (site?: AdminSite) => {
    if (site) {
      setEditingSite(site)
      setSiteForm({
        name: site.name,
        description: site.description,
        url: site.url,
        category: site.category,
        logo: site.logo || "",
      })
    } else {
      setEditingSite(null)
      setSiteForm({ name: "", description: "", url: "", category: categories[0]?.id || "", logo: "" })
    }
    setSiteDialogOpen(true)
  }

  const saveSite = () => {
    if (!siteForm.name || !siteForm.url || !siteForm.category) return

    if (editingSite) {
      setSites(sites.map((s) => (s.id === editingSite.id ? { ...s, ...siteForm } : s)))
    } else {
      setSites([...sites, { id: `as-${Date.now()}`, ...siteForm }])
    }
    setSiteDialogOpen(false)
  }

  const deleteSite = (id: string) => {
    setSites(sites.filter((s) => s.id !== id))
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setSiteForm({ ...siteForm, logo: reader.result as string })
      }
      reader.readAsDataURL(file)
    }
  }

  const openCategoryDialog = (category?: AdminSiteCategory) => {
    if (category) {
      setEditingCategory(category)
      setCategoryForm({ name: category.name, color: category.color })
    } else {
      setEditingCategory(null)
      setCategoryForm({ name: "", color: "#8B5CF6" })
    }
    setCategoryDialogOpen(true)
  }

  const saveCategory = () => {
    if (!categoryForm.name) return

    if (editingCategory) {
      setCategories(
        categories.map((c) =>
          c.id === editingCategory.id ? { ...c, name: categoryForm.name, color: categoryForm.color } : c,
        ),
      )
    } else {
      const newId = categoryForm.name.toLowerCase().replace(/\s+/g, "-")
      setCategories([
        ...categories,
        { id: newId, name: categoryForm.name, icon: "settings", color: categoryForm.color },
      ])
    }
    setCategoryDialogOpen(false)
  }

  const deleteCategory = (id: string) => {
    setCategories(categories.filter((c) => c.id !== id))
    setSites(sites.filter((s) => s.category !== id))
    if (activeCategory === id) setActiveCategory("all")
  }

  // Show access denied for non-admins
  if (!isAdmin) {
    return (
      <main className="px-4 py-6 max-w-2xl mx-auto">
        <Link
          href="/gestion-fournisseurs"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Gestion & Fournisseurs</span>
        </Link>

        <div className="pulse-card p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold mb-2">Accès restreint</h2>
          <p className="text-muted-foreground">
            Cette page est réservée aux administrateurs. Veuillez contacter votre responsable pour plus d'informations.
          </p>
        </div>
      </main>
    )
  }

  return (
    <>
      <main className="px-4 py-6 max-w-2xl mx-auto">
        {/* Back link */}
        <Link
          href="/gestion-fournisseurs"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Gestion & Fournisseurs</span>
        </Link>

        {/* Header with admin badge */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">Sites Admin</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold flex items-center gap-1">
                <Lock className="w-3 h-3" />
                ADMIN UNIQUEMENT
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Outils internes et plateformes de gestion</p>
          </div>
          <Button variant={editMode ? "default" : "outline"} size="sm" onClick={() => setEditMode(!editMode)}>
            {editMode ? "Terminer" : "Modifier"}
          </Button>
        </div>

        {/* Info banner */}
        <div className="pulse-card p-4 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-1">Accès restreint</h3>
              <p className="text-xs text-muted-foreground">
                Cette page contient les outils internes réservés aux administrateurs : plateformes de livraison, gestion
                RH, comptabilité, etc.
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un outil..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card border-border"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          <button
            onClick={() => setActiveCategory("all")}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
              activeCategory === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground",
            )}
          >
            Tous
          </button>
          {categories.map((cat) => {
            const Icon = iconMap[cat.icon] || Settings
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                  activeCategory === cat.id
                    ? "text-white"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground",
                )}
                style={{ backgroundColor: activeCategory === cat.id ? cat.color : undefined }}
              >
                <Icon className="w-4 h-4" />
                {cat.name}
                {editMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteCategory(cat.id)
                    }}
                    className="ml-1 hover:text-red-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </button>
            )
          })}
          {editMode && (
            <button
              onClick={() => openCategoryDialog()}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap bg-card border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              Catégorie
            </button>
          )}
        </div>

        {editMode && (
          <Button onClick={() => openSiteDialog()} className="w-full mb-6" variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un outil
          </Button>
        )}

        {/* Sites list - Updated to display logos */}
        <div className="space-y-3">
          {filteredSites.length === 0 ? (
            <div className="text-center py-12">
              <Settings className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Aucun outil trouvé</p>
            </div>
          ) : (
            filteredSites.map((site) => {
              const category = categories.find((c) => c.id === site.category)
              const Icon = category ? iconMap[category.icon] || Settings : Settings

              return (
                <div key={site.id} className="p-4 rounded-2xl bg-card border border-border">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                      style={{ backgroundColor: site.logo ? "transparent" : `${category?.color}20` }}
                    >
                      {site.logo ? (
                        <Image
                          src={site.logo || "/placeholder.svg"}
                          alt={site.name}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <Icon className="w-6 h-6" style={{ color: category?.color }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{site.name}</h3>
                        {category && (
                          <span
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: `${category.color}20`, color: category.color }}
                          >
                            {category.name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{site.description}</p>
                      <div className="flex items-center gap-2">
                        <a
                          href={site.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                        >
                          Ouvrir
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        {editMode && (
                          <>
                            <button
                              onClick={() => openSiteDialog(site)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => deleteSite(site.id)}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </main>

      {/* Site Dialog - Added logo upload field */}
      <Dialog open={siteDialogOpen} onOpenChange={setSiteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSite ? "Modifier l'outil" : "Ajouter un outil"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Logo upload section */}
            <div>
              <label className="text-sm font-medium mb-2 block">Logo</label>
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {siteForm.logo ? (
                    <Image
                      src={siteForm.logo || "/placeholder.svg"}
                      alt="Logo preview"
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Importer un logo
                  </Button>
                  {siteForm.logo && (
                    <button
                      onClick={() => setSiteForm({ ...siteForm, logo: "" })}
                      className="text-xs text-muted-foreground hover:text-destructive mt-2 block"
                    >
                      Supprimer le logo
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Nom</label>
              <Input
                value={siteForm.name}
                onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
                placeholder="Nom de l'outil"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea
                value={siteForm.description}
                onChange={(e) => setSiteForm({ ...siteForm, description: e.target.value })}
                placeholder="Description de l'outil"
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">URL</label>
              <Input
                value={siteForm.url}
                onChange={(e) => setSiteForm({ ...siteForm, url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Catégorie</label>
              <Select
                value={siteForm.category}
                onValueChange={(value) => setSiteForm({ ...siteForm, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setSiteDialogOpen(false)}>
                Annuler
              </Button>
              <Button className="flex-1" onClick={saveSite}>
                {editingSite ? "Enregistrer" : "Ajouter"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Modifier la catégorie" : "Nouvelle catégorie"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Nom</label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="Nom de la catégorie"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Couleur</label>
              <div className="flex gap-2">
                {["#10B981", "#8B5CF6", "#06B6D4", "#EF4444", "#F59E0B", "#EC4899"].map((color) => (
                  <button
                    key={color}
                    onClick={() => setCategoryForm({ ...categoryForm, color })}
                    className={cn(
                      "w-8 h-8 rounded-full transition-transform",
                      categoryForm.color === color &&
                        "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110",
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setCategoryDialogOpen(false)}>
                Annuler
              </Button>
              <Button className="flex-1" onClick={saveCategory}>
                {editingCategory ? "Enregistrer" : "Ajouter"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function AdminSitesPage() {
  const { profile } = useAuth()
  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <Suspense fallback={null}>
        <AdminSitesContent />
      </Suspense>
      <BottomNav />
    </div>
  )
}

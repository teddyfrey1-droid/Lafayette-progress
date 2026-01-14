"use client"

import type React from "react"
import { Suspense, useState } from "react"
import { Header } from "@/components/pulse/header"
import { useAuth } from "@/components/pulse/auth/auth-provider"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { usefulSites, siteCategories, usefulContacts } from "@/lib/demo-data"
import type { UsefulSite, SiteCategory } from "@/lib/demo-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Plus,
  ExternalLink,
  Pencil,
  Trash2,
  HeartHandshake,
  Gift,
  Calendar,
  HeartPulse,
  GraduationCap,
  Users,
  Search,
  X,
  FolderPlus,
  Globe,
  Phone,
  Landmark,
  Home,
  Briefcase,
} from "lucide-react"
import { cn } from "@/lib/utils"

const iconMap: Record<string, React.ElementType> = {
  "heart-handshake": HeartHandshake,
  gift: Gift,
  calendar: Calendar,
  "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap,
  users: Users,
  landmark: Landmark,
  home: Home,
  briefcase: Briefcase,
}

function SitesContactsContent() {
  const isAdmin = (profile?.role || "") === "admin" || (profile?.role || "") === "manager"
  const [sites, setSites] = useState<UsefulSite[]>(usefulSites)
  const [categories, setCategories] = useState<SiteCategory[]>(siteCategories)
  const [contacts, setContacts] = useState(usefulContacts)
  const [activeCategory, setActiveCategory] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [editMode, setEditMode] = useState(false)
  const [activeTab, setActiveTab] = useState<"sites" | "contacts">("sites")

  const [siteDialogOpen, setSiteDialogOpen] = useState(false)
  const [editingSite, setEditingSite] = useState<UsefulSite | null>(null)
  const [siteForm, setSiteForm] = useState({
    name: "",
    description: "",
    url: "",
    category: "",
  })

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<SiteCategory | null>(null)
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    color: "#8B5CF6",
  })

  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<(typeof usefulContacts)[0] | null>(null)
  const [contactForm, setContactForm] = useState({
    name: "",
    phone: "",
    role: "",
    category: "general",
  })

  const filteredSites = sites.filter((site) => {
    const matchesCategory = activeCategory === "all" || site.category === activeCategory
    const matchesSearch =
      site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const filteredContacts = contacts.filter((contact) => {
    return (
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.role.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  // Group sites by category for display
  const sitesByCategory = categories.reduce(
    (acc, category) => {
      const categorySites = sites.filter((site) => site.category === category.id)
      if (categorySites.length > 0) {
        acc[category.id] = categorySites
      }
      return acc
    },
    {} as Record<string, UsefulSite[]>,
  )

  const openSiteDialog = (site?: UsefulSite) => {
    if (site) {
      setEditingSite(site)
      setSiteForm({
        name: site.name,
        description: site.description,
        url: site.url,
        category: site.category,
      })
    } else {
      setEditingSite(null)
      setSiteForm({ name: "", description: "", url: "", category: categories[0]?.id || "" })
    }
    setSiteDialogOpen(true)
  }

  const saveSite = () => {
    if (!siteForm.name || !siteForm.url || !siteForm.category) return

    if (editingSite) {
      setSites(sites.map((s) => (s.id === editingSite.id ? { ...s, ...siteForm } : s)))
    } else {
      setSites([...sites, { id: `s-${Date.now()}`, ...siteForm }])
    }
    setSiteDialogOpen(false)
  }

  const deleteSite = (id: string) => {
    setSites(sites.filter((s) => s.id !== id))
  }

  const openCategoryDialog = (category?: SiteCategory) => {
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
        { id: newId, name: categoryForm.name, icon: "heart-handshake", color: categoryForm.color },
      ])
    }
    setCategoryDialogOpen(false)
  }

  const deleteCategory = (id: string) => {
    setCategories(categories.filter((c) => c.id !== id))
    setSites(sites.filter((s) => s.category !== id))
    if (activeCategory === id) setActiveCategory("all")
  }

  const openContactDialog = (contact?: (typeof usefulContacts)[0]) => {
    if (contact) {
      setEditingContact(contact)
      setContactForm({
        name: contact.name,
        phone: contact.phone,
        role: contact.role,
        category: contact.category,
      })
    } else {
      setEditingContact(null)
      setContactForm({ name: "", phone: "", role: "", category: "general" })
    }
    setContactDialogOpen(true)
  }

  const saveContact = () => {
    if (!contactForm.name || !contactForm.phone) return

    if (editingContact) {
      setContacts(contacts.map((c) => (c.id === editingContact.id ? { ...c, ...contactForm } : c)))
    } else {
      setContacts([...contacts, { id: `c-${Date.now()}`, ...contactForm }])
    }
    setContactDialogOpen(false)
  }

  const deleteContact = (id: string) => {
    setContacts(contacts.filter((c) => c.id !== id))
  }

  return (
    <>
      <main className="px-4 py-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Sites & Contacts Utiles</h1>
            <p className="text-sm text-muted-foreground">Ressources et outils pour vous aider au quotidien</p>
          </div>
          {isAdmin && (
            <Button variant={editMode ? "default" : "outline"} size="sm" onClick={() => setEditMode(!editMode)}>
              {editMode ? "Terminer" : "Modifier"}
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "sites" | "contacts")} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sites" className="gap-2">
              <Globe className="w-4 h-4" />
              Sites utiles
            </TabsTrigger>
            <TabsTrigger value="contacts" className="gap-2">
              <Phone className="w-4 h-4" />
              Contacts rapides
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sites" className="mt-4 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un site..."
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
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
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
                const Icon = iconMap[cat.icon] || HeartHandshake
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
              <Button onClick={() => openSiteDialog()} className="w-full" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un site
              </Button>
            )}

            {/* Sites by category or filtered */}
            {activeCategory === "all" && !searchQuery ? (
              // Show sites grouped by category
              <div className="space-y-6">
                {categories.map((category) => {
                  const categorySites = sites.filter((s) => s.category === category.id)
                  if (categorySites.length === 0) return null

                  const Icon = iconMap[category.icon] || HeartHandshake

                  return (
                    <div key={category.id}>
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${category.color}20` }}
                        >
                          <Icon className="w-4 h-4" style={{ color: category.color }} />
                        </div>
                        <h2 className="font-semibold text-sm" style={{ color: category.color }}>
                          {category.name}
                        </h2>
                        <span className="text-xs text-muted-foreground">({categorySites.length})</span>
                      </div>

                      <div className="grid gap-3">
                        {categorySites.map((site) => (
                          <SiteCard
                            key={site.id}
                            site={site}
                            category={category}
                            editMode={editMode}
                            onEdit={() => openSiteDialog(site)}
                            onDelete={() => deleteSite(site.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              // Show filtered sites
              <div className="space-y-3">
                {filteredSites.length === 0 ? (
                  <div className="text-center py-12">
                    <Globe className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">Aucun site trouvé</p>
                  </div>
                ) : (
                  filteredSites.map((site) => {
                    const category = categories.find((c) => c.id === site.category)
                    return (
                      <SiteCard
                        key={site.id}
                        site={site}
                        category={category}
                        editMode={editMode}
                        onEdit={() => openSiteDialog(site)}
                        onDelete={() => deleteSite(site.id)}
                      />
                    )
                  })
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="contacts" className="mt-4 space-y-4">
            {/* Search contacts */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un contact..."
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

            <p className="text-xs text-muted-foreground">Maintenance, réseau, franchise, prestataires...</p>

            {editMode && (
              <Button onClick={() => openContactDialog()} className="w-full" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un contact
              </Button>
            )}

            <div className="space-y-3">
              {filteredContacts.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Aucun contact trouvé</p>
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <div key={contact.id} className="p-4 rounded-2xl bg-card border border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                          <Phone className="w-5 h-5 text-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate">{contact.name}</h3>
                          <p className="text-xs text-muted-foreground">{contact.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {editMode && (
                          <>
                            <button
                              onClick={() => openContactDialog(contact)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => deleteContact(contact.id)}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </>
                        )}
                        <a
                          href={`tel:${contact.phone.replace(/\./g, "")}`}
                          className="h-8 px-3 rounded-lg bg-accent/10 flex items-center justify-center hover:bg-accent/20 transition-colors"
                        >
                          <span className="text-xs font-medium text-accent">{contact.phone}</span>
                        </a>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Site Dialog */}
      <Dialog open={siteDialogOpen} onOpenChange={setSiteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSite ? "Modifier le site" : "Ajouter un site"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Nom</label>
              <Input
                value={siteForm.name}
                onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
                placeholder="Nom du site"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea
                value={siteForm.description}
                onChange={(e) => setSiteForm({ ...siteForm, description: e.target.value })}
                placeholder="Description du site"
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
                {["#10B981", "#8B5CF6", "#06B6D4", "#EF4444", "#F59E0B", "#EC4899", "#6366F1", "#14B8A6"].map(
                  (color) => (
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
                  ),
                )}
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

      {/* Contact Dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContact ? "Modifier le contact" : "Ajouter un contact"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Nom</label>
              <Input
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                placeholder="Nom du contact"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Téléphone</label>
              <Input
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                placeholder="06.00.00.00.00"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Rôle</label>
              <Input
                value={contactForm.role}
                onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
                placeholder="Ex: Responsable"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setContactDialogOpen(false)}>
                Annuler
              </Button>
              <Button className="flex-1" onClick={saveContact}>
                {editingContact ? "Enregistrer" : "Ajouter"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function SiteCard({
  site,
  category,
  editMode,
  onEdit,
  onDelete,
}: {
  site: UsefulSite
  category?: SiteCategory
  editMode: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const Icon = category ? iconMap[category.icon] || HeartHandshake : HeartHandshake

  return (
    <div className="p-4 rounded-2xl bg-card border border-border">
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${category?.color}20` }}
        >
          <Icon className="w-6 h-6" style={{ color: category?.color }} />
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
              Visiter le site
              <ExternalLink className="w-3 h-3" />
            </a>
            {editMode && (
              <>
                <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SitesContactsUtilesPage() {
  const { profile } = useAuth()
  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <Suspense fallback={null}>
        <SitesContactsContent />
      </Suspense>
      <BottomNav />
    </div>
  )
}

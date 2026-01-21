"use client"

import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { Moon, Sun, Bell, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { SideDrawer } from "./side-drawer"
import { PulseLogo } from "./pulse-logo"
import Link from "next/link"

interface HeaderProps {
  title?: string
  subtitle?: string
  showBack?: boolean
  className?: string
}

export function Header({ title, showBack = false, className }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <header
        className={cn("sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50", className)}
      >
        <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
          {/* Left - Menu and Logo */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setDrawerOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <PulseLogo size="sm" />
          </div>

          {/* Right - Actions */}
          <div className="flex items-center gap-2">
            <Link href="/notifications">
              <Button variant="ghost" size="icon" className="rounded-xl relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="w-5 h-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute w-5 h-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </div>
        </div>
      </header>

      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}

// Compat export: some pages expect a `PulseHeader` component with an optional `subtitle` prop.
// We keep the design consistent by reusing the existing Header and rendering
// a light text block below it when `title`/`subtitle` are provided.
export function PulseHeader({ title, subtitle, showBack, className }: HeaderProps) {
  return (
    <div>
      <Header title={title} showBack={showBack} className={className} />
      {(title || subtitle) && (
        <div className="max-w-lg mx-auto px-4 pt-4">
          {title ? <h1 className="text-xl font-semibold">{title}</h1> : null}
          {subtitle ? <p className="text-sm text-muted-foreground mt-1">{subtitle}</p> : null}
        </div>
      )}
    </div>
  )
}

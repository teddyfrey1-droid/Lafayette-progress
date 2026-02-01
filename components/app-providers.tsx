"use client"

import React from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth/auth-provider"
import { AuthGate } from "@/components/auth/auth-gate"
import { RBACProvider } from "@/components/auth/rbac-provider" // 👈 AJOUTÉ

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange={false}>
      <AuthProvider>
        <AuthGate>
          {/* Le système de permission est chargé une fois l'utilisateur connecté */}
          <RBACProvider>
            {children}
          </RBACProvider>
        </AuthGate>
      </AuthProvider>
    </ThemeProvider>
  )
}

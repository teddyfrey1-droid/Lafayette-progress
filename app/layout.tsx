import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/components/auth/auth-provider"
// CORRECTION : On importe AuthGate au lieu de RequireAuth
import { AuthGate } from "@/components/auth/auth-gate"

const inter = Inter({ subsets: ["latin"] })

// 1. CONFIGURATION PWA & METADATA
export const metadata: Metadata = {
  title: "Pulse App",
  description: "Application de gestion de performance et d'équipes",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pulse App",
  },
  formatDetection: {
    telephone: false,
  },
}

// 2. CONFIGURATION DE L'AFFICHAGE MOBILE (Viewport)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head />
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {/* CORRECTION : Utilisation de AuthGate qui laisse passer /connexion */}
            <AuthGate>
              {children}
            </AuthGate>
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

"use client";

import { useAuth } from "@/components/auth/auth-provider";

// Ce hook sert de pont pour récupérer l'utilisateur connecté partout dans l'app
export function useCurrentUser() {
  const { user } = useAuth();
  return user;
}

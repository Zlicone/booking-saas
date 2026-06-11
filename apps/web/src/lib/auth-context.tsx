"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, tokenStore, ApiError } from "@/lib/api";
import type { Business, LoginPayload, RegisterPayload } from "@/types";

interface AuthContextValue {
  business: Business | null;
  loading: boolean; // true dok provjeravamo postojeći token na startu
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>; // ponovo dohvati profil (npr. nakon izmjene postavki)
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  // Na startu: ako postoji token, dohvati profil (validacija tokena).
  // Odjavljujemo SAMO ako je token stvarno nevažeći (401).
  // Privremene greške (rate limit, restart servera, mreža) -> pokušaj ponovo.
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadSession = async (attempt: number) => {
      try {
        const b = await api.me();
        if (cancelled) return;
        setBusiness(b);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;

        // Stvarno nevažeći/istekao token -> odjava
        if (err instanceof ApiError && err.status === 401) {
          tokenStore.clear();
          setBusiness(null);
          setLoading(false);
          return;
        }

        // Privremena greška -> pokušaj ponovo (do 3 puta), NE briši token
        if (attempt < 3) {
          setTimeout(() => loadSession(attempt + 1), 1500);
          return;
        }

        setLoading(false);
      }
    };

    loadSession(0);
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const { token, business } = await api.login(payload);
    tokenStore.set(token);
    setBusiness(business);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const { token, business } = await api.register(payload);
    tokenStore.set(token);
    setBusiness(business);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setBusiness(null);
  }, []);

  const refresh = useCallback(async () => {
    const b = await api.me();
    setBusiness(b);
  }, []);

  return (
    <AuthContext.Provider
      value={{ business, loading, login, register, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth mora biti unutar <AuthProvider>");
  return ctx;
}

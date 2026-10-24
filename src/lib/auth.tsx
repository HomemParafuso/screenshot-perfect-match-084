import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, clearTokens, getTokens, post, setTokens, type Tokens } from "./api";

export type AdminUser = {
  id: string;
  email: string;
  status: string;
  displayName: string | null;
  locale: string | null;
  preferences: Record<string, unknown>;
  roles: string[];
  createdAt: string;
};

type AuthContextValue = {
  user: AdminUser | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<AdminUser>;
  register: (input: {
    email: string;
    password: string;
    displayName?: string;
  }) => Promise<AdminUser>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!getTokens()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await api<AdminUser>("/me"));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
    const onLogout = () => setUser(null);
    window.addEventListener("hasi:logout", onLogout);
    return () => window.removeEventListener("hasi:logout", onLogout);
  }, [loadMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await post<Tokens & { user: AdminUser }>("/auth/login", { email, password });
    setTokens(res);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; displayName?: string }) => {
      const res = await post<Tokens & { user: AdminUser }>("/auth/register", input);
      setTokens(res);
      setUser(res.user);
      return res.user;
    },
    [],
  );

  const logout = useCallback(async () => {
    const tokens = getTokens();
    try {
      await post("/auth/logout", { refreshToken: tokens?.refreshToken });
    } catch {
      // best effort
    }
    clearTokens();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: !!user?.roles?.includes("admin"),
      login,
      register,
      logout,
      reload: loadMe,
    }),
    [user, loading, login, register, logout, loadMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

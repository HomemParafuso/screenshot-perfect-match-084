import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity, Bot, CreditCard, KeyRound, LayoutDashboard, ListChecks, LogOut, Puzzle, ScrollText, Smartphone, Tags, Users,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, hasSession, logout } from "@/lib/api";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_admin")({ component: AdminLayout });

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/users", label: "Usuários", icon: Users },
  { to: "/plans", label: "Planos", icon: Tags },
  { to: "/subscriptions", label: "Assinaturas", icon: CreditCard },
  { to: "/entitlements", label: "Entitlements", icon: ListChecks },
  { to: "/provider-keys", label: "Provedores BYOK", icon: KeyRound },
  { to: "/skills", label: "Skills", icon: Puzzle },
  { to: "/agents", label: "Agentes", icon: Bot },
  { to: "/devices", label: "Dispositivos", icon: Smartphone },
  { to: "/remote-usage", label: "Uso remoto", icon: Activity },
  { to: "/audit", label: "Auditoria", icon: ScrollText },
] as const;

function AdminLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!hasSession()) navigate({ to: "/login", replace: true });
    else setReady(true);
  }, [navigate]);
  const me = useQuery({ queryKey: ["/me"], queryFn: () => api("/me"), enabled: ready, retry: false });

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) navigate({ to: "/login", replace: true });
  }, [me.error, navigate]);

  if (!ready || me.isLoading) return <div className="bg-grid min-h-screen" />;
  if (me.error)
    return (
      <Center>
        <p className="text-sm text-destructive">{(me.error as Error).message}</p>
        <Button variant="outline" onClick={() => navigate({ to: "/login" })}>Voltar ao login</Button>
      </Center>
    );
  const signOut = async () => {
    await logout();
    qc.clear();
    navigate({ to: "/login" });
  };
  if (!me.data?.is_admin)
    return (
      <Center>
        <p className="text-sm">Conta <b>{me.data?.email}</b> criada. O painel global é restrito a administradores.</p>
        <Button variant="outline" onClick={signOut}>Sair</Button>
      </Center>
    );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
          <div className="grid h-8 w-8 place-items-center rounded bg-primary font-mono text-sm font-bold text-primary-foreground">H</div>
          <div>
            <div className="text-sm font-semibold leading-none">HASi</div>
            <div className="label-mono mt-1">Control Plane</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex items-center gap-2.5 rounded px-2.5 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-primary" }}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="truncate px-2 font-mono text-xs text-muted-foreground">{me.data.email}</div>
          <button onClick={signOut} className="mt-2 flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex gap-2 overflow-x-auto border-b bg-sidebar px-3 py-2 md:hidden">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="whitespace-nowrap rounded px-2 py-1 text-xs" activeProps={{ className: "bg-sidebar-accent text-primary" }}>
              {n.label}
            </Link>
          ))}
          <button onClick={signOut} className="whitespace-nowrap px-2 text-xs">Sair</button>
        </header>
        <main className="mx-auto max-w-7xl p-5 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const Center = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-grid flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">{children}</div>
);

import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Bot,
  CreditCard,
  Cpu,
  FileClock,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/users", label: "Usuários", icon: Users },
  { to: "/plans", label: "Planos", icon: Wallet },
  { to: "/subscriptions", label: "Assinaturas", icon: CreditCard },
  { to: "/entitlements", label: "Entitlements", icon: ShieldCheck },
  { to: "/provider-keys", label: "Chaves BYOK", icon: KeyRound },
  { to: "/skills", label: "Skills", icon: Sparkles },
  { to: "/agents", label: "Agentes", icon: Bot },
  { to: "/devices", label: "Dispositivos", icon: Smartphone },
  { to: "/remote", label: "Uso remoto", icon: Cpu },
  { to: "/audit", label: "Auditoria", icon: FileClock },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-muted/30">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-background md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <Activity className="size-5 text-primary" />
          <div>
            <p className="text-sm font-semibold leading-none">HASi</p>
            <p className="text-xs text-muted-foreground">Control Plane</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavLinks />
        </div>
        <div className="border-t p-3">
          <p className="truncate px-2 pb-2 text-xs text-muted-foreground">{user?.email}</p>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => void logout()}
          >
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden">
                  <Menu className="size-4" />
                  <span className="sr-only">Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-3">
                <SheetTitle className="flex items-center gap-2 px-2 py-3">
                  <Activity className="size-5 text-primary" /> HASi Control Plane
                </SheetTitle>
                <NavLinks onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <span className="text-sm font-medium">Painel administrativo</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void logout()}>
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </header>
        <main className="mx-auto w-full max-w-7xl p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

export function Loading() {
  return <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>;
}

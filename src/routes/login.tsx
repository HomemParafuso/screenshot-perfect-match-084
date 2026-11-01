import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/hasi/AuthShell";
import { enterDemo, errorMessage, login } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { DEMO_EMAIL } from "@/lib/demo-api";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — HASi Control Plane" }, { name: "description", content: "Acesso ao painel administrativo do HASi." }, { property: "og:title", content: "Entrar — HASi Control Plane" }, { property: "og:description", content: "Acesso ao painel administrativo do HASi." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  return (
    <AuthShell title="Entrar" subtitle="Acesso restrito ao painel administrativo.">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            if (demo) await enterDemo(email, password);
            else await login(email, password);
            navigate({ to: "/dashboard" });
          } catch (x) {
            setErr(errorMessage(x));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="demo-mode">Modo demonstração</Label>
          <Switch id="demo-mode" checked={demo} onCheckedChange={(value) => { setDemo(value); setErr(null); if (value) setEmail(DEMO_EMAIL); }} />
        </div>
        {demo && <p className="text-xs text-muted-foreground">Dados fictícios · sem conexão com o servidor real</p>}
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label htmlFor="pw">Senha</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">Esqueci a senha</Link>
          </div>
          <Input id="pw" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button className="w-full" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</Button>
        <p className="text-center text-xs text-muted-foreground">
          Sem conta? <Link to="/register" className="text-primary hover:underline">Cadastre-se</Link>
        </p>
      </form>
    </AuthShell>
  );
}

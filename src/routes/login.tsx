import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/hasi/AuthShell";
import { errorMessage, login } from "@/lib/api";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — HASi Control Plane" }, { name: "description", content: "Acesso ao painel administrativo do HASi." }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <AuthShell title="Entrar" subtitle="Acesso restrito ao painel administrativo.">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            await login(email, password);
            navigate({ to: "/dashboard" });
          } catch (x) {
            setErr(errorMessage(x));
          } finally {
            setBusy(false);
          }
        }}
      >
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

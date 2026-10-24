import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/admin/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function loginError(err: unknown) {
  if (err instanceof ApiError) {
    if (err.code === "invalid_credentials") return "E-mail ou senha inválidos.";
    if (err.code === "account_suspended") return "Esta conta está suspensa.";
    if (err.code === "validation_error") return "Verifique os dados informados.";
  }
  return "Não foi possível entrar. Tente novamente.";
}

function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/", replace: true });
  }, [loading, user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      toast.success("Bem-vindo de volta");
      void navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(loginError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Entrar"
      description="Acesso restrito à equipe administrativa."
      footer={
        <>
          Não tem conta?{" "}
          <Link to="/register" className="text-primary underline-offset-4 hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link
              to="/forgot-password"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Esqueci a senha
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </AuthShell>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/admin/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const { register, user, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ displayName: "", email: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/", replace: true });
  }, [loading, user, navigate]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error("As senhas não conferem.");
      return;
    }
    if (form.password.length < 12) {
      toast.error("A senha deve ter no mínimo 12 caracteres.");
      return;
    }
    setBusy(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        ...(form.displayName ? { displayName: form.displayName } : {}),
      });
      toast.success("Conta criada. Um administrador precisa liberar o acesso ao painel.");
      void navigate({ to: "/", replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("Este e-mail já está cadastrado.");
      } else if (err instanceof ApiError && err.code === "validation_error") {
        toast.error("Dados inválidos. Verifique e-mail e senha (mín. 12 caracteres).");
      } else {
        toast.error("Não foi possível criar a conta.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Criar conta"
      description="Cadastro de usuário do HASi."
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="text-primary underline-offset-4 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            value={form.displayName}
            onChange={(e) => set("displayName", e.target.value)}
            maxLength={120}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha (mínimo 12 caracteres)</Label>
          <Input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirmar senha</Label>
          <Input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => set("confirm", e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Criando…" : "Criar conta"}
        </Button>
      </form>
    </AuthShell>
  );
}

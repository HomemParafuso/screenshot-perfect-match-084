import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/admin/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, post } from "@/lib/api";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => {
    const token = typeof search["token"] === "string" ? search["token"] : undefined;
    return token ? { token } : {};
  },
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      toast.error("Link inválido. Solicite uma nova recuperação de senha.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }
    if (password.length < 12) {
      toast.error("A senha deve ter no mínimo 12 caracteres.");
      return;
    }
    setBusy(true);
    try {
      await post("/auth/reset-password", { token, password });
      toast.success("Senha redefinida. Faça login novamente.");
      void navigate({ to: "/login", replace: true });
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.status === 400
          ? "Link inválido ou expirado."
          : "Não foi possível redefinir a senha.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Definir nova senha"
      description="Escolha uma senha forte com pelo menos 12 caracteres."
      footer={
        <Link to="/login" className="text-primary underline-offset-4 hover:underline">
          Voltar para o login
        </Link>
      }
    >
      {!token ? (
        <p className="text-sm text-destructive">
          O link não contém um token. Solicite uma nova recuperação de senha.
        </p>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmar senha</Label>
            <Input
              id="confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Salvando…" : "Redefinir senha"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

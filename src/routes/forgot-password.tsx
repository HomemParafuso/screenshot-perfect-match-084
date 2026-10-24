import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/admin/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { post } from "@/lib/api";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await post("/auth/forgot-password", { email });
      setSent(true);
    } catch {
      toast.error("Não foi possível processar a solicitação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Recuperar senha"
      description="Enviaremos um link de redefinição para o seu e-mail."
      footer={
        <Link to="/login" className="text-primary underline-offset-4 hover:underline">
          Voltar para o login
        </Link>
      }
    >
      {sent ? (
        <p className="text-sm text-muted-foreground">
          Se o e-mail existir, um link de redefinição foi enviado. O link vale por 1 hora.
        </p>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Enviando…" : "Enviar link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/hasi/AuthShell";
import { errorMessage, forgotPassword } from "@/lib/api";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Recuperar senha — HASi Control Plane" }, { name: "description", content: "Recuperação de senha do HASi." }] }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <AuthShell title="Recuperar senha" subtitle="Enviaremos um link válido por 30 minutos.">
      {sent ? (
        <p className="text-sm">Se houver uma conta com esse e-mail, o link de redefinição foi enviado.</p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            try {
              await forgotPassword(email);
              setSent(true);
            } catch (x) {
              setErr(errorMessage(x));
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button className="w-full">Enviar link</Button>
        </form>
      )}
      <p className="mt-4 text-center text-xs"><Link to="/login" className="text-primary hover:underline">Voltar ao login</Link></p>
    </AuthShell>
  );
}

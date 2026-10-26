import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/hasi/AuthShell";
import { errorMessage, resetPassword } from "@/lib/api";

export const Route = createFileRoute("/reset-password")({
  validateSearch: z.object({ token: z.string().optional() }),
  head: () => ({ meta: [{ title: "Nova senha — HASi Control Plane" }, { name: "description", content: "Definir nova senha." }] }),
  component: ResetPage,
});

function ResetPage() {
  const { token } = Route.useSearch();
  const [pw, setPw] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <AuthShell title="Definir nova senha" subtitle="Todas as sessões ativas serão encerradas.">
      {!token ? (
        <p className="text-sm text-destructive">Link inválido.</p>
      ) : done ? (
        <p className="text-sm">Senha alterada. <Link to="/login" className="text-primary hover:underline">Entrar</Link></p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            try {
              await resetPassword(token, pw);
              setDone(true);
            } catch (x) {
              setErr(errorMessage(x));
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="pw">Nova senha</Label>
            <Input id="pw" type="password" required minLength={10} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button className="w-full">Salvar</Button>
        </form>
      )}
    </AuthShell>
  );
}

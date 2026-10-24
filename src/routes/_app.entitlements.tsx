import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EntitlementEditor } from "@/components/admin/entitlement-editor";
import { Loading, PageHeader } from "@/components/admin/shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Plan } from "@/lib/types";

export const Route = createFileRoute("/_app/entitlements")({
  component: EntitlementsPage,
});

function EntitlementsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: () => api<{ plans: Plan[] }>("/admin/plans"),
  });
  const [selected, setSelected] = useState("");

  const plan = data?.plans.find((p) => p.id === selected) ?? data?.plans[0];

  return (
    <div>
      <PageHeader title="Entitlements" description="Defina quais recursos cada plano libera" />

      {isLoading ? (
        <Loading />
      ) : !plan ? (
        <p className="text-sm text-muted-foreground">Cadastre um plano primeiro.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Planos</CardTitle>
              <CardDescription>Selecione para editar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data?.plans.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    p.id === plan.id ? "border-primary bg-primary/5" : "hover:bg-accent"
                  }`}
                >
                  <span className="block font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.code} · {formatMoney(p.monthly_price_cents, p.currency)}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{plan.name}</CardTitle>
              <CardDescription>
                Assinaturas em trial ou ativas recebem estes recursos. Limites vazios significam
                ilimitado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3 space-y-1">
                <Label>Plano selecionado</Label>
                <p className="text-sm text-muted-foreground">{plan.code}</p>
              </div>
              <EntitlementEditor planId={plan.id} entitlements={plan.entitlements} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

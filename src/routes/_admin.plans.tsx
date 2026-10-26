import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { DataState, Mono, PageHeader, Pill, useApi } from "@/components/hasi/ui";
import { DataTable } from "@/components/hasi/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { errorMessage, patch, post } from "@/lib/api";
import { fmtMoney } from "@/lib/format";

export const Route = createFileRoute("/_admin/plans")({
  head: () => ({ meta: [{ title: "Planos — HASi Control Plane" }] }),
  component: PlansPage,
});

export type Plan = {
  id: string; code: string; name: string; monthly_price_cents: number; currency: string; is_active: boolean;
  entitlements: { feature: string; enabled: boolean; limit: number | null }[];
};

function PlansPage() {
  const q = useApi<Plan[]>("/admin/plans");
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: (p: Plan) => patch(`/admin/plans/${p.id}`, { is_active: !p.is_active }),
    onSuccess: () => qc.invalidateQueries(),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <>
      <PageHeader kicker="Mensalidade" title="Planos" actions={<PlanDialog />} />
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        A mensalidade libera o app e os recursos do plano. Sem créditos ou recargas. Os modelos gratuitos do OpenCode não são afetados.
      </p>
      <DataState q={q} empty="Nenhum plano criado ainda.">
        {(plans) => (
          <DataTable rows={plans} cols={[
            { header: "Nome", cell: (p) => <span className="font-medium">{p.name}</span> },
            { header: "Código", cell: (p) => <Mono>{p.code}</Mono> },
            { header: "Mensal", cell: (p) => <Mono>{fmtMoney(p.monthly_price_cents, p.currency)}</Mono> },
            { header: "Recursos", cell: (p) => <Mono>{p.entitlements.filter((e) => e.enabled).length}/8</Mono> },
            { header: "Status", cell: (p) => <Pill tone={p.is_active ? "active" : "canceled"}>{p.is_active ? "Ativo" : "Inativo"}</Pill> },
            { header: "", cell: (p) => (
              <div className="flex justify-end gap-2">
                <PlanDialog plan={p} />
                <Button size="sm" variant="ghost" onClick={() => toggle.mutate(p)}>{p.is_active ? "Desativar" : "Ativar"}</Button>
              </div>
            ) },
          ]} />
        )}
      </DataState>
    </>
  );
}

function PlanDialog({ plan }: { plan?: Plan }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ code: plan?.code ?? "", name: plan?.name ?? "", price: plan ? String(plan.monthly_price_cents / 100) : "", currency: plan?.currency ?? "BRL" });
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => {
      const body = { code: f.code, name: f.name, monthly_price_cents: Math.round(Number(f.price.replace(",", ".")) * 100), currency: f.currency };
      return plan ? patch(`/admin/plans/${plan.id}`, body) : post("/admin/plans", body);
    },
    onSuccess: () => { toast.success("Plano salvo"); setOpen(false); qc.invalidateQueries(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {plan ? <Button size="sm" variant="outline">Editar</Button> : <Button><Plus className="mr-1 h-4 w-4" />Novo plano</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{plan ? "Editar plano" : "Novo plano"}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <div className="space-y-1.5"><Label>Nome</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Código (a-z, 0-9, -)</Label><Input required pattern="[a-z0-9_\-]{2,40}" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1.5"><Label>Preço mensal</Label><Input required inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Moeda</Label><Input required maxLength={3} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} /></div>
          </div>
          <Button className="w-full" disabled={m.isPending}>Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

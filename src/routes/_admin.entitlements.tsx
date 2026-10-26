import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DataState, PageHeader, Panel, useApi } from "@/components/hasi/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { errorMessage, put } from "@/lib/api";
import { FEATURE_LABELS } from "@/lib/format";
import type { Plan } from "./_admin.plans";

export const Route = createFileRoute("/_admin/entitlements")({
  head: () => ({ meta: [{ title: "Entitlements — HASi Control Plane" }] }),
  component: EntitlementsPage,
});

function EntitlementsPage() {
  const q = useApi<Plan[]>("/admin/plans");
  return (
    <>
      <PageHeader kicker="Permissões por plano" title="Entitlements" />
      <DataState q={q} empty="Crie um plano para configurar seus recursos.">
        {(plans) => <div className="grid gap-4 lg:grid-cols-2">{plans.map((p) => <PlanEnt key={p.id} plan={p} />)}</div>}
      </DataState>
    </>
  );
}

function PlanEnt({ plan }: { plan: Plan }) {
  const [items, setItems] = useState(plan.entitlements);
  useEffect(() => setItems(plan.entitlements), [plan.entitlements]);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => put(`/admin/plans/${plan.id}/entitlements`, items),
    onSuccess: () => { toast.success(`Recursos de ${plan.name} salvos`); qc.invalidateQueries(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const set = (i: number, v: Partial<(typeof items)[number]>) => setItems(items.map((x, j) => (j === i ? { ...x, ...v } : x)));
  return (
    <Panel title={plan.name} actions={<Button size="sm" onClick={() => m.mutate()} disabled={m.isPending}>Salvar</Button>}>
      <ul className="divide-y">
        {items.map((e, i) => {
          const meta = FEATURE_LABELS[e.feature];
          return (
            <li key={e.feature} className="flex items-center justify-between gap-3 py-2">
              <div>
                <div className="text-sm">{meta?.label ?? e.feature}</div>
                <div className="font-mono text-[0.68rem] text-muted-foreground">{e.feature}</div>
              </div>
              <div className="flex items-center gap-2">
                {meta?.limit && (
                  <Input
                    className="h-8 w-28 font-mono text-xs"
                    inputMode="numeric"
                    placeholder="sem limite"
                    disabled={!e.enabled}
                    value={e.limit ?? ""}
                    onChange={(ev) => set(i, { limit: ev.target.value === "" ? null : Math.max(0, parseInt(ev.target.value) || 0) })}
                  />
                )}
                <Switch checked={e.enabled} onCheckedChange={(c) => set(i, { enabled: c })} />
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { DataState, Mono, PageHeader, Panel, Pill, StatusPill, useApi } from "@/components/hasi/ui";
import { DataTable } from "@/components/hasi/DataTable";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { errorMessage, post, put } from "@/lib/api";
import { FEATURE_LABELS, fmtDate, SUB_STATUS } from "@/lib/format";

export const Route = createFileRoute("/_admin/users/$id")({
  head: () => ({ meta: [{ title: "Detalhes do usuário — HASi Control Plane" }] }),
  component: UserDetail,
});

type Detail = {
  user: { id: string; email: string; status: string; display_name: string | null; created_at: string; is_admin: boolean };
  entitlements: { entitled: boolean; features: Record<string, { enabled: boolean; limit: number | null }>; subscription: null | { status: string; plan_name: string; current_period_end: string } };
  subscriptions: { id: string; status: string; plan_name: string; plan_id: string; current_period_end: string; created_at: string }[];
  devices: { id: string; name: string; platform: string; app_version: string | null; last_seen_at: string | null; revoked_at: string | null }[];
  provider_keys: { id: string; provider: string; label: string | null; last4: string; created_at: string }[];
  skills: { id: string; name: string; description: string | null; enabled: boolean }[];
  agents: { id: string; name: string; description: string | null; enabled: boolean }[];
  remote_sessions: { id: string; provider: string; status: string; created_at: string }[];
};

function UserDetail() {
  const { id } = Route.useParams();
  const q = useApi<Detail>(`/admin/users/${id}`);
  const qc = useQueryClient();
  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => { toast.success("Atualizado"); qc.invalidateQueries(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <Link to="/users" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" />Usuários</Link>
      <DataState q={q} isEmpty={() => false}>
        {(d) => (
          <>
            <PageHeader
              kicker={d.user.id}
              title={d.user.display_name || d.user.email}
              actions={
                <>
                  <Button variant="outline" size="sm" onClick={() => act.mutate(() => put(`/admin/users/${id}/admin`, { is_admin: !d.user.is_admin }))}>
                    {d.user.is_admin ? "Remover admin" : "Tornar admin"}
                  </Button>
                  {d.user.status === "active" ? (
                    <Button variant="destructive" size="sm" onClick={() => confirm("Suspender este usuário e encerrar suas sessões?") && act.mutate(() => post(`/admin/users/${id}/suspend`))}>Suspender</Button>
                  ) : (
                    <Button size="sm" onClick={() => act.mutate(() => post(`/admin/users/${id}/reactivate`))}>Reativar</Button>
                  )}
                </>
              }
            />
            <div className="mb-6 flex flex-wrap gap-2 text-sm">
              <span className="text-muted-foreground">{d.user.email}</span>
              <Pill tone={d.user.status}>{d.user.status === "active" ? "Ativa" : "Suspensa"}</Pill>
              {d.user.is_admin && <Pill tone="admin">Admin</Pill>}
              <span className="font-mono text-xs text-muted-foreground">desde {fmtDate(d.user.created_at)}</span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Assinatura">
                <SubscriptionEditor userId={id} current={d.subscriptions.find((s) => s.status !== "canceled")} onSave={(fn) => act.mutate(fn)} />
              </Panel>
              <Panel title="Permissões efetivas">
                <ul className="grid gap-1.5 text-sm">
                  {Object.entries(d.entitlements.features).map(([k, v]) => (
                    <li key={k} className="flex justify-between">
                      <span className={v.enabled ? "" : "text-muted-foreground"}>{FEATURE_LABELS[k]?.label ?? k}</span>
                      <Mono>{v.enabled ? (v.limit !== null ? v.limit : "sim") : "não"}</Mono>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>

            <div className="mt-4 grid gap-4">
              <Panel title={`Dispositivos (${d.devices.length})`}>
                {d.devices.length === 0 ? <Empty /> : (
                  <DataTable rows={d.devices} cols={[
                    { header: "Nome", cell: (x) => x.name },
                    { header: "Plataforma", cell: (x) => <Mono>{x.platform} {x.app_version}</Mono> },
                    { header: "Último acesso", cell: (x) => <Mono>{fmtDate(x.last_seen_at)}</Mono> },
                    { header: "", cell: (x) => x.revoked_at ? <Pill tone="revoked">Revogado</Pill> : (
                      <Button size="sm" variant="outline" onClick={() => act.mutate(() => post(`/admin/users/${id}/devices/${x.id}/revoke`))}>Revogar</Button>
                    ) },
                  ]} />
                )}
              </Panel>
              <Panel title="Chaves BYOK">
                {d.provider_keys.length === 0 ? <Empty /> : (
                  <DataTable rows={d.provider_keys} cols={[
                    { header: "Provedor", cell: (x) => x.provider },
                    { header: "Rótulo", cell: (x) => x.label ?? "—" },
                    { header: "Chave", cell: (x) => <Mono>••••••••{x.last4}</Mono> },
                    { header: "Criada", cell: (x) => <Mono>{fmtDate(x.created_at)}</Mono> },
                  ]} />
                )}
              </Panel>
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Skills">{d.skills.length === 0 ? <Empty /> : <SimpleList items={d.skills} />}</Panel>
                <Panel title="Agentes">{d.agents.length === 0 ? <Empty /> : <SimpleList items={d.agents} />}</Panel>
              </div>
              <Panel title="Sessões remotas">
                {d.remote_sessions.length === 0 ? <Empty text="Nenhuma sessão remota registrada." /> : (
                  <DataTable rows={d.remote_sessions} cols={[
                    { header: "Provedor", cell: (x) => x.provider },
                    { header: "Status", cell: (x) => <Mono>{x.status}</Mono> },
                    { header: "Criada", cell: (x) => <Mono>{fmtDate(x.created_at)}</Mono> },
                  ]} />
                )}
              </Panel>
            </div>
          </>
        )}
      </DataState>
    </>
  );
}

const Empty = ({ text = "Nenhum registro." }: { text?: string }) => <p className="text-sm text-muted-foreground">{text}</p>;

const SimpleList = ({ items }: { items: { id: string; name: string; description: string | null; enabled: boolean }[] }) => (
  <ul className="space-y-2 text-sm">
    {items.map((i) => (
      <li key={i.id} className="flex justify-between gap-2">
        <span>{i.name} <span className="text-muted-foreground">{i.description}</span></span>
        <Mono>{i.enabled ? "ativo" : "inativo"}</Mono>
      </li>
    ))}
  </ul>
);

function SubscriptionEditor({ userId, current, onSave }: {
  userId: string;
  current: { status: string; plan_id: string; plan_name: string; current_period_end: string } | undefined;
  onSave: (fn: () => Promise<unknown>) => void;
}) {
  const plans = useApi<{ id: string; name: string; is_active: boolean }[]>("/admin/plans");
  const [planId, setPlanId] = useState(current?.plan_id ?? "");
  const [status, setStatus] = useState(current?.status ?? "active");
  return (
    <div className="space-y-3">
      {current ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <b>{current.plan_name}</b> <StatusPill status={current.status} />
          <span className="font-mono text-xs text-muted-foreground">até {fmtDate(current.current_period_end)}</span>
        </div>
      ) : <p className="text-sm text-muted-foreground">Sem assinatura.</p>}
      <div className="flex flex-wrap gap-2">
        <Select value={planId} onValueChange={setPlanId}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Plano" /></SelectTrigger>
          <SelectContent>
            {(plans.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.is_active ? "" : " (inativo)"}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(SUB_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button disabled={!planId} onClick={() => onSave(() => put(`/admin/users/${userId}/subscription`, { plan_id: planId, status }))}>Salvar</Button>
      </div>
      {plans.data?.length === 0 && <p className="text-xs text-muted-foreground">Crie um plano em Planos primeiro.</p>}
    </div>
  );
}

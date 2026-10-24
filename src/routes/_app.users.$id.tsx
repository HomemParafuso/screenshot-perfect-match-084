import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, KeyRound, ShieldCheck, Smartphone, UserCheck, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, Loading, PageHeader } from "@/components/admin/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, post, put } from "@/lib/api";
import {
  SUBSCRIPTION_STATUSES,
  formatDate,
  formatMoney,
  toDateInput,
  toIsoDate,
} from "@/lib/format";

export const Route = createFileRoute("/_app/users/$id")({
  component: UserDetailPage,
});

type Detail = {
  user: {
    id: string;
    email: string;
    status: string;
    created_at: string;
    updated_at: string;
    display_name: string | null;
    locale: string | null;
    preferences: Record<string, unknown>;
    roles: string[];
  };
  subscription: {
    id: string;
    status: string;
    current_period_start: string;
    current_period_end: string;
    plan_id: string;
    plan_code: string;
    plan_name: string;
    monthly_price_cents: number;
  } | null;
  devices: {
    id: string;
    name: string;
    platform: string;
    app_version: string | null;
    last_seen_at: string | null;
    revoked_at: string | null;
    created_at: string;
  }[];
  providerKeys: {
    id: string;
    provider: string;
    label: string | null;
    last4: string;
    key_version: number;
    created_at: string;
  }[];
  skills: {
    id: string;
    name: string;
    description: string | null;
    enabled: boolean;
    created_at: string;
  }[];
  agents: {
    id: string;
    name: string;
    description: string | null;
    enabled: boolean;
    created_at: string;
  }[];
  usage: { event_type: string; count: number; last_at: string }[];
  remoteSessions: {
    id: string;
    provider: string;
    status: string;
    started_at: string | null;
    ended_at: string | null;
    created_at: string;
  }[];
  auditLogs: {
    id: number;
    action: string;
    details: unknown;
    ip: string | null;
    created_at: string;
  }[];
};

type Plan = {
  id: string;
  code: string;
  name: string;
  monthly_price_cents: number;
  is_active: boolean;
};

function UserDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-user", id],
    queryFn: () => api<Detail>(`/admin/users/${id}`),
  });
  const { data: plansData } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: () => api<{ plans: Plan[] }>("/admin/plans"),
  });

  const [sub, setSub] = useState({ planId: "", status: "active", end: "", note: "" });
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!data) return;
    setIsAdmin(data.user.roles.includes("admin"));
    setSub({
      planId: data.subscription?.plan_id ?? "",
      status: data.subscription?.status ?? "active",
      end: toDateInput(data.subscription?.current_period_end),
      note: "",
    });
  }, [data]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-user", id] });
    void qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const statusMutation = useMutation({
    mutationFn: (action: "suspend" | "reactivate") => post(`/admin/users/${id}/${action}`),
    onSuccess: () => {
      toast.success("Status atualizado");
      refresh();
    },
    onError: () => toast.error("Falha ao atualizar status"),
  });

  const adminMutation = useMutation({
    mutationFn: (value: boolean) => put(`/admin/users/${id}/admin`, { isAdmin: value }),
    onSuccess: () => {
      toast.success("Papel atualizado");
      refresh();
    },
    onError: () => toast.error("Falha ao atualizar papel"),
  });

  const subMutation = useMutation({
    mutationFn: () =>
      put(`/admin/users/${id}/subscription`, {
        planId: sub.planId,
        status: sub.status,
        currentPeriodEnd: toIsoDate(sub.end),
        note: sub.note || undefined,
      }),
    onSuccess: () => {
      toast.success("Assinatura atualizada");
      refresh();
    },
    onError: () => toast.error("Falha ao atualizar assinatura"),
  });

  const revokeMutation = useMutation({
    mutationFn: (deviceId: string) => post(`/admin/users/${id}/devices/${deviceId}/revoke`),
    onSuccess: () => {
      toast.success("Dispositivo revogado");
      refresh();
    },
    onError: () => toast.error("Falha ao revogar dispositivo"),
  });

  if (isLoading) return <Loading />;
  if (!data) return <p className="text-sm text-destructive">Usuário não encontrado.</p>;

  const u = data.user;

  return (
    <div>
      <Link
        to="/users"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Usuários
      </Link>

      <PageHeader
        title={u.display_name || u.email}
        description={u.email}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={u.status === "active" ? "default" : "destructive"}>{u.status}</Badge>
            {u.roles.map((r) => (
              <Badge key={r} variant="outline">
                {r}
              </Badge>
            ))}
            {u.status === "active" ? (
              <Button size="sm" variant="outline" onClick={() => statusMutation.mutate("suspend")}>
                <UserX className="size-4" /> Suspender
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => statusMutation.mutate("reactivate")}
              >
                <UserCheck className="size-4" /> Reativar
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conta</CardTitle>
            <CardDescription>Criada em {formatDate(u.created_at)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">ID</span>
              <span className="truncate font-mono text-xs">{u.id}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Locale</span>
              <span>{u.locale ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div>
                <p className="font-medium">Administrador</p>
                <p className="text-xs text-muted-foreground">Acesso ao painel global</p>
              </div>
              <Switch
                checked={isAdmin}
                onCheckedChange={(v) => {
                  setIsAdmin(v);
                  adminMutation.mutate(v);
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Assinatura</CardTitle>
            <CardDescription>
              {data.subscription
                ? `${data.subscription.plan_name} · ${formatMoney(data.subscription.monthly_price_cents)} · ${data.subscription.status}`
                : "Nenhuma assinatura ativa"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!sub.planId) {
                  toast.error("Selecione um plano");
                  return;
                }
                subMutation.mutate();
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="plan">Plano</Label>
                <select
                  id="plan"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={sub.planId}
                  onChange={(e) => setSub({ ...sub, planId: e.target.value })}
                >
                  <option value="">Selecione…</option>
                  {(plansData?.plans ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatMoney(p.monthly_price_cents)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="status">Estado</Label>
                <select
                  id="status"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={sub.status}
                  onChange={(e) => setSub({ ...sub, status: e.target.value })}
                >
                  {SUBSCRIPTION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="end">Fim do período</Label>
                <input
                  id="end"
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={sub.end}
                  onChange={(e) => setSub({ ...sub, end: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="note">Observação</Label>
                <input
                  id="note"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={sub.note}
                  onChange={(e) => setSub({ ...sub, note: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={subMutation.isPending}>
                  {subMutation.isPending ? "Salvando…" : "Aplicar assinatura"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="size-4" /> Dispositivos
            </CardTitle>
            <CardDescription>Dispositivos conectados ao aplicativo</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.devices.length === 0 ? (
              <EmptyState>Nenhum dispositivo.</EmptyState>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Plataforma</TableHead>
                    <TableHead>Último acesso</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.devices.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <p className="font-medium">{d.name}</p>
                        <p className="text-xs text-muted-foreground">v{d.app_version ?? "—"}</p>
                      </TableCell>
                      <TableCell>{d.platform}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(d.last_seen_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        {d.revoked_at ? (
                          <Badge variant="outline">revogado</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => revokeMutation.mutate(d.id)}
                          >
                            Revogar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4" /> Chaves BYOK
            </CardTitle>
            <CardDescription>Apenas os últimos 4 caracteres são exibidos</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.providerKeys.length === 0 ? (
              <EmptyState>Nenhuma chave cadastrada.</EmptyState>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provedor</TableHead>
                    <TableHead>Rótulo</TableHead>
                    <TableHead>Final</TableHead>
                    <TableHead>Criada em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.providerKeys.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.provider}</TableCell>
                      <TableCell>{k.label ?? "—"}</TableCell>
                      <TableCell className="font-mono">••••{k.last4}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(k.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Skills</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.skills.length === 0 ? (
              <EmptyState>Nenhuma skill.</EmptyState>
            ) : (
              <ul className="divide-y">
                {data.skills.map((s) => (
                  <li key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span>{s.name}</span>
                    <Badge variant={s.enabled ? "default" : "outline"}>
                      {s.enabled ? "ativa" : "inativa"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.agents.length === 0 ? (
              <EmptyState>Nenhum agente.</EmptyState>
            ) : (
              <ul className="divide-y">
                {data.agents.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span>{a.name}</span>
                    <Badge variant={a.enabled ? "default" : "outline"}>
                      {a.enabled ? "ativo" : "inativo"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Uso</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.usage.length === 0 ? (
              <EmptyState>Sem eventos de uso.</EmptyState>
            ) : (
              <ul className="divide-y">
                {data.usage.map((e) => (
                  <li
                    key={e.event_type}
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <span>{e.event_type}</span>
                    <span className="text-muted-foreground">{e.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sessões remotas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.remoteSessions.length === 0 ? (
              <EmptyState>Nenhuma sessão remota.</EmptyState>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provedor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criada em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.remoteSessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.provider}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(s.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4" /> Auditoria do usuário
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.auditLogs.length === 0 ? (
              <EmptyState>Sem registros.</EmptyState>
            ) : (
              <ul className="divide-y">
                {data.auditLogs.map((l) => (
                  <li key={l.id} className="px-4 py-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-mono text-xs">{l.action}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(l.created_at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

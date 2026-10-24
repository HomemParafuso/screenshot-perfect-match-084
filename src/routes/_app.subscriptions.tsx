import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loading, PageHeader } from "@/components/admin/shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { SUBSCRIPTION_STATUSES, formatDate, formatMoney, statusVariant } from "@/lib/format";

export const Route = createFileRoute("/_app/subscriptions")({
  component: SubscriptionsPage,
});

type Subscription = {
  id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  user_id: string;
  email: string;
  plan_id: string;
  plan_code: string;
  plan_name: string;
  monthly_price_cents: number;
};

type Event = {
  id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: string;
  user_email: string;
  actor_email: string | null;
};

function SubscriptionsPage() {
  const [status, setStatus] = useState("");

  const subs = useQuery({
    queryKey: ["admin-subscriptions", status],
    queryFn: () =>
      api<{ subscriptions: Subscription[] }>(
        `/admin/subscriptions?limit=200${status ? `&status=${status}` : ""}`,
      ),
  });
  const events = useQuery({
    queryKey: ["admin-subscription-events"],
    queryFn: () => api<{ events: Event[] }>("/admin/subscription-events?limit=100"),
  });

  return (
    <div>
      <PageHeader
        title="Assinaturas"
        description="Mensalidades, estados e histórico de alterações"
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1">
            <Label htmlFor="sub-status">Estado</Label>
            <select
              id="sub-status"
              className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todos</option>
              {SUBSCRIPTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <span className="text-sm text-muted-foreground">
            {subs.data ? `${subs.data.subscriptions.length} assinatura(s)` : ""}
          </span>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="p-0">
          {subs.isLoading ? (
            <Loading />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.data?.subscriptions.length ? (
                  subs.data.subscriptions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link
                          to="/users/$id"
                          params={{ id: s.user_id }}
                          className="font-medium hover:underline"
                        >
                          {s.email}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {s.plan_name}{" "}
                        <span className="text-xs text-muted-foreground">({s.plan_code})</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(s.current_period_start)} → {formatDate(s.current_period_end)}
                      </TableCell>
                      <TableCell>{formatMoney(s.monthly_price_cents)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Nenhuma assinatura encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de eventos</CardTitle>
          <CardDescription>Alterações de estado feitas pelo painel</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {events.isLoading ? (
            <Loading />
          ) : events.data?.events.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Transição</TableHead>
                  <TableHead>Ator</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.data.events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.user_email}</TableCell>
                    <TableCell className="text-sm">
                      {e.from_status ?? "—"} → <strong>{e.to_status}</strong>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {e.actor_email ?? "sistema"}
                    </TableCell>
                    <TableCell className="text-sm">{e.note ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(e.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum evento registrado.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

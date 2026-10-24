import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState, Loading, PageHeader } from "@/components/admin/shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_app/audit")({
  component: AuditPage,
});

type LogRow = {
  id: number;
  action: string;
  details: Record<string, unknown>;
  ip: string | null;
  created_at: string;
  actor_email: string | null;
  target_email: string | null;
  actor_user_id: string | null;
  target_user_id: string | null;
};

function AuditPage() {
  const [action, setAction] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit", action],
    queryFn: () =>
      api<{ logs: LogRow[] }>(
        `/admin/audit-logs?limit=200${action ? `&action=${encodeURIComponent(action)}` : ""}`,
      ),
  });

  return (
    <div>
      <PageHeader title="Auditoria" description="Registro de ações sensíveis no painel e na API" />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1">
            <Label htmlFor="action">Filtrar por ação</Label>
            <Input
              id="action"
              placeholder="ex.: admin.subscription.set"
              className="w-72"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {data ? `${data.logs.length} registro(s)` : ""}
          </span>
        </CardContent>
      </Card>

      <Card>
        {isLoading ? (
          <Loading />
        ) : !data?.logs.length ? (
          <EmptyState>Nenhum registro de auditoria.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ação</TableHead>
                <TableHead>Ator</TableHead>
                <TableHead>Alvo</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Quando</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <span className="font-mono text-xs">{l.action}</span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.actor_user_id ? (
                      <Link
                        to="/users/$id"
                        params={{ id: l.actor_user_id }}
                        className="hover:underline"
                      >
                        {l.actor_email ?? l.actor_user_id}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">sistema</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.target_user_id ? (
                      <Link
                        to="/users/$id"
                        params={{ id: l.target_user_id }}
                        className="hover:underline"
                      >
                        {l.target_email ?? l.target_user_id}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {l.ip ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(l.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

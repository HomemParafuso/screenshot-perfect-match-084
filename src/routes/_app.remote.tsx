import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, Loading, PageHeader } from "@/components/admin/shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_app/remote")({
  component: RemoteUsagePage,
});

type SessionRow = {
  id: string;
  provider: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  user_id: string;
  email: string;
  device_name: string | null;
  calls: number;
};

type TokenRow = {
  user_id: string;
  email: string;
  input_tokens: string;
  output_tokens: string;
  records: number;
};

type RemoteData = {
  sessions: SessionRow[];
  tokens: TokenRow[];
  calls: { total: number; avg_latency_ms: number };
};

function RemoteUsagePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-remote-usage"],
    queryFn: () => api<RemoteData>("/admin/remote-usage?limit=100"),
  });

  if (isLoading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Uso remoto"
        description="Sessões, chamadas e tokens registrados (sem cobrança nesta versão)"
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Chamadas remotas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatNumber(data?.calls.total)}</p>
            <p className="text-xs text-muted-foreground">
              Latência média: {formatNumber(data?.calls.avg_latency_ms)} ms
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sessões registradas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatNumber(data?.sessions.length)}</p>
            <p className="text-xs text-muted-foreground">Últimas 100 listadas abaixo</p>
          </CardContent>
        </Card>
      </div>

      {!data || (data.sessions.length === 0 && data.tokens.length === 0) ? (
        <Card>
          <EmptyState>Nenhum uso remoto registrado até o momento.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sessões remotas</CardTitle>
              <CardDescription>
                Registros criados pelo contrato RemoteExecutionProvider
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {data.sessions.length === 0 ? (
                <EmptyState>Nenhuma sessão.</EmptyState>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Provedor</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Chamadas</TableHead>
                      <TableHead>Início</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.sessions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Link
                            to="/users/$id"
                            params={{ id: s.user_id }}
                            className="hover:underline"
                          >
                            {s.email}
                          </Link>
                        </TableCell>
                        <TableCell>{s.provider}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{s.status}</Badge>
                        </TableCell>
                        <TableCell>{s.calls}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDate(s.started_at ?? s.created_at)}
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
              <CardTitle className="text-base">Tokens por usuário</CardTitle>
              <CardDescription>Registrados em token_usage com billed=false</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {data.tokens.length === 0 ? (
                <EmptyState>Nenhum token registrado.</EmptyState>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Saída</TableHead>
                      <TableHead>Registros</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.tokens.map((t) => (
                      <TableRow key={t.user_id}>
                        <TableCell>
                          <Link
                            to="/users/$id"
                            params={{ id: t.user_id }}
                            className="hover:underline"
                          >
                            {t.email}
                          </Link>
                        </TableCell>
                        <TableCell>{formatNumber(t.input_tokens)}</TableCell>
                        <TableCell>{formatNumber(t.output_tokens)}</TableCell>
                        <TableCell>{formatNumber(t.records)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

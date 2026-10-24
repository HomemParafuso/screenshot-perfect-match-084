import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, Loading, PageHeader } from "@/components/admin/shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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

export const Route = createFileRoute("/_app/agents")({
  component: AgentsPage,
});

type AgentRow = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  created_at: string;
  user_id: string;
  email: string;
};

function AgentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-agents"],
    queryFn: () => api<{ agents: AgentRow[] }>("/admin/agents?limit=200"),
  });

  return (
    <div>
      <PageHeader title="Agentes" description="Agentes cadastrados pelos usuários no aplicativo" />
      <Card>
        {isLoading ? (
          <Loading />
        ) : !data?.agents.length ? (
          <EmptyState>Nenhum agente cadastrado.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Agente</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.agents.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link to="/users/$id" params={{ id: a.user_id }} className="hover:underline">
                      {a.email}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="max-w-72 truncate text-sm text-muted-foreground">
                    {a.description ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.enabled ? "default" : "outline"}>
                      {a.enabled ? "ativo" : "inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(a.created_at)}
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

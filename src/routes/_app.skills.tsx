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

export const Route = createFileRoute("/_app/skills")({
  component: SkillsPage,
});

type SkillRow = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  created_at: string;
  user_id: string;
  email: string;
};

function SkillsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-skills"],
    queryFn: () => api<{ skills: SkillRow[] }>("/admin/skills?limit=200"),
  });

  return (
    <div>
      <PageHeader title="Skills" description="Skills cadastradas pelos usuários no aplicativo" />
      <Card>
        {isLoading ? (
          <Loading />
        ) : !data?.skills.length ? (
          <EmptyState>Nenhuma skill cadastrada.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Skill</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Criada em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.skills.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link to="/users/$id" params={{ id: s.user_id }} className="hover:underline">
                      {s.email}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="max-w-72 truncate text-sm text-muted-foreground">
                    {s.description ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.enabled ? "default" : "outline"}>
                      {s.enabled ? "ativa" : "inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(s.created_at)}
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

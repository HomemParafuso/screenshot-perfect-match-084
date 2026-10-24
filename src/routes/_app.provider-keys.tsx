import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { EmptyState, Loading, PageHeader } from "@/components/admin/shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export const Route = createFileRoute("/_app/provider-keys")({
  component: ProviderKeysPage,
});

type KeyRow = {
  id: string;
  provider: string;
  label: string | null;
  last4: string;
  key_version: number;
  created_at: string;
  user_id: string;
  email: string;
};

function ProviderKeysPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-provider-keys"],
    queryFn: () => api<{ keys: KeyRow[] }>("/admin/provider-keys?limit=200"),
  });

  return (
    <div>
      <PageHeader
        title="Provedores e chaves BYOK"
        description="Chaves criptografadas — o valor completo nunca sai do servidor"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4" /> Chaves cadastradas
          </CardTitle>
          <CardDescription>
            Somente provedor, rótulo e os 4 últimos caracteres são armazenados de forma legível.
          </CardDescription>
        </CardHeader>
        <div>
          {isLoading ? (
            <Loading />
          ) : !data?.keys.length ? (
            <EmptyState>Nenhuma chave cadastrada.</EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Provedor</TableHead>
                  <TableHead>Rótulo</TableHead>
                  <TableHead>Final</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Criada em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell>
                      <Link to="/users/$id" params={{ id: k.user_id }} className="hover:underline">
                        {k.email}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{k.provider}</TableCell>
                    <TableCell>{k.label ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        ••••{k.last4}
                      </Badge>
                    </TableCell>
                    <TableCell>v{k.key_version}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(k.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}

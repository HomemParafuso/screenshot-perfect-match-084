import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState, Loading, PageHeader } from "@/components/admin/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, post } from "@/lib/api";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_app/devices")({
  component: DevicesPage,
});

type DeviceRow = {
  id: string;
  name: string;
  platform: string;
  app_version: string | null;
  last_seen_at: string | null;
  revoked_at: string | null;
  created_at: string;
  user_id: string;
  email: string;
};

function DevicesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-devices"],
    queryFn: () => api<{ devices: DeviceRow[] }>("/admin/devices?limit=200"),
  });

  const revoke = useMutation({
    mutationFn: (device: DeviceRow) =>
      post(`/admin/users/${device.user_id}/devices/${device.id}/revoke`),
    onSuccess: () => {
      toast.success("Dispositivo revogado");
      void qc.invalidateQueries({ queryKey: ["admin-devices"] });
    },
    onError: () => toast.error("Falha ao revogar dispositivo"),
  });

  return (
    <div>
      <PageHeader title="Dispositivos" description="Aparelhos conectados ao aplicativo HASi" />
      <Card>
        {isLoading ? (
          <Loading />
        ) : !data?.devices.length ? (
          <EmptyState>Nenhum dispositivo registrado.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Dispositivo</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Último acesso</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.devices.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <Link to="/users/$id" params={{ id: d.user_id }} className="hover:underline">
                      {d.email}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">v{d.app_version ?? "—"}</p>
                  </TableCell>
                  <TableCell>{d.platform}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(d.last_seen_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={d.revoked_at ? "outline" : "default"}>
                      {d.revoked_at ? "revogado" : "ativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {!d.revoked_at ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(d)}
                      >
                        Revogar
                      </Button>
                    ) : null}
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

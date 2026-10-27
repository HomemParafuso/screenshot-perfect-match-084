import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DataState, Mono, PageHeader, Pill, useApi } from "@/components/hasi/ui";
import { DataTable } from "@/components/hasi/DataTable";
import { UserLink } from "@/components/hasi/UserLink";
import { Button } from "@/components/ui/button";
import { errorMessage, post } from "@/lib/api";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_admin/devices")({
  head: () => ({ meta: [{ title: "Dispositivos — HASi Control Plane" }] }),
  component: DevicesPage,
});

type D = { id: string; name: string; platform: string; app_version: string | null; last_seen_at: string | null; revoked_at: string | null; user_id: string; email: string };

function DevicesPage() {
  const q = useApi<D[]>("/admin/devices?limit=200");
  const qc = useQueryClient();
  const revoke = useMutation({
    mutationFn: (d: D) => post(`/admin/users/${d.user_id}/devices/${d.id}/revoke`),
    onSuccess: () => { toast.success("Dispositivo revogado"); qc.invalidateQueries(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <>
      <PageHeader kicker="Sessões de app" title="Dispositivos conectados" />
      <DataState q={q} empty="Nenhum dispositivo registrado.">
        {(rows) => (
          <DataTable rows={rows} cols={[
            { header: "Dispositivo", cell: (d) => <span className="font-medium">{d.name}</span> },
            { header: "Plataforma", cell: (d) => <Mono>{d.platform} {d.app_version}</Mono> },
            { header: "Usuário", cell: (d) => <UserLink id={d.user_id} email={d.email} /> },
            { header: "Último acesso", cell: (d) => <Mono>{fmtDate(d.last_seen_at)}</Mono> },
            { header: "", cell: (d) => d.revoked_at ? <Pill tone="revoked">Revogado</Pill> : (
              <Button size="sm" variant="outline" onClick={() => revoke.mutate(d)}>Revogar</Button>
            ) },
          ]} />
        )}
      </DataState>
    </>
  );
}

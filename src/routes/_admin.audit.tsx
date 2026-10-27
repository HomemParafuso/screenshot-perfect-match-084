import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DataState, Mono, PageHeader, useApi } from "@/components/hasi/ui";
import { DataTable } from "@/components/hasi/DataTable";
import { UserLink } from "@/components/hasi/UserLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_admin/audit")({
  head: () => ({ meta: [{ title: "Auditoria — HASi Control Plane" }] }),
  component: AuditPage,
});

type L = { id: number; action: string; details: Record<string, unknown>; ip: string | null; created_at: string; actor_email: string | null; target_email: string | null; target_user_id: string | null };

function AuditPage() {
  const [q, setQ] = useState("");
  const [s, setS] = useState("");
  const data = useApi<L[]>(`/admin/audit-logs?limit=200${s ? `&q=${encodeURIComponent(s)}` : ""}`);
  return (
    <>
      <PageHeader kicker="Registro imutável" title="Auditoria" />
      <form className="mb-4 flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); setS(q); }}>
        <Input placeholder="Filtrar ação (ex.: admin.user)" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="outline">Filtrar</Button>
      </form>
      <DataState q={data} empty="Nenhum evento.">
        {(rows) => (
          <DataTable rows={rows} cols={[
            { header: "Quando", cell: (l) => <Mono>{fmtDate(l.created_at)}</Mono> },
            { header: "Ação", cell: (l) => <Mono>{l.action}</Mono> },
            { header: "Autor", cell: (l) => l.actor_email ?? <span className="text-muted-foreground">—</span> },
            { header: "Alvo", cell: (l) => <UserLink id={l.target_user_id} email={l.target_email} /> },
            { header: "IP", cell: (l) => <Mono>{l.ip ?? "—"}</Mono> },
            { header: "Detalhes", cell: (l) => <Mono>{Object.keys(l.details).length ? JSON.stringify(l.details).slice(0, 120) : ""}</Mono>, className: "max-w-xs truncate" },
          ]} />
        )}
      </DataState>
    </>
  );
}

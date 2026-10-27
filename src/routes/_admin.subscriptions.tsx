import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DataState, Mono, PageHeader, Panel, StatusPill, useApi } from "@/components/hasi/ui";
import { DataTable } from "@/components/hasi/DataTable";
import { UserLink } from "@/components/hasi/UserLink";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDate, SUB_STATUS } from "@/lib/format";

export const Route = createFileRoute("/_admin/subscriptions")({
  head: () => ({ meta: [{ title: "Assinaturas — HASi Control Plane" }] }),
  component: SubsPage,
});

type S = { id: string; status: string; plan_name: string; user_id: string; email: string; current_period_end: string; updated_at: string };
type E = { id: string; from_status: string | null; to_status: string; note: string | null; email: string; actor_email: string | null; created_at: string };

function SubsPage() {
  const [status, setStatus] = useState("all");
  const q = useApi<S[]>(`/admin/subscriptions?limit=200${status !== "all" ? `&status=${status}` : ""}`);
  const ev = useApi<E[]>("/admin/subscription-events?limit=50");
  return (
    <>
      <PageHeader
        kicker="Mensalidades"
        title="Assinaturas"
        actions={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estados</SelectItem>
              {Object.entries(SUB_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
      <DataState q={q} empty="Nenhuma assinatura.">
        {(rows) => (
          <DataTable rows={rows} cols={[
            { header: "Usuário", cell: (s) => <UserLink id={s.user_id} email={s.email} /> },
            { header: "Plano", cell: (s) => s.plan_name },
            { header: "Estado", cell: (s) => <StatusPill status={s.status} /> },
            { header: "Fim do período", cell: (s) => <Mono>{fmtDate(s.current_period_end)}</Mono> },
            { header: "Atualizada", cell: (s) => <Mono>{fmtDate(s.updated_at)}</Mono> },
          ]} />
        )}
      </DataState>
      <div className="mt-6">
        <Panel title="Histórico de mudanças">
          <DataState q={ev} empty="Sem eventos.">
            {(rows) => (
              <ul className="space-y-1.5 text-sm">
                {rows.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-2">
                    <Mono>{fmtDate(e.created_at)}</Mono> {e.email}
                    <StatusPill status={e.from_status} /> → <StatusPill status={e.to_status} />
                    <span className="text-xs text-muted-foreground">por {e.actor_email ?? "sistema"}{e.note ? ` — ${e.note}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </DataState>
        </Panel>
      </div>
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { DataState, Mono, PageHeader, Panel, useApi } from "@/components/hasi/ui";
import { DataTable } from "@/components/hasi/DataTable";
import { UserLink } from "@/components/hasi/UserLink";
import { fmtDate, fmtNum } from "@/lib/format";

export const Route = createFileRoute("/_admin/remote-usage")({
  head: () => ({ meta: [{ title: "Uso remoto — HASi Control Plane" }] }),
  component: RemotePage,
});

type R = {
  sessions: { id: string; provider: string; status: string; created_at: string; ended_at: string | null; user_id: string; email: string }[];
  top_users: { user_id: string; email: string; calls_month: number; tokens_month: number }[];
};

function RemotePage() {
  const q = useApi<R>("/admin/remote-usage?limit=100");
  return (
    <>
      <PageHeader kicker="OpenCode remoto" title="Uso remoto" />
      <div className="mb-4 rounded-md border border-primary/30 bg-accent p-3 text-sm text-accent-foreground">
        A execução remota ainda não está ativa. Sessões, chamadas e tokens serão registrados aqui quando um provedor remoto for conectado — sem cobrança nesta versão.
      </div>
      <DataState q={q} isEmpty={() => false}>
        {(d) => (
          <div className="grid gap-4">
            <Panel title="Consumo no mês por usuário">
              {d.top_users.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum consumo registrado.</p> : (
                <DataTable rows={d.top_users.map((u) => ({ ...u, id: u.user_id }))} cols={[
                  { header: "Usuário", cell: (u) => <UserLink id={u.user_id} email={u.email} /> },
                  { header: "Chamadas", cell: (u) => <Mono>{fmtNum(u.calls_month)}</Mono> },
                  { header: "Tokens", cell: (u) => <Mono>{fmtNum(u.tokens_month)}</Mono> },
                ]} />
              )}
            </Panel>
            <Panel title="Sessões remotas">
              {d.sessions.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma sessão remota registrada.</p> : (
                <DataTable rows={d.sessions} cols={[
                  { header: "Usuário", cell: (s) => <UserLink id={s.user_id} email={s.email} /> },
                  { header: "Provedor", cell: (s) => s.provider },
                  { header: "Status", cell: (s) => <Mono>{s.status}</Mono> },
                  { header: "Início", cell: (s) => <Mono>{fmtDate(s.created_at)}</Mono> },
                  { header: "Fim", cell: (s) => <Mono>{fmtDate(s.ended_at)}</Mono> },
                ]} />
              )}
            </Panel>
          </div>
        )}
      </DataState>
    </>
  );
}

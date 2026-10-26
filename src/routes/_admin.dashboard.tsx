import { createFileRoute } from "@tanstack/react-router";
import { DataState, PageHeader, Stat, useApi } from "@/components/hasi/ui";
import { fmtNum } from "@/lib/format";

export const Route = createFileRoute("/_admin/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — HASi Control Plane" }] }),
  component: Dashboard,
});

type Stats = Record<"users" | "suspended_users" | "active_subs" | "trial_subs" | "past_due_subs" | "active_devices" | "remote_sessions_month" | "tokens_month", number>;

function Dashboard() {
  const q = useApi<Stats>("/admin/stats");
  return (
    <>
      <PageHeader kicker="Visão geral" title="Dashboard" />
      <DataState q={q} isEmpty={() => false}>
        {(s) => (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Usuários" value={fmtNum(s.users)} hint={`${s.suspended_users} suspensos`} />
            <Stat label="Assinaturas ativas" value={fmtNum(s.active_subs)} hint={`${s.trial_subs} em teste`} />
            <Stat label="Em atraso" value={fmtNum(s.past_due_subs)} />
            <Stat label="Dispositivos ativos" value={fmtNum(s.active_devices)} />
            <Stat label="Sessões remotas (mês)" value={fmtNum(s.remote_sessions_month)} hint="Execução remota ainda não habilitada" />
            <Stat label="Tokens remotos (mês)" value={fmtNum(s.tokens_month)} hint="Registrados, não cobrados" />
          </div>
        )}
      </DataState>
    </>
  );
}

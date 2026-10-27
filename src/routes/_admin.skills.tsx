import { createFileRoute } from "@tanstack/react-router";
import { DataState, Mono, PageHeader, Pill, useApi } from "@/components/hasi/ui";
import { DataTable } from "@/components/hasi/DataTable";
import { UserLink } from "@/components/hasi/UserLink";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_admin/skills")({
  head: () => ({ meta: [{ title: "Skills — HASi Control Plane" }] }),
  component: () => <ItemsPage path="/admin/skills" kicker="Usuários" title="Skills dos usuários" empty="Nenhuma skill cadastrada." />,
});

type I = { id: string; name: string; description: string | null; enabled: boolean; user_id: string; email: string; updated_at: string };

export function ItemsPage({ path, kicker, title, empty }: { path: string; kicker: string; title: string; empty: string }) {
  const q = useApi<I[]>(`${path}?limit=200`);
  return (
    <>
      <PageHeader kicker={kicker} title={title} />
      <DataState q={q} empty={empty}>
        {(rows) => (
          <DataTable rows={rows} cols={[
            { header: "Nome", cell: (x) => <span className="font-medium">{x.name}</span> },
            { header: "Descrição", cell: (x) => x.description ?? "—" },
            { header: "Usuário", cell: (x) => <UserLink id={x.user_id} email={x.email} /> },
            { header: "Estado", cell: (x) => <Pill tone={x.enabled ? "active" : "canceled"}>{x.enabled ? "Ativo" : "Inativo"}</Pill> },
            { header: "Atualizado", cell: (x) => <Mono>{fmtDate(x.updated_at)}</Mono> },
          ]} />
        )}
      </DataState>
    </>
  );
}

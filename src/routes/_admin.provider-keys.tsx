import { createFileRoute } from "@tanstack/react-router";
import { DataState, Mono, PageHeader, useApi } from "@/components/hasi/ui";
import { DataTable } from "@/components/hasi/DataTable";
import { UserLink } from "@/components/hasi/UserLink";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_admin/provider-keys")({
  head: () => ({ meta: [{ title: "Provedores e chaves BYOK — HASi Control Plane" }] }),
  component: KeysPage,
});

type K = { id: string; provider: string; label: string | null; last4: string; user_id: string; email: string; created_at: string };

function KeysPage() {
  const q = useApi<K[]>("/admin/provider-keys?limit=200");
  return (
    <>
      <PageHeader kicker="BYOK" title="Provedores e chaves" />
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Chaves cadastradas pelos usuários para modelos premium. São criptografadas no servidor; apenas os 4 últimos caracteres são exibidos, inclusive para administradores.
      </p>
      <DataState q={q} empty="Nenhuma chave cadastrada.">
        {(rows) => (
          <DataTable rows={rows} cols={[
            { header: "Usuário", cell: (k) => <UserLink id={k.user_id} email={k.email} /> },
            { header: "Provedor", cell: (k) => k.provider },
            { header: "Rótulo", cell: (k) => k.label ?? "—" },
            { header: "Chave", cell: (k) => <Mono>••••••••{k.last4}</Mono> },
            { header: "Criada", cell: (k) => <Mono>{fmtDate(k.created_at)}</Mono> },
          ]} />
        )}
      </DataState>
    </>
  );
}

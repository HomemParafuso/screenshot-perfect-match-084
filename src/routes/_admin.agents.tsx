import { createFileRoute } from "@tanstack/react-router";
import { ItemsPage } from "./_admin.skills";

export const Route = createFileRoute("/_admin/agents")({
  head: () => ({ meta: [{ title: "Agentes — HASi Control Plane" }] }),
  component: () => <ItemsPage path="/admin/agents" kicker="Usuários" title="Agentes dos usuários" empty="Nenhum agente cadastrado." />,
});

import { createFileRoute } from "@tanstack/react-router";
import { ItemsPage } from "./_admin.skills";

export const Route = createFileRoute("/_admin/agents")({
  head: () => ({ meta: [{ title: "Agentes — HASi Control Plane" }, { name: "description", content: "Agentes no painel administrativo HASi." }, { property: "og:title", content: "Agentes — HASi Control Plane" }, { property: "og:description", content: "Agentes no painel administrativo HASi." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <ItemsPage path="/admin/agents" kicker="Usuários" title="Agentes dos usuários" empty="Nenhum agente cadastrado." />,
});

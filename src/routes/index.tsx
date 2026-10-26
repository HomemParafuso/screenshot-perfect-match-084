import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { hasSession } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HASi Control Plane" },
      { name: "description", content: "Painel administrativo do HASi." },
      { property: "og:title", content: "HASi Control Plane" },
      { property: "og:description", content: "Painel administrativo do HASi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: hasSession() ? "/dashboard" : "/login", replace: true });
  }, [navigate]);
  return <div className="bg-grid min-h-screen" />;
}

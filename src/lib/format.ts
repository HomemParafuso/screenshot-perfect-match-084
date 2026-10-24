export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function formatDay(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}

export function formatMoney(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

export function formatNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "0";
  return new Intl.NumberFormat("pt-BR").format(Number(value));
}

export function toDateInput(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function toIsoDate(value: string) {
  if (!value) return undefined;
  return new Date(`${value}T23:59:59.000Z`).toISOString();
}

export const SUBSCRIPTION_STATUSES = [
  "trial",
  "active",
  "past_due",
  "canceled",
  "suspended",
] as const;

export const FEATURES = [
  "mobile_assistant",
  "local_opencode",
  "custom_skills",
  "custom_agents",
  "remote_coding",
  "remote_session_limit",
  "monthly_remote_calls",
  "monthly_remote_tokens",
] as const;

export type Feature = (typeof FEATURES)[number];

export const FEATURE_LABELS: Record<Feature, string> = {
  mobile_assistant: "Assistente mobile",
  local_opencode: "OpenCode local",
  custom_skills: "Skills personalizadas",
  custom_agents: "Agentes personalizados",
  remote_coding: "Programação remota",
  remote_session_limit: "Limite de sessões remotas",
  monthly_remote_calls: "Chamadas remotas / mês",
  monthly_remote_tokens: "Tokens remotos / mês",
};

export function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "trial":
      return "secondary";
    case "past_due":
      return "outline";
    case "suspended":
    case "canceled":
      return "destructive";
    default:
      return "outline";
  }
}

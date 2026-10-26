export const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

export const fmtMoney = (cents: number, currency = "BRL") =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });

export const fmtNum = (n: number) => n.toLocaleString("pt-BR");

export const FEATURE_LABELS: Record<string, { label: string; limit: boolean }> = {
  mobile_assistant: { label: "Assistente móvel", limit: false },
  local_opencode: { label: "OpenCode local", limit: false },
  custom_skills: { label: "Skills personalizadas", limit: false },
  custom_agents: { label: "Agentes personalizados", limit: false },
  remote_coding: { label: "Programação remota", limit: false },
  remote_session_limit: { label: "Sessões remotas simultâneas", limit: true },
  monthly_remote_calls: { label: "Chamadas remotas / mês", limit: true },
  monthly_remote_tokens: { label: "Tokens remotos / mês", limit: true },
};

export const SUB_STATUS: Record<string, string> = {
  trial: "Teste",
  active: "Ativa",
  past_due: "Em atraso",
  canceled: "Cancelada",
  suspended: "Suspensa",
};

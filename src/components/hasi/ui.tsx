import type { ReactNode } from "react";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { SUB_STATUS } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PageHeader({ title, kicker, actions }: { title: string; kicker?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b pb-5">
      <div>
        {kicker && <div className="label-mono mb-1">{kicker}</div>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function useApi<T = any>(path: string, opts?: Partial<UseQueryOptions<T>>) {
  return useQuery<T>({ queryKey: [path], queryFn: () => api<T>(path), ...opts });
}

/** Renders loading / error / empty states around real API data. */
export function DataState<T>({
  q,
  empty,
  isEmpty,
  children,
}: {
  q: { isLoading: boolean; error: unknown; data: T | undefined };
  empty?: string;
  isEmpty?: (d: T) => boolean;
  children: (d: T) => ReactNode;
}) {
  if (q.isLoading)
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  if (q.error)
    return <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{errorMessage(q.error)}</div>;
  if (q.data === undefined) return null;
  if (isEmpty?.(q.data) ?? (Array.isArray(q.data) && q.data.length === 0))
    return <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">{empty ?? "Nenhum registro."}</div>;
  return <>{children(q.data)}</>;
}

const tones: Record<string, string> = {
  active: "bg-success/15 text-success border-success/30",
  trial: "bg-primary/15 text-primary border-primary/30",
  past_due: "bg-warning/15 text-warning border-warning/30",
  suspended: "bg-destructive/15 text-destructive border-destructive/30",
  canceled: "bg-muted text-muted-foreground border-border",
  revoked: "bg-muted text-muted-foreground border-border",
  admin: "bg-accent text-accent-foreground border-primary/30",
};

export function Pill({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[0.68rem] uppercase tracking-wider", tones[tone] ?? tones.canceled)}>
      {children}
    </span>
  );
}

export const StatusPill = ({ status }: { status?: string | null }) =>
  status ? <Pill tone={status}>{SUB_STATUS[status] ?? status}</Pill> : <span className="text-muted-foreground">—</span>;

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="label-mono">{label}</div>
      <div className="mt-2 font-mono text-3xl font-medium tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Panel({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="label-mono text-foreground">{title}</h2>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export const Mono = ({ children }: { children: ReactNode }) => <span className="font-mono text-xs">{children}</span>;

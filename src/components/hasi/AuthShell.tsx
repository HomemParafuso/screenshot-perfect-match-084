import { useEffect, useState, type ReactNode } from "react";
import { getApiUrl, setApiUrl } from "@/lib/api";
import { Input } from "@/components/ui/input";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="bg-grid flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded bg-primary font-mono text-sm font-bold text-primary-foreground">H</div>
          <div>
            <div className="font-semibold leading-none">HASi</div>
            <div className="label-mono mt-1">Control Plane</div>
          </div>
        </div>
        <div className="rounded-md border bg-card p-6 shadow-2xl">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <ApiUrlField />
      </div>
    </div>
  );
}

function ApiUrlField() {
  const [url, setUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [initial, setInitial] = useState<string | null>(null);
  useEffect(() => {
    const u = getApiUrl();
    setUrl(u);
    setInitial(u);
  }, []);
  return (
    <details className="mt-4 text-xs text-muted-foreground" open={initial === ""}>
      <summary className="label-mono cursor-pointer">Servidor da API</summary>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setApiUrl(url);
          setSaved(true);
        }}
      >
        <Input value={url} onChange={(e) => { setUrl(e.target.value); setSaved(false); }} placeholder="https://api.seudominio.com" className="h-8 font-mono text-xs" />
        <button className="rounded border px-3 font-mono text-xs hover:bg-secondary">{saved ? "Salvo" : "Salvar"}</button>
      </form>
    </details>
  );
}

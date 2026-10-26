import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { DataState, PageHeader, Pill, StatusPill, useApi } from "@/components/hasi/ui";
import { DataTable } from "@/components/hasi/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { errorMessage, post } from "@/lib/api";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_admin/users/")({
  head: () => ({ meta: [{ title: "Usuários — HASi Control Plane" }] }),
  component: UsersPage,
});

type U = { id: string; email: string; status: string; display_name: string | null; subscription_status: string | null; plan_name: string | null; is_admin: boolean; created_at: string };

function UsersPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const data = useApi<{ total: number; items: U[] }>(`/admin/users?limit=100${search ? `&q=${encodeURIComponent(search)}` : ""}`);
  return (
    <>
      <PageHeader kicker="Contas" title="Usuários" actions={<CreateUser />} />
      <form className="mb-4 flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(q); }}>
        <Input placeholder="Buscar por e-mail ou nome" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="outline">Buscar</Button>
      </form>
      <DataState q={data} isEmpty={(d) => d.items.length === 0} empty="Nenhum usuário encontrado.">
        {(d) => (
          <>
            <div className="label-mono mb-2">{d.total} usuários</div>
            <DataTable
              rows={d.items}
              cols={[
                { header: "E-mail", cell: (u) => <Link to="/users/$id" params={{ id: u.id }} className="font-medium hover:text-primary">{u.email}</Link> },
                { header: "Nome", cell: (u) => u.display_name ?? "—" },
                { header: "Conta", cell: (u) => <div className="flex gap-1"><Pill tone={u.status}>{u.status === "active" ? "Ativa" : "Suspensa"}</Pill>{u.is_admin && <Pill tone="admin">Admin</Pill>}</div> },
                { header: "Plano", cell: (u) => u.plan_name ?? "—" },
                { header: "Assinatura", cell: (u) => <StatusPill status={u.subscription_status} /> },
                { header: "Criado", cell: (u) => fmtDate(u.created_at), className: "font-mono text-xs" },
              ]}
            />
          </>
        )}
      </DataState>
    </>
  );
}

function CreateUser() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ email: "", password: "", display_name: "" });
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => post("/admin/users", { email: f.email, password: f.password, ...(f.display_name ? { display_name: f.display_name } : {}) }),
    onSuccess: () => {
      toast.success("Usuário criado");
      setOpen(false);
      setF({ email: "", password: "", display_name: "" });
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-1 h-4 w-4" />Novo usuário</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Nome</Label><Input value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Senha inicial (mín. 10)</Label><Input type="password" required minLength={10} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
          <Button className="w-full" disabled={m.isPending}>Criar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

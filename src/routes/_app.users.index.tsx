import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, Loading, PageHeader } from "@/components/admin/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, api, post } from "@/lib/api";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_app/users/")({
  component: UsersPage,
});

type UserRow = {
  id: string;
  email: string;
  status: "active" | "suspended";
  created_at: string;
  display_name: string | null;
  subscription_status: string | null;
  plan_code: string | null;
  plan_name: string | null;
  devices: number;
  is_admin: boolean;
};

function UsersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "active" | "suspended">("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", displayName: "", isAdmin: false });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", q, status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      params.set("limit", "100");
      return api<{ users: UserRow[]; total: number }>(`/admin/users?${params.toString()}`);
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const setStatusMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "suspend" | "reactivate" }) =>
      post(`/admin/users/${id}/${action}`),
    onSuccess: () => {
      toast.success("Usuário atualizado");
      void invalidate();
    },
    onError: () => toast.error("Não foi possível atualizar o usuário"),
  });

  const createUser = useMutation({
    mutationFn: () =>
      post("/admin/users", {
        email: form.email,
        password: form.password,
        displayName: form.displayName || undefined,
        isAdmin: form.isAdmin,
      }),
    onSuccess: () => {
      toast.success("Usuário criado");
      setCreateOpen(false);
      setForm({ email: "", password: "", displayName: "", isAdmin: false });
      void invalidate();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409)
        toast.error("Este e-mail já está cadastrado.");
      else if (err instanceof ApiError && err.code === "validation_error")
        toast.error("Dados inválidos (senha mínima de 12 caracteres).");
      else toast.error("Não foi possível criar o usuário");
    },
  });

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Criar, suspender e reativar contas do HASi"
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> Novo usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo usuário</DialogTitle>
                <DialogDescription>A senha deve ter no mínimo 12 caracteres.</DialogDescription>
              </DialogHeader>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  createUser.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="new-name">Nome</Label>
                  <Input
                    id="new-name"
                    value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-email">E-mail</Label>
                  <Input
                    id="new-email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Senha</Label>
                  <Input
                    id="new-password"
                    type="password"
                    required
                    minLength={12}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Administrador</p>
                    <p className="text-xs text-muted-foreground">Acesso total ao painel</p>
                  </div>
                  <Switch
                    checked={form.isAdmin}
                    onCheckedChange={(v) => setForm({ ...form, isAdmin: v })}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createUser.isPending}>
                    {createUser.isPending ? "Criando…" : "Criar usuário"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <form
            className="flex flex-1 flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void qc.invalidateQueries({ queryKey: ["admin-users"] });
            }}
          >
            <div className="min-w-56 flex-1 space-y-1">
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                <Input
                  id="search"
                  className="pl-8"
                  placeholder="E-mail ou nome"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                <option value="">Todos</option>
                <option value="active">Ativos</option>
                <option value="suspended">Suspensos</option>
              </select>
            </div>
            <Button type="submit" variant="secondary">
              Filtrar
            </Button>
          </form>
          <span className="text-sm text-muted-foreground">
            {data ? `${data.total} usuário(s)` : ""}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <Loading />
          ) : !data || data.users.length === 0 ? (
            <EmptyState>Nenhum usuário encontrado.</EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Dispositivos</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <Link
                        to="/users/$id"
                        params={{ id: u.id }}
                        className="font-medium hover:underline"
                      >
                        {u.display_name || u.email}
                      </Link>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={u.status === "active" ? "default" : "destructive"}>
                          {u.status === "active" ? "ativo" : "suspenso"}
                        </Badge>
                        {u.is_admin ? (
                          <Badge variant="outline">
                            <ShieldCheck className="mr-1 size-3" /> admin
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.plan_name ? (
                        <div>
                          <p className="text-sm">{u.plan_name}</p>
                          <p className="text-xs text-muted-foreground">{u.subscription_status}</p>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Sem plano</span>
                      )}
                    </TableCell>
                    <TableCell>{u.devices}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(u.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {u.status === "active" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={setStatusMutation.isPending}
                          onClick={() => setStatusMutation.mutate({ id: u.id, action: "suspend" })}
                        >
                          <UserX className="size-4" /> Suspender
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={setStatusMutation.isPending}
                          onClick={() =>
                            setStatusMutation.mutate({ id: u.id, action: "reactivate" })
                          }
                        >
                          <UserCheck className="size-4" /> Reativar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

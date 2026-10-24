import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Settings2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EntitlementEditor } from "@/components/admin/entitlement-editor";
import { EmptyState, Loading, PageHeader } from "@/components/admin/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { api, patch, post } from "@/lib/api";
import { FEATURE_LABELS, formatMoney } from "@/lib/format";
import type { Plan } from "@/lib/types";

export const Route = createFileRoute("/_app/plans")({
  component: PlansPage,
});

function PlansPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: () => api<{ plans: Plan[] }>("/admin/plans"),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", price: "0", active: true });
  const [editing, setEditing] = useState<Plan | null>(null);
  const [editingEnt, setEditingEnt] = useState<Plan | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-plans"] });

  const createMutation = useMutation({
    mutationFn: () =>
      post("/admin/plans", {
        code: form.code,
        name: form.name,
        monthlyPriceCents: Math.round(Number(form.price) * 100),
        isActive: form.active,
      }),
    onSuccess: () => {
      toast.success("Plano criado");
      setCreateOpen(false);
      setForm({ code: "", name: "", price: "0", active: true });
      void invalidate();
    },
    onError: () => toast.error("Não foi possível criar o plano"),
  });

  const editMutation = useMutation({
    mutationFn: () =>
      patch(`/admin/plans/${editing!.id}`, {
        name: editing!.name,
        monthlyPriceCents: editing!.monthly_price_cents,
        isActive: editing!.is_active,
      }),
    onSuccess: () => {
      toast.success("Plano atualizado");
      setEditing(null);
      void invalidate();
    },
    onError: () => toast.error("Não foi possível atualizar o plano"),
  });

  return (
    <div>
      <PageHeader
        title="Planos"
        description="Mensalidades e recursos liberados por plano"
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> Novo plano
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo plano</DialogTitle>
                <DialogDescription>Código único em minúsculas, sem espaços.</DialogDescription>
              </DialogHeader>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  createMutation.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="code">Código</Label>
                  <Input
                    id="code"
                    required
                    pattern="[a-z0-9_-]+"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="pro"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="HASi Pro"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Preço mensal (R$)</Label>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-sm font-medium">Ativo</span>
                  <Switch
                    checked={form.active}
                    onCheckedChange={(v) => setForm({ ...form, active: v })}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    Criar plano
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <Loading />
      ) : !data || data.plans.length === 0 ? (
        <Card>
          <EmptyState>Nenhum plano cadastrado. Crie o primeiro plano.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    <CardDescription className="font-mono">{plan.code}</CardDescription>
                  </div>
                  <Badge variant={plan.is_active ? "default" : "outline"}>
                    {plan.is_active ? "ativo" : "inativo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-semibold">
                  {formatMoney(plan.monthly_price_cents, plan.currency)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </p>
                <p className="text-xs text-muted-foreground">{plan.subscribers} assinante(s)</p>
                <div className="space-y-1">
                  {plan.entitlements.filter((e) => e.enabled).length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum recurso liberado.</p>
                  ) : (
                    plan.entitlements
                      .filter((e) => e.enabled)
                      .map((e) => (
                        <div key={e.feature} className="flex justify-between text-xs">
                          <span>{FEATURE_LABELS[e.feature]}</span>
                          <span className="text-muted-foreground">
                            {e.limitValue === null ? "∞" : e.limitValue}
                          </span>
                        </div>
                      ))
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingEnt(plan)}>
                    <Settings2 className="size-4" /> Entitlements
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(plan)}>
                    Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar plano</DialogTitle>
          </DialogHeader>
          {editing ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                editMutation.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome</Label>
                <Input
                  id="edit-name"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-price">Preço mensal (R$)</Label>
                <Input
                  id="edit-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={editing.monthly_price_cents / 100}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      monthly_price_cents: Math.round(Number(e.target.value) * 100),
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm font-medium">Ativo</span>
                <Switch
                  checked={editing.is_active}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={editMutation.isPending}>
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingEnt} onOpenChange={(open) => !open && setEditingEnt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entitlements — {editingEnt?.name}</DialogTitle>
            <DialogDescription>
              Recursos liberados quando a assinatura está em trial ou ativa.
            </DialogDescription>
          </DialogHeader>
          {editingEnt ? (
            <EntitlementEditor
              planId={editingEnt.id}
              entitlements={editingEnt.entitlements}
              onSaved={() => setEditingEnt(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

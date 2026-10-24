import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { put } from "@/lib/api";
import { FEATURES, FEATURE_LABELS, type Feature } from "@/lib/format";
import type { Entitlement } from "@/lib/types";

export function EntitlementEditor({
  planId,
  entitlements,
  onSaved,
}: {
  planId: string;
  entitlements: Entitlement[];
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const [state, setState] = useState<Record<Feature, { enabled: boolean; limit: string }>>(() =>
    build(entitlements),
  );

  useEffect(() => {
    setState(build(entitlements));
  }, [entitlements]);

  const mutation = useMutation({
    mutationFn: () =>
      put(`/admin/plans/${planId}/entitlements`, {
        entitlements: FEATURES.map((f) => ({
          feature: f,
          enabled: state[f].enabled,
          limitValue: state[f].limit === "" ? null : Number(state[f].limit),
        })),
      }),
    onSuccess: () => {
      toast.success("Entitlements salvos");
      void qc.invalidateQueries({ queryKey: ["admin-plans"] });
      onSaved?.();
    },
    onError: () => toast.error("Falha ao salvar entitlements"),
  });

  const withLimit: Feature[] = [
    "remote_session_limit",
    "monthly_remote_calls",
    "monthly_remote_tokens",
  ];

  return (
    <div className="space-y-3">
      {FEATURES.map((feature) => (
        <div
          key={feature}
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
        >
          <div className="flex items-center gap-3">
            <Switch
              checked={state[feature].enabled}
              onCheckedChange={(v) =>
                setState({ ...state, [feature]: { ...state[feature], enabled: v } })
              }
            />
            <div>
              <p className="text-sm font-medium">{FEATURE_LABELS[feature]}</p>
              <p className="font-mono text-xs text-muted-foreground">{feature}</p>
            </div>
          </div>
          {withLimit.includes(feature) ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                className="w-28"
                placeholder="Sem limite"
                value={state[feature].limit}
                onChange={(e) =>
                  setState({ ...state, [feature]: { ...state[feature], limit: e.target.value } })
                }
              />
              <span className="text-xs text-muted-foreground">limite</span>
            </div>
          ) : null}
        </div>
      ))}
      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? "Salvando…" : "Salvar entitlements"}
      </Button>
    </div>
  );
}

function build(entitlements: Entitlement[]) {
  const base = Object.fromEntries(
    FEATURES.map((f) => [f, { enabled: false, limit: "" }]),
  ) as Record<Feature, { enabled: boolean; limit: string }>;
  for (const e of entitlements) {
    base[e.feature] = {
      enabled: e.enabled,
      limit: e.limitValue === null ? "" : String(e.limitValue),
    };
  }
  return base;
}

import type { Feature } from "./format";

export type Entitlement = { feature: Feature; enabled: boolean; limitValue: number | null };

export type Plan = {
  id: string;
  code: string;
  name: string;
  monthly_price_cents: number;
  currency: string;
  is_active: boolean;
  created_at: string;
  subscribers: number;
  entitlements: Entitlement[];
};

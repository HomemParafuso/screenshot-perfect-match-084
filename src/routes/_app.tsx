import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AdminShell } from "@/components/admin/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app")({
  component: GuardedLayout,
});

function GuardedLayout() {
  const { user, loading, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Verificando acesso…
      </div>
    );
  }

  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
            <CardDescription>
              A conta <strong>{user.email}</strong> não possui papel de administrador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => void logout()}>
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}

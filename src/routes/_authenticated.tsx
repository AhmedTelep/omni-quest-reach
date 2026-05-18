import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAuthSession, useUserRoles } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthGate,
});

function AuthGate() {
  const { user, loading } = useAuthSession();
  const { data: roles, isLoading: rolesLoading } = useUserRoles(user);

  if (loading || rolesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        جاري التحميل…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        غير مسجل دخول
      </div>
    );
  }

  if (!roles || roles.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-3">
          <h2 className="text-lg font-semibold">حسابك بدون صلاحيات</h2>
          <p className="text-sm text-muted-foreground">
            تواصل مع الأدمن لتفعيل حسابك وإعطاءك الدور المناسب.
          </p>
          <button
            className="text-sm text-primary underline"
            onClick={() => supabase.auth.signOut()}
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  return <AppShell />;
}
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/contexts/project-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Wrench, Receipt } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { projectId } = useProject();

  const stats = useQuery({
    queryKey: ["dashboard-stats", projectId],
    queryFn: async () => {
      const projectsQ = supabase.from("projects").select("*", { count: "exact", head: true });
      let residentsQ = supabase.from("residents").select("*", { count: "exact", head: true });
      let requestsOpen = supabase
        .from("maintenance_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "open");
      let installmentsPending = supabase
        .from("installments")
        .select("*", { count: "exact", head: true })
        .eq("payment_status", "pending_confirmation");

      if (projectId) {
        residentsQ = residentsQ.eq("project_id", projectId);
        requestsOpen = requestsOpen.eq("project_id", projectId);
        installmentsPending = installmentsPending.eq("project_id", projectId);
      }

      const [projects, residents, openReqs, pendingInst] = await Promise.all([
        projectsQ,
        residentsQ,
        requestsOpen,
        installmentsPending,
      ]);

      return {
        projects: projects.count ?? 0,
        residents: residents.count ?? 0,
        openRequests: openReqs.count ?? 0,
        pendingInstallments: pendingInst.count ?? 0,
      };
    },
  });

  const items = [
    { label: "المشاريع", value: stats.data?.projects ?? 0, icon: Building2, color: "text-blue-600" },
    { label: "السكان", value: stats.data?.residents ?? 0, icon: Users, color: "text-emerald-600" },
    { label: "طلبات صيانة مفتوحة", value: stats.data?.openRequests ?? 0, icon: Wrench, color: "text-amber-600" },
    { label: "أقساط بانتظار التأكيد", value: stats.data?.pendingInstallments ?? 0, icon: Receipt, color: "text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">لوحة التحكم</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          نظرة عامة على بيانات النظام {projectId ? "للمشروع المختار" : "لكل المشاريع"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <Card key={it.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{it.label}</CardTitle>
              <it.icon className={`h-5 w-5 ${it.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{it.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
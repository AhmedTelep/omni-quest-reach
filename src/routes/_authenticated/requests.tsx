import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/contexts/project-context";
import { useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/requests")({ component: RequestsPage });

const STATUS_LABEL: Record<string, string> = { open: "جديد", in_progress: "قيد التنفيذ", completed: "منتهي" };

function RequestsPage() {
  const qc = useQueryClient();
  const { projectId } = useProject();

  const { data } = useQuery({
    queryKey: ["requests", projectId],
    queryFn: async () => {
      let q = supabase.from("maintenance_requests").select("*, residents(unit_number, name)").order("created_at", { ascending: false });
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase.channel("requests-rt").on("postgres_changes" as any, { event: "*", schema: "public", table: "maintenance_requests" }, () => {
      qc.invalidateQueries({ queryKey: ["requests"] });
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "open" | "in_progress" | "completed" }) => {
      const { error } = await supabase.from("maintenance_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["requests"] }); toast.success("تم التحديث"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">طلبات الصيانة</h1>
        <p className="mt-1 text-sm text-muted-foreground">تحديث فوري — أي طلب جديد من الموبايل يظهر تلقائياً</p>
      </div>
      <div className="space-y-3">
        {data?.map((r: any) => (
          <Card key={r.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{r.service_type}</span>
                  <Badge variant="outline">{STATUS_LABEL[r.status] ?? r.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{r.residents?.name} — وحدة {r.residents?.unit_number}</p>
                {r.notes && <p className="mt-1 text-sm">{r.notes}</p>}
              </div>
              <Select value={r.status} onValueChange={(v) => update.mutate({ id: r.id, status: v as any })}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">جديد</SelectItem>
                  <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                  <SelectItem value="completed">منتهي</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        ))}
        {!data?.length && <p className="py-12 text-center text-muted-foreground">لا توجد طلبات</p>}
      </div>
    </div>
  );
}
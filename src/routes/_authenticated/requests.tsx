import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { updateRequestStatus, updateRequest, deleteRequest } from "@/lib/admin-users.functions";
import { useProject } from "@/contexts/project-context";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Save } from "lucide-react";
import { useScrollToHash } from "@/hooks/use-scroll-to-hash";

export const Route = createFileRoute("/_authenticated/requests")({ component: RequestsPage });

const STATUS_LABEL: Record<string, string> = { open: "جديد", in_progress: "قيد التنفيذ", completed: "منتهي" };

function RequestsPage() {
  const qc = useQueryClient();
  const { projectId } = useProject();
  const updateStatusFn = useServerFn(updateRequestStatus);
  const updateFn = useServerFn(updateRequest);
  const deleteFn = useServerFn(deleteRequest);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

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

  useScrollToHash([data?.length]);

  useEffect(() => {
    const ch = supabase.channel("requests-rt").on("postgres_changes" as any, { event: "*", schema: "public", table: "maintenance_requests" }, () => {
      qc.invalidateQueries({ queryKey: ["requests"] });
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "open" | "in_progress" | "completed" }) =>
      updateStatusFn({ data: { id, status } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["requests"] }); toast.success("تم التحديث"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveNotes = useMutation({
    mutationFn: ({ id, admin_notes }: { id: string; admin_notes: string }) =>
      updateFn({ data: { id, admin_notes } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["requests"] }); toast.success("تم حفظ الملاحظات"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["requests"] }); toast.success("تم الحذف"); },
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
          <Card key={r.id} id={`req-${r.id}`}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex gap-3">
                  {r.image_url && (
                    <img src={r.image_url} alt="" className="h-16 w-16 rounded object-cover" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{r.service_type}</span>
                      <Badge variant="outline">{STATUS_LABEL[r.status] ?? r.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{r.residents?.name} — وحدة {r.residents?.unit_number}</p>
                    {r.notes && <p className="mt-1 text-sm">{r.notes}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-EG")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={r.status} onValueChange={(v) => update.mutate({ id: r.id, status: v as any })}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">جديد</SelectItem>
                      <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                      <SelectItem value="completed">منتهي</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" onClick={() => confirm("حذف الطلب؟") && remove.mutate(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Textarea
                  placeholder="رد الإدارة على الساكن…"
                  defaultValue={r.admin_notes ?? ""}
                  onChange={(e) => setNotesDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                  className="min-h-[60px]"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => saveNotes.mutate({ id: r.id, admin_notes: notesDraft[r.id] ?? r.admin_notes ?? "" })}
                >
                  <Save className="ms-1 h-4 w-4" />حفظ
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!data?.length && <p className="py-12 text-center text-muted-foreground">لا توجد طلبات</p>}
      </div>
    </div>
  );
}
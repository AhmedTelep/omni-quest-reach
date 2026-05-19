import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile } from "@/lib/storage";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-requests")({ component: MyRequestsPage });

const STATUS_LABEL: Record<string, string> = { open: "جديد", in_progress: "قيد التنفيذ", completed: "منتهي" };

function MyRequestsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: resident } = useQuery({
    queryKey: ["my-resident"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("residents").select("*").eq("user_id", user.id).maybeSingle();
      return data;
    },
  });

  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () => (await supabase.from("services").select("*").order("name_ar")).data ?? [],
  });

  const { data: requests } = useQuery({
    queryKey: ["my-requests", resident?.id],
    enabled: !!resident?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("maintenance_requests")
        .select("*")
        .eq("resident_id", resident!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (form: { service_id: string; service_type: string; notes: string; image?: File | null }) => {
      if (!resident) throw new Error("لم يتم العثور على بياناتك");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("الجلسة منتهية");
      let image_url: string | null = null;
      if (form.image) image_url = await uploadFile("request-images", form.image, user.id);
      const { error } = await supabase.from("maintenance_requests").insert({
        resident_id: resident.id,
        project_id: resident.project_id,
        service_id: form.service_id,
        service_type: form.service_type,
        notes: form.notes || null,
        image_url,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم إرسال الطلب"); setOpen(false); qc.invalidateQueries({ queryKey: ["my-requests"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">طلبات الصيانة</h1>
          <p className="mt-1 text-sm text-muted-foreground">تابع طلباتك أو أنشئ طلباً جديداً</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="ms-2 h-4 w-4" />طلب جديد</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>طلب صيانة جديد</DialogTitle></DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const serviceId = String(fd.get("service_id"));
                const svc = services?.find((s: any) => s.id === serviceId);
                create.mutate({
                  service_id: serviceId,
                  service_type: svc?.name_ar ?? "صيانة",
                  notes: String(fd.get("notes") ?? ""),
                  image: (fd.get("image") as File) || null,
                });
              }}
            >
              <div className="space-y-1.5">
                <Label>نوع الخدمة</Label>
                <Select name="service_id" required>
                  <SelectTrigger><SelectValue placeholder="اختر خدمة" /></SelectTrigger>
                  <SelectContent>
                    {services?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name_ar}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>الملاحظات</Label><Textarea name="notes" /></div>
              <div className="space-y-1.5"><Label>صورة (اختياري)</Label><Input name="image" type="file" accept="image/*" /></div>
              <DialogFooter><Button type="submit" disabled={create.isPending}>{create.isPending ? "جاري…" : "إرسال"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {requests?.map((r: any) => (
          <Card key={r.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{r.service_type}</span>
                <Badge variant="outline">{STATUS_LABEL[r.status] ?? r.status}</Badge>
              </div>
              {r.notes && <p className="mt-2 text-sm text-muted-foreground">{r.notes}</p>}
              {r.admin_notes && <p className="mt-2 text-sm text-primary">رد الإدارة: {r.admin_notes}</p>}
              <p className="mt-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-EG")}</p>
            </CardContent>
          </Card>
        ))}
        {!requests?.length && <p className="py-12 text-center text-muted-foreground">لا توجد طلبات</p>}
      </div>
    </div>
  );
}
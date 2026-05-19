import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile } from "@/lib/storage";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-installments")({ component: MyInstallmentsPage });

const STATUS_LABEL: Record<string, string> = {
  pending_confirmation: "بانتظار التأكيد",
  confirmed: "مؤكد",
  rejected: "مرفوض",
};

function MyInstallmentsPage() {
  const qc = useQueryClient();
  const [openFor, setOpenFor] = useState<string | null>(null);

  const { data: resident } = useQuery({
    queryKey: ["my-resident"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      return (await supabase.from("residents").select("*").eq("user_id", user.id).maybeSingle()).data;
    },
  });

  const { data: items } = useQuery({
    queryKey: ["my-installments", resident?.id],
    enabled: !!resident?.id,
    queryFn: async () => {
      const { data } = await supabase.from("installments").select("*").eq("resident_id", resident!.id).order("due_date", { ascending: true });
      return data ?? [];
    },
  });

  const upload = useMutation({
    mutationFn: async ({ id, file, paid_by_name }: { id: string; file: File; paid_by_name: string }) => {
      const path = await uploadFile("receipts", file, resident!.id);
      const { error } = await supabase.from("installments").update({
        receipt_url: path,
        paid_at: new Date().toISOString(),
        paid_by_name,
        payment_status: "pending_confirmation",
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم رفع الإيصال"); setOpenFor(null); qc.invalidateQueries({ queryKey: ["my-installments"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الأقساط</h1>
        <p className="mt-1 text-sm text-muted-foreground">ارفع إيصال السداد لإثبات الدفع</p>
      </div>

      <div className="space-y-3">
        {items?.map((i: any) => (
          <Card key={i.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{Number(i.amount).toLocaleString()} ج.م</span>
                  <Badge variant={i.payment_status === "confirmed" ? "default" : i.payment_status === "rejected" ? "destructive" : "outline"}>
                    {STATUS_LABEL[i.payment_status] ?? "غير مدفوع"}
                  </Badge>
                </div>
                {i.description && <p className="mt-1 text-sm text-muted-foreground">{i.description}</p>}
                {i.due_date && <p className="mt-1 text-xs text-muted-foreground">استحقاق: {new Date(i.due_date).toLocaleDateString("ar-EG")}</p>}
                {i.rejection_reason && <p className="mt-1 text-xs text-destructive">سبب الرفض: {i.rejection_reason}</p>}
              </div>
              {(i.payment_status === null || i.payment_status === "rejected") && (
                <Dialog open={openFor === i.id} onOpenChange={(o) => setOpenFor(o ? i.id : null)}>
                  <DialogTrigger asChild><Button size="sm"><Upload className="ms-2 h-4 w-4" />رفع إيصال</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>رفع إيصال السداد</DialogTitle></DialogHeader>
                    <form
                      className="space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        const file = fd.get("file") as File;
                        if (!file?.size) { toast.error("اختر ملف"); return; }
                        upload.mutate({ id: i.id, file, paid_by_name: String(fd.get("name") ?? resident?.name ?? "") });
                      }}
                    >
                      <div className="space-y-1.5"><Label>اسم الدافع</Label><Input name="name" defaultValue={resident?.name} required /></div>
                      <div className="space-y-1.5"><Label>الإيصال (صورة/PDF)</Label><Input name="file" type="file" accept="image/*,application/pdf" required /></div>
                      <DialogFooter><Button type="submit" disabled={upload.isPending}>{upload.isPending ? "جاري الرفع…" : "إرسال"}</Button></DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </CardContent>
          </Card>
        ))}
        {!items?.length && <p className="py-12 text-center text-muted-foreground">لا توجد أقساط</p>}
      </div>
    </div>
  );
}
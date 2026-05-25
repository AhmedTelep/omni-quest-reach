import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile } from "@/lib/storage";
import { addInstallmentPayment } from "@/lib/installments.functions";
import { openReceiptPdf } from "@/lib/installment-pdf";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-installments")({ component: MyInstallmentsPage });

const STATUS_LABEL: Record<string, string> = {
  pending_confirmation: "بانتظار التأكيد",
  confirmed: "مؤكد",
  rejected: "مرفوض",
  partial: "مدفوع جزئياً",
};

function MyInstallmentsPage() {
  const qc = useQueryClient();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const addPayment = useServerFn(addInstallmentPayment);

  const { data: resident } = useQuery({
    queryKey: ["my-resident"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      return (await supabase.from("residents").select("*, projects(name_ar, logo)").eq("user_id", user.id).maybeSingle()).data;
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
    mutationFn: async ({ id, file, paid_by_name, amount }: { id: string; file: File; paid_by_name: string; amount: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("الجلسة منتهية");
      const path = await uploadFile("receipts", file, user.id);
      await addPayment({ data: { installmentId: id, amount, receiptUrl: path, paidByName: paid_by_name } });
    },
    onSuccess: () => { toast.success("تم رفع الإيصال"); setOpenFor(null); qc.invalidateQueries({ queryKey: ["my-installments"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الأقساط</h1>
        <p className="mt-1 text-sm text-muted-foreground">ارفع إيصال السداد (كلي أو جزئي) لإثبات الدفع</p>
      </div>

      <div className="space-y-3">
        {items?.map((i: { id: string; serial: string; amount: number; paid_amount: number | null; payment_status: string | null; description: string | null; due_date: string | null; paid_at: string | null; confirmed_at: string | null; confirmed_by_name: string | null; paid_by_name: string | null; rejection_reason: string | null; late_fee_amount: number | null }) => {
          const amount = Number(i.amount);
          const paid = Number(i.paid_amount ?? 0);
          const lateFee = Number(i.late_fee_amount ?? 0);
          const remaining = Math.max(0, amount + lateFee - paid);
          const canPay = remaining > 0 && i.payment_status !== "confirmed";
          const proj = (resident as { projects?: { name_ar?: string; logo?: string | null } } | null)?.projects;
          return (
          <Card key={i.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{amount.toLocaleString()} ج.م</span>
                  <Badge variant={i.payment_status === "confirmed" ? "default" : i.payment_status === "rejected" ? "destructive" : "outline"}>
                    {STATUS_LABEL[i.payment_status ?? ""] ?? "غير مدفوع"}
                  </Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{i.serial}</p>
                <div className="mt-1 flex flex-wrap gap-3 text-xs">
                  <span className="text-emerald-600">مدفوع: {paid.toLocaleString()} ج.م</span>
                  {lateFee > 0 && <span className="text-rose-600">غرامة تأخير: {lateFee.toLocaleString()} ج.م</span>}
                  {remaining > 0 && <span className="text-rose-600">متبقي: {remaining.toLocaleString()} ج.م</span>}
                </div>
                {i.description && <p className="mt-1 text-sm text-muted-foreground">{i.description}</p>}
                {i.due_date && <p className="mt-1 text-xs text-muted-foreground">استحقاق: {new Date(i.due_date).toLocaleDateString("ar-EG")}</p>}
                {i.rejection_reason && <p className="mt-1 text-xs text-destructive">سبب الرفض: {i.rejection_reason}</p>}
              </div>
              <div className="flex gap-2">
                {(i.payment_status === "confirmed" || i.payment_status === "partial") && (
                  <Button size="sm" variant="outline" onClick={() => openReceiptPdf({
                    installmentSerial: i.serial,
                    residentName: resident?.name ?? "",
                    unitNumber: resident?.unit_number ?? "",
                    projectName: proj?.name_ar,
                    projectLogo: proj?.logo,
                    installmentAmount: amount,
                    paidAmount: paid,
                    remainingAmount: remaining,
                    lateFeeAmount: lateFee,
                    description: i.description,
                    dueDate: i.due_date,
                    paidAt: i.paid_at,
                    confirmedAt: i.confirmed_at ?? i.paid_at,
                    confirmedByName: i.confirmed_by_name,
                    paidByName: i.paid_by_name,
                  })}><Download className="ms-2 h-4 w-4" />إيصال PDF</Button>
                )}
                {canPay && (
                  <Dialog open={openFor === i.id} onOpenChange={(o) => setOpenFor(o ? i.id : null)}>
                    <DialogTrigger asChild><Button size="sm"><Upload className="ms-2 h-4 w-4" />سداد / رفع إيصال</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>رفع إيصال السداد ({i.serial})</DialogTitle></DialogHeader>
                      <form
                        className="space-y-3"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const fd = new FormData(e.currentTarget);
                          const file = fd.get("file") as File;
                          const amt = Number(fd.get("amount"));
                          if (!file?.size) { toast.error("اختر ملف"); return; }
                          if (!amt || amt <= 0) { toast.error("أدخل مبلغ صحيح"); return; }
                          if (amt > remaining + 0.01) { toast.error(`المبلغ يتجاوز المتبقي (${remaining})`); return; }
                          upload.mutate({ id: i.id, file, amount: amt, paid_by_name: String(fd.get("name") ?? resident?.name ?? "") });
                        }}
                      >
                        <div className="space-y-1.5"><Label>اسم الدافع</Label><Input name="name" defaultValue={resident?.name} required /></div>
                        <div className="space-y-1.5">
                          <Label>المبلغ المدفوع (المتبقي: {remaining.toLocaleString()} ج.م)</Label>
                          <Input name="amount" type="number" step="0.01" min="0.01" max={remaining} defaultValue={remaining} required />
                        </div>
                        <div className="space-y-1.5"><Label>الإيصال (صورة/PDF)</Label><Input name="file" type="file" accept="image/*,application/pdf" required /></div>
                        <DialogFooter><Button type="submit" disabled={upload.isPending}>{upload.isPending ? "جاري الرفع…" : "إرسال"}</Button></DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardContent>
          </Card>
          );
        })}
        {!items?.length && <p className="py-12 text-center text-muted-foreground">لا توجد أقساط</p>}
      </div>
    </div>
  );
}
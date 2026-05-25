import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/contexts/project-context";
import { useAuthSession, useUserRoles } from "@/hooks/use-auth";
import { signedUrl } from "@/lib/storage";
import { decideInstallment, createInstallment } from "@/lib/admin-users.functions";
import { decideInstallmentPayment } from "@/lib/installments.functions";
import { openReceiptPdf } from "@/lib/installment-pdf";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Check, X, FileText, ChevronDown, ChevronUp, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/installments")({ component: InstallmentsPage });

const STATUS_LABEL: Record<string, string> = {
  pending_confirmation: "بانتظار التأكيد",
  confirmed: "مؤكد",
  rejected: "مرفوض",
  partial: "مدفوع جزئياً",
};

function InstallmentsPage() {
  const qc = useQueryClient();
  const { projectId } = useProject();
  const { user } = useAuthSession();
  const { data: roles } = useUserRoles(user);
  // Creators can add new installments (admin/manager only).
  const canCreate = !!roles?.some((r) => ["admin", "manager"].includes(r));
  // Approvers can confirm/reject installments (admin/manager/accountant).
  const canApprove = !!roles?.some((r) => ["admin", "manager", "accountant"].includes(r));
  // Sales manager and other roles need the residents list only if they can create.
  const showResidentPicker = canCreate;
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const decide = useServerFn(decideInstallment);
  const createFn = useServerFn(createInstallment);
  const decidePay = useServerFn(decideInstallmentPayment);

  const { data: residents } = useQuery({
    queryKey: ["residents-min", projectId],
    enabled: showResidentPicker,
    queryFn: async () => {
      let q = supabase.from("residents").select("id, name, unit_number, project_id").order("unit_number");
      if (projectId) q = q.eq("project_id", projectId);
      return (await q).data ?? [];
    },
  });

  const { data: items } = useQuery({
    queryKey: ["installments", projectId],
    queryFn: async () => {
      let q = supabase
        .from("installments")
        .select("*, residents(name, unit_number), projects(name_ar, logo)")
        .order("created_at", { ascending: false });
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("installments-rt")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "installments" }, () => {
        qc.invalidateQueries({ queryKey: ["installments"] });
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "installment_payments" }, () => {
        qc.invalidateQueries({ queryKey: ["installments"] });
        qc.invalidateQueries({ queryKey: ["installment-payments"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const create = useMutation({
    mutationFn: (form: { resident_id: string; project_id: string; amount: number; description: string; due_date: string }) =>
      createFn({ data: form }),
    onSuccess: () => { toast.success("تم إنشاء القسط"); setOpen(false); qc.invalidateQueries({ queryKey: ["installments"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmIns = useMutation({
    mutationFn: async ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
      decide({ data: { installmentId: id, approve, reason } }),
    onSuccess: () => { toast.success("تم"); qc.invalidateQueries({ queryKey: ["installments"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const decidePayMut = useMutation({
    mutationFn: async (vars: { paymentId: string; approve: boolean; reason?: string }) =>
      decidePay({ data: vars }),
    onSuccess: () => { toast.success("تم"); qc.invalidateQueries({ queryKey: ["installments"] }); qc.invalidateQueries({ queryKey: ["installment-payments"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openReceipt = async (path: string) => {
    try { window.open(await signedUrl("receipts", path), "_blank"); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">الأقساط</h1>
          <p className="mt-1 text-sm text-muted-foreground">إدارة وتأكيد الأقساط</p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="ms-2 h-4 w-4" />قسط جديد</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>إنشاء قسط</DialogTitle></DialogHeader>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const resId = String(fd.get("resident_id"));
                  const res = residents?.find((r) => r.id === resId);
                  if (!res?.project_id) { toast.error("الساكن غير مرتبط بمشروع"); return; }
                  create.mutate({
                    resident_id: resId,
                    project_id: res.project_id,
                    amount: Number(fd.get("amount")),
                    description: String(fd.get("description") ?? ""),
                    due_date: String(fd.get("due_date")),
                  });
                }}
              >
                <div className="space-y-1.5">
                  <Label>الساكن</Label>
                  <Select name="resident_id" required>
                    <SelectTrigger><SelectValue placeholder="اختر ساكن" /></SelectTrigger>
                    <SelectContent>
                      {residents?.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name} — {r.unit_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>المبلغ</Label><Input name="amount" type="number" step="0.01" required /></div>
                <div className="space-y-1.5"><Label>تاريخ الاستحقاق</Label><Input name="due_date" type="date" required /></div>
                <div className="space-y-1.5"><Label>الوصف</Label><Textarea name="description" /></div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>{create.isPending ? "جاري…" : "حفظ"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr className="text-right">
              <th className="p-3">السيريال</th>
              <th className="p-3">الساكن</th>
              <th className="p-3">المشروع</th>
              <th className="p-3">المبلغ / المدفوع</th>
              <th className="p-3">الاستحقاق</th>
              <th className="p-3">الحالة</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {items?.map((i: any) => {
              const paid = Number(i.paid_amount ?? 0);
              const amount = Number(i.amount);
              const remaining = Math.max(0, amount - paid);
              const isExpanded = expanded === i.id;
              return (
                <>
                  <tr key={i.id} className="border-b">
                    <td className="p-3 font-mono text-xs">{i.serial}</td>
                    <td className="p-3">{i.residents?.name} — {i.residents?.unit_number}</td>
                    <td className="p-3 text-muted-foreground">{i.projects?.name_ar ?? "—"}</td>
                    <td className="p-3">
                      <div className="font-semibold">{amount.toLocaleString()} ج.م</div>
                      <div className="text-xs text-emerald-600">مدفوع: {paid.toLocaleString()}</div>
                      {remaining > 0 && <div className="text-xs text-rose-600">متبقي: {remaining.toLocaleString()}</div>}
                    </td>
                    <td className="p-3 text-muted-foreground">{i.due_date ? new Date(i.due_date).toLocaleDateString("ar-EG") : "—"}</td>
                    <td className="p-3">
                      <Badge variant={i.payment_status === "confirmed" ? "default" : i.payment_status === "rejected" ? "destructive" : "outline"}>
                        {STATUS_LABEL[i.payment_status] ?? "غير مدفوع"}
                      </Badge>
                    </td>
                    <td className="p-3 text-left">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setExpanded(isExpanded ? null : i.id)} title="الدفعات">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        {(i.payment_status === "confirmed" || i.payment_status === "partial") && (
                          <Button size="icon" variant="ghost" title="إيصال PDF" onClick={() => openReceiptPdf({
                            installmentSerial: i.serial,
                            residentName: i.residents?.name ?? "",
                            unitNumber: i.residents?.unit_number ?? "",
                            projectName: i.projects?.name_ar,
                            projectLogo: i.projects?.logo,
                            installmentAmount: amount,
                            paidAmount: paid,
                            remainingAmount: remaining,
                            description: i.description,
                            dueDate: i.due_date,
                            paidAt: i.paid_at,
                            confirmedAt: i.confirmed_at ?? i.paid_at,
                            confirmedByName: i.confirmed_by_name,
                            paidByName: i.paid_by_name,
                          })}>
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        {i.receipt_url && (
                          <Button size="icon" variant="ghost" onClick={() => openReceipt(i.receipt_url)}>
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                        {canApprove && i.payment_status === "pending_confirmation" && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => confirmIns.mutate({ id: i.id, approve: true })}>
                              <Check className="h-4 w-4 text-emerald-600" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => {
                              const r = prompt("سبب الرفض؟");
                              if (r !== null) confirmIns.mutate({ id: i.id, approve: false, reason: r });
                            }}>
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-muted/30">
                      <td colSpan={7} className="p-4">
                        <PaymentsList
                          installmentId={i.id}
                          installment={i}
                          canApprove={canApprove}
                          onDecide={(pid, approve, reason) => decidePayMut.mutate({ paymentId: pid, approve, reason })}
                          onOpenReceipt={openReceipt}
                        />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {!items?.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">لا توجد أقساط</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}

function PaymentsList({
  installmentId,
  installment,
  canApprove,
  onDecide,
  onOpenReceipt,
}: {
  installmentId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  installment: any;
  canApprove: boolean;
  onDecide: (paymentId: string, approve: boolean, reason?: string) => void;
  onOpenReceipt: (path: string) => void;
}) {
  const { data: payments } = useQuery({
    queryKey: ["installment-payments", installmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installment_payments")
        .select("*")
        .eq("installment_id", installmentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!payments?.length) return <p className="text-center text-sm text-muted-foreground">لا توجد دفعات مسجلة</p>;
  const amount = Number(installment.amount);
  const paid = Number(installment.paid_amount ?? 0);
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">الدفعات ({payments.length})</h4>
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr className="text-right">
            <th className="p-2">رقم الدفعة</th>
            <th className="p-2">المبلغ</th>
            <th className="p-2">تاريخ الدفع</th>
            <th className="p-2">الحالة</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p: any) => (
            <tr key={p.id} className="border-t">
              <td className="p-2 font-mono">{p.serial}</td>
              <td className="p-2 font-semibold">{Number(p.amount).toLocaleString()} ج.م</td>
              <td className="p-2">{p.paid_at ? new Date(p.paid_at).toLocaleDateString("ar-EG") : "—"}</td>
              <td className="p-2">
                <Badge variant={p.payment_status === "confirmed" ? "default" : p.payment_status === "rejected" ? "destructive" : "outline"}>
                  {STATUS_LABEL[p.payment_status] ?? p.payment_status}
                </Badge>
              </td>
              <td className="p-2 text-left">
                <div className="flex justify-end gap-1">
                  {p.receipt_url && (
                    <Button size="icon" variant="ghost" onClick={() => onOpenReceipt(p.receipt_url)}>
                      <FileText className="h-3 w-3" />
                    </Button>
                  )}
                  {p.payment_status === "confirmed" && (
                    <Button size="icon" variant="ghost" title="إيصال PDF" onClick={() => openReceiptPdf({
                      installmentSerial: installment.serial,
                      paymentSerial: p.serial,
                      residentName: installment.residents?.name ?? "",
                      unitNumber: installment.residents?.unit_number ?? "",
                      projectName: installment.projects?.name_ar,
                      projectLogo: installment.projects?.logo,
                      installmentAmount: amount,
                      paidAmount: paid,
                      remainingAmount: Math.max(0, amount - paid),
                      paymentAmount: Number(p.amount),
                      description: installment.description,
                      dueDate: installment.due_date,
                      paidAt: p.paid_at,
                      confirmedAt: p.confirmed_at,
                      confirmedByName: p.confirmed_by_name,
                      paidByName: p.paid_by_name,
                    })}>
                      <Download className="h-3 w-3" />
                    </Button>
                  )}
                  {canApprove && p.payment_status === "pending_confirmation" && (
                    <>
                      <Button size="icon" variant="ghost" onClick={() => onDecide(p.id, true)}>
                        <Check className="h-3 w-3 text-emerald-600" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => {
                        const r = prompt("سبب الرفض؟");
                        if (r !== null) onDecide(p.id, false, r);
                      }}>
                        <X className="h-3 w-3 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
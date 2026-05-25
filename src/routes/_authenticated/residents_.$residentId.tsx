import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession, useUserRoles, hasAnyRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createInstallmentSchedule } from "@/lib/installments.functions";
import { openReceiptPdf } from "@/lib/installment-pdf";
import { toast } from "sonner";
import {
  ArrowRight,
  User,
  Phone,
  Building2,
  Home,
  Wallet,
  Receipt,
  Wrench,
  Link as LinkIcon,
  CalendarPlus,
  Download,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/residents_/$residentId")({
  component: ResidentDetailPage,
});

const STAFF_ROLES = ["admin", "manager", "sales_manager"] as const;

function fmtMoney(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(n) + " ج.م";
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG");
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  confirmed: { label: "مدفوع", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  partial: { label: "مدفوع جزئياً", cls: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  pending_confirmation: { label: "بانتظار التأكيد", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  rejected: { label: "مرفوض", cls: "bg-rose-500/10 text-rose-600 border-rose-500/30" },
  unpaid: { label: "غير مدفوع", cls: "bg-muted text-muted-foreground border-border" },
};

const REQ_STATUS_LABEL: Record<string, string> = {
  open: "مفتوح",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
  cancelled: "ملغي",
};

function ResidentDetailPage() {
  const { residentId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const { data: roles, isLoading: rolesLoading } = useUserRoles(user);
  const allowed = hasAnyRole(roles, STAFF_ROLES as unknown as any);
  const canSchedule = roles?.some((r) => ["admin", "manager"].includes(r)) ?? false;
  const qc = useQueryClient();
  const [schedOpen, setSchedOpen] = useState(false);
  const createSched = useServerFn(createInstallmentSchedule);
  const schedMut = useMutation({
    mutationFn: (vars: { totalAmount: number; count: number; frequency: "weekly"|"monthly"|"quarterly"|"yearly"; startDate: string; description: string }) =>
      createSched({ data: { residentId, ...vars } }),
    onSuccess: (res) => {
      toast.success(`تم إنشاء ${res.created} قسط`);
      setSchedOpen(false);
      qc.invalidateQueries({ queryKey: ["resident-installments", residentId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!rolesLoading && roles && !allowed) {
      navigate({ to: "/dashboard" });
    }
  }, [rolesLoading, roles, allowed, navigate]);

  const resident = useQuery({
    queryKey: ["resident-detail", residentId],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("residents")
        .select("*, projects(id, name_ar, name_en, city, color, logo)")
        .eq("id", residentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const unit = useQuery({
    queryKey: ["resident-unit", resident.data?.project_id, resident.data?.unit_number],
    enabled: !!resident.data?.project_id && !!resident.data?.unit_number,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units")
        .select("*")
        .eq("project_id", resident.data!.project_id!)
        .eq("unit_number", resident.data!.unit_number)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const installments = useQuery({
    queryKey: ["resident-installments", residentId],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installments")
        .select("*")
        .eq("resident_id", residentId)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const requests = useQuery({
    queryKey: ["resident-requests", residentId],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_requests")
        .select("*, services(name_ar, icon, color)")
        .eq("resident_id", residentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (rolesLoading) {
    return <div className="p-8 text-center text-muted-foreground">جاري التحميل…</div>;
  }

  if (!allowed) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        ليس لديك صلاحية لعرض هذه الصفحة
      </div>
    );
  }

  if (resident.isLoading) {
    return <div className="p-8 text-center text-muted-foreground">جاري تحميل بيانات الساكن…</div>;
  }

  if (!resident.data) {
    return (
      <div className="space-y-4 p-8 text-center">
        <p className="text-muted-foreground">الساكن غير موجود</p>
        <Button asChild variant="outline">
          <Link to="/residents">العودة للسكان</Link>
        </Button>
      </div>
    );
  }

  const r = resident.data as any;
  const items = installments.data ?? [];
  const totalAmount = items.reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
  const paidAmount = items
    .reduce((s: number, x: any) => s + Number(x.paid_amount ?? 0), 0);
  const pendingAmount = items
    .filter((x: any) => x.payment_status === "pending_confirmation")
    .reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
  const remainingAmount = totalAmount - paidAmount;
  const paidCount = items.filter((x: any) => x.payment_status === "confirmed").length;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/residents"><ArrowRight className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{r.name}</h1>
            <p className="text-sm text-muted-foreground">
              وحدة {r.unit_number}
              {r.projects?.name_ar ? ` • ${r.projects.name_ar}` : ""}
            </p>
          </div>
        </div>
        <Badge variant={r.is_active ? "default" : "secondary"}>
          {r.is_active ? "نشط" : "غير نشط"}
        </Badge>
      </div>

      {/* Profile + Unit */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-primary" /> بيانات الساكن
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow icon={<User className="h-4 w-4" />} label="الاسم" value={r.name} />
            <InfoRow icon={<Phone className="h-4 w-4" />} label="الهاتف" value={r.phone ?? "—"} />
            <InfoRow icon={<Home className="h-4 w-4" />} label="رقم الوحدة" value={r.unit_number} />
            <InfoRow
              icon={<Building2 className="h-4 w-4" />}
              label="المشروع"
              value={r.projects?.name_ar ?? "—"}
            />
            <InfoRow
              icon={<Wallet className="h-4 w-4" />}
              label="سعر الوحدة"
              value={fmtMoney(r.unit_price)}
            />
            {r.unit_link && (
              <InfoRow
                icon={<LinkIcon className="h-4 w-4" />}
                label="رابط الوحدة"
                value={
                  <a
                    href={r.unit_link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    فتح الرابط
                  </a>
                }
              />
            )}
            <InfoRow label="تاريخ الإضافة" value={fmtDate(r.created_at)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Home className="h-4 w-4 text-primary" /> بيانات الوحدة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {unit.data ? (
              <>
                <InfoRow label="رقم الوحدة" value={unit.data.unit_number} />
                <InfoRow label="الطابق" value={unit.data.floor ?? "—"} />
                <InfoRow
                  label="المساحة"
                  value={unit.data.area ? `${unit.data.area} م²` : "—"}
                />
                <InfoRow label="السعر" value={fmtMoney(unit.data.price)} />
                <InfoRow
                  label="الحالة"
                  value={
                    <Badge variant="outline" className="font-normal">
                      {unit.data.status === "sold"
                        ? "مباعة"
                        : unit.data.status === "reserved"
                          ? "محجوزة"
                          : "متاحة"}
                    </Badge>
                  }
                />
                {unit.data.notes && <InfoRow label="ملاحظات" value={unit.data.notes} />}
              </>
            ) : (
              <p className="text-muted-foreground">لا توجد بيانات وحدة مرتبطة</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="إجمالي الأقساط" value={fmtMoney(totalAmount)} sub={`${items.length} قسط`} />
        <SummaryCard label="المدفوع" value={fmtMoney(paidAmount)} sub={`${paidCount} قسط`} accent="emerald" />
        <SummaryCard label="بانتظار التأكيد" value={fmtMoney(pendingAmount)} accent="amber" />
        <SummaryCard label="المتبقي" value={fmtMoney(remainingAmount)} accent="rose" />
      </div>

      {/* Installments */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4 text-primary" /> الأقساط ({items.length})
            </CardTitle>
            {canSchedule && (
              <Dialog open={schedOpen} onOpenChange={setSchedOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline"><CalendarPlus className="ms-2 h-4 w-4" />جدولة أقساط</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>إنشاء جدول أقساط</DialogTitle></DialogHeader>
                  <form className="space-y-3" onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    schedMut.mutate({
                      totalAmount: Number(fd.get("total")),
                      count: Number(fd.get("count")),
                      frequency: String(fd.get("freq")) as "weekly"|"monthly"|"quarterly"|"yearly",
                      startDate: String(fd.get("start")),
                      description: String(fd.get("desc") ?? ""),
                    });
                  }}>
                    <div className="space-y-1.5"><Label>المبلغ الإجمالي</Label><Input name="total" type="number" step="0.01" required /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label>عدد الأقساط</Label><Input name="count" type="number" min="1" max="600" required /></div>
                      <div className="space-y-1.5">
                        <Label>التكرار</Label>
                        <Select name="freq" defaultValue="monthly">
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weekly">أسبوعي</SelectItem>
                            <SelectItem value="monthly">شهري</SelectItem>
                            <SelectItem value="quarterly">ربع سنوي</SelectItem>
                            <SelectItem value="yearly">سنوي</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5"><Label>تاريخ أول قسط</Label><Input name="start" type="date" required /></div>
                    <div className="space-y-1.5"><Label>الوصف</Label><Textarea name="desc" /></div>
                    <DialogFooter><Button type="submit" disabled={schedMut.isPending}>{schedMut.isPending ? "جاري…" : "إنشاء الجدول"}</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr className="text-right">
                  <th className="p-3">السيريال</th>
                  <th className="p-3">الوصف</th>
                  <th className="p-3">المبلغ / المدفوع</th>
                  <th className="p-3">تاريخ الاستحقاق</th>
                  <th className="p-3">تاريخ الدفع</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3">الإيصال</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it: any) => {
                  const st = STATUS_LABEL[it.payment_status ?? "unpaid"] ?? STATUS_LABEL.unpaid;
                  const paid = Number(it.paid_amount ?? 0);
                  const amount = Number(it.amount);
                  return (
                    <tr key={it.id} className="border-b">
                      <td className="p-3 font-mono text-xs">{it.serial}</td>
                      <td className="p-3">{it.description ?? "—"}</td>
                      <td className="p-3">
                        <div className="font-medium">{fmtMoney(amount)}</div>
                        {paid > 0 && <div className="text-xs text-emerald-600">مدفوع: {fmtMoney(paid)}</div>}
                      </td>
                      <td className="p-3 text-muted-foreground">{fmtDate(it.due_date)}</td>
                      <td className="p-3 text-muted-foreground">{fmtDate(it.paid_at)}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          {(it.payment_status === "confirmed" || it.payment_status === "partial") && (
                            <button className="text-primary underline text-xs" onClick={() => openReceiptPdf({
                              installmentSerial: it.serial,
                              residentName: r.name,
                              unitNumber: r.unit_number,
                              projectName: r.projects?.name_ar,
                              projectLogo: r.projects?.logo,
                              installmentAmount: amount,
                              paidAmount: paid,
                              remainingAmount: Math.max(0, amount - paid),
                              description: it.description,
                              dueDate: it.due_date,
                              paidAt: it.paid_at,
                              confirmedAt: it.confirmed_at ?? it.paid_at,
                              confirmedByName: it.confirmed_by_name,
                              paidByName: it.paid_by_name,
                            })}><Download className="inline h-3 w-3" /> PDF</button>
                          )}
                          {it.receipt_url && <ReceiptLink path={it.receipt_url} />}
                          {!it.receipt_url && it.payment_status !== "confirmed" && it.payment_status !== "partial" && <span className="text-muted-foreground">—</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      لا توجد أقساط
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Requests */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4 text-primary" /> طلبات الصيانة ({requests.data?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr className="text-right">
                  <th className="p-3">الخدمة</th>
                  <th className="p-3">ملاحظات</th>
                  <th className="p-3">التاريخ المفضل</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3">تاريخ الإنشاء</th>
                </tr>
              </thead>
              <tbody>
                {(requests.data ?? []).map((rq: any) => (
                  <tr key={rq.id} className="border-b">
                    <td className="p-3">{rq.services?.name_ar ?? rq.service_type}</td>
                    <td className="p-3 max-w-xs truncate text-muted-foreground">
                      {rq.notes ?? "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">{fmtDate(rq.preferred_date)}</td>
                    <td className="p-3">
                      <Badge variant="outline">{REQ_STATUS_LABEL[rq.status] ?? rq.status}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">{fmtDate(rq.created_at)}</td>
                  </tr>
                ))}
                {(!requests.data || requests.data.length === 0) && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      لا توجد طلبات صيانة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-2 last:border-0 last:pb-0">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-end font-medium">{value}</div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "emerald" | "amber" | "rose";
}) {
  const accentCls =
    accent === "emerald"
      ? "text-emerald-600"
      : accent === "amber"
        ? "text-amber-600"
        : accent === "rose"
          ? "text-rose-600"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-xl font-bold ${accentCls}`}>{value}</p>
        {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ReceiptLink({ path }: { path: string }) {
  const isFullUrl = path.startsWith("http");
  const url = useQuery({
    queryKey: ["receipt-url", path],
    enabled: !isFullUrl,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("receipts")
        .createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  const href = isFullUrl ? path : url.data;
  if (!href) return <span className="text-muted-foreground">…</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary underline">
      عرض
    </a>
  );
}
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import { createCustomInstallmentSchedule } from "@/lib/installments.functions";

type Frequency = "weekly" | "monthly" | "quarterly" | "biannual" | "yearly";

export type SheetRow = {
  id: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  description: string;
  isDownPayment: boolean;
};

function addPeriod(date: Date, freq: Frequency, n: number): Date {
  const d = new Date(date);
  if (freq === "weekly") d.setDate(d.getDate() + n * 7);
  else if (freq === "monthly") d.setMonth(d.getMonth() + n);
  else if (freq === "quarterly") d.setMonth(d.getMonth() + n * 3);
  else if (freq === "biannual") d.setMonth(d.getMonth() + n * 6);
  else if (freq === "yearly") d.setFullYear(d.getFullYear() + n);
  return d;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function generateRows(opts: {
  total: number;
  count: number;
  frequency: Frequency;
  startDate: string;
  downPayment: number;
}): SheetRow[] {
  const rows: SheetRow[] = [];
  const start = opts.startDate ? new Date(opts.startDate) : new Date();
  const down = Math.min(Math.max(0, opts.downPayment), opts.total);
  if (down > 0) {
    rows.push({
      id: crypto.randomUUID(),
      amount: down,
      dueDate: toISODate(start),
      description: "دفعة مقدمة",
      isDownPayment: true,
    });
  }
  const remaining = Math.max(0, opts.total - down);
  const n = Math.max(1, opts.count);
  const per = Math.round((remaining / n) * 100) / 100;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    const amt = isLast ? Math.round((remaining - acc) * 100) / 100 : per;
    acc += amt;
    rows.push({
      id: crypto.randomUUID(),
      amount: amt,
      dueDate: toISODate(addPeriod(start, opts.frequency, i + (down > 0 ? 1 : 0))),
      description: `قسط ${i + 1}/${n}`,
      isDownPayment: false,
    });
  }
  return rows;
}

export function InstallmentSheetDialog({
  open,
  onOpenChange,
  residentId,
  defaultTotal,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  residentId: string | null;
  defaultTotal?: number | null;
  onCreated?: () => void;
}) {
  const [total, setTotal] = useState<number>(Number(defaultTotal ?? 0));
  const [count, setCount] = useState<number>(12);
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [startDate, setStartDate] = useState<string>(toISODate(new Date()));
  const [downPayment, setDownPayment] = useState<number>(0);
  const [desc, setDesc] = useState<string>("");
  const [rows, setRows] = useState<SheetRow[]>([]);

  // Auto-generate when params change (only if rows weren't manually edited yet)
  useEffect(() => {
    if (!open) return;
    setTotal(Number(defaultTotal ?? 0));
    setRows(generateRows({
      total: Number(defaultTotal ?? 0),
      count: 12,
      frequency: "monthly",
      startDate: toISODate(new Date()),
      downPayment: 0,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultTotal]);

  const regen = () => {
    setRows(generateRows({ total, count, frequency, startDate, downPayment }));
  };

  const updateRow = (id: string, patch: Partial<SheetRow>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const removeRow = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));
  const addRow = () => {
    const last = rows[rows.length - 1];
    const baseDate = last ? addPeriod(new Date(last.dueDate), frequency, 1) : new Date();
    setRows((rs) => [
      ...rs,
      {
        id: crypto.randomUUID(),
        amount: 0,
        dueDate: toISODate(baseDate),
        description: `قسط ${rs.filter((r) => !r.isDownPayment).length + 1}`,
        isDownPayment: false,
      },
    ]);
  };

  const sumRows = useMemo(() => rows.reduce((s, r) => s + Number(r.amount || 0), 0), [rows]);
  const diff = Math.round((sumRows - total) * 100) / 100;

  const createFn = useServerFn(createCustomInstallmentSchedule);
  const save = useMutation({
    mutationFn: async () => {
      if (!residentId) throw new Error("لا يوجد ساكن");
      if (rows.length === 0) throw new Error("أضف قسطاً واحداً على الأقل");
      for (const r of rows) {
        if (!r.amount || r.amount <= 0) throw new Error("كل قسط يجب أن يحتوي مبلغاً موجباً");
        if (!r.dueDate) throw new Error("كل قسط يجب أن يحتوي تاريخ استحقاق");
      }
      return createFn({
        data: {
          residentId,
          frequency,
          startDate,
          description: desc,
          installments: rows.map((r) => ({
            amount: Number(r.amount),
            dueDate: r.dueDate,
            description: r.description,
            isDownPayment: r.isDownPayment,
          })),
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`تم إنشاء ${res.created} قسط`);
      onOpenChange(false);
      onCreated?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>شيت الأقساط — تخصيص كامل</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1.5">
            <Label>إجمالي السعر</Label>
            <Input type="number" step="0.01" value={total} onChange={(e) => setTotal(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>مقدم</Label>
            <Input type="number" step="0.01" min="0" value={downPayment} onChange={(e) => setDownPayment(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>عدد الأقساط</Label>
            <Input type="number" min="1" max="600" value={count} onChange={(e) => setCount(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>التكرار</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">أسبوعي</SelectItem>
                <SelectItem value="monthly">شهري</SelectItem>
                <SelectItem value="quarterly">كل 3 شهور</SelectItem>
                <SelectItem value="biannual">كل 6 شهور</SelectItem>
                <SelectItem value="yearly">سنوي</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>تاريخ أول قسط</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1.5 flex-1 min-w-[240px]">
            <Label>وصف عام (اختياري)</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="مثل: عقد بيع وحدة رقم 12" />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={regen}>
              <RefreshCw className="ms-2 h-4 w-4" /> توليد تلقائي
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="ms-2 h-4 w-4" /> إضافة قسط
            </Button>
          </div>
        </div>

        <div className="max-h-[45vh] overflow-auto rounded border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b bg-muted/70">
              <tr className="text-right">
                <th className="p-2 w-10">#</th>
                <th className="p-2">النوع</th>
                <th className="p-2">الوصف</th>
                <th className="p-2 w-40">المبلغ</th>
                <th className="p-2 w-44">تاريخ الاستحقاق</th>
                <th className="p-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-b">
                  <td className="p-2 text-muted-foreground">{i + 1}</td>
                  <td className="p-2">
                    <Select value={r.isDownPayment ? "down" : "inst"} onValueChange={(v) => updateRow(r.id, { isDownPayment: v === "down" })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inst">قسط</SelectItem>
                        <SelectItem value="down">مقدم</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Input className="h-8" value={r.description} onChange={(e) => updateRow(r.id, { description: e.target.value })} />
                  </td>
                  <td className="p-2">
                    <Input className="h-8" type="number" step="0.01" value={r.amount} onChange={(e) => updateRow(r.id, { amount: Number(e.target.value) })} />
                  </td>
                  <td className="p-2">
                    <Input className="h-8" type="date" value={r.dueDate} onChange={(e) => updateRow(r.id, { dueDate: e.target.value })} />
                  </td>
                  <td className="p-2">
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد أقساط — اضغط "توليد تلقائي" أو "إضافة قسط"</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="text-muted-foreground">
            عدد الصفوف: <strong>{rows.length}</strong>
          </div>
          <div className="flex gap-4">
            <span>مجموع الصفوف: <strong>{sumRows.toLocaleString()}</strong></span>
            <span className={diff === 0 ? "text-emerald-600" : "text-amber-600"}>
              {diff === 0 ? "مطابق للإجمالي" : `الفرق: ${diff.toLocaleString()}`}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button type="button" onClick={() => save.mutate()} disabled={save.isPending || !residentId || rows.length === 0}>
            {save.isPending ? "جاري الحفظ…" : "حفظ الجدول"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
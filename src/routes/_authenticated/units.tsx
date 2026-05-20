import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/contexts/project-context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil } from "lucide-react";

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const NUMBERS = Array.from({ length: 99 }, (_, i) => String(i + 1).padStart(2, "0"));

function splitUnit(v: string | undefined | null): { letter: string; number: string } {
  const m = String(v ?? "").match(/^\s*([A-Za-z])\s*(\d{1,3})\s*$/);
  return { letter: m?.[1]?.toUpperCase() ?? "A", number: m?.[2]?.padStart(2, "0") ?? "01" };
}

type Unit = {
  id: string;
  project_id: string;
  unit_number: string;
  floor: string | null;
  area: number | null;
  price: number | null;
  status: string;
  notes: string | null;
};

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  available: { label: "متاحة", variant: "secondary" },
  reserved: { label: "محجوزة", variant: "outline" },
  sold: { label: "مباعة", variant: "default" },
};

export const Route = createFileRoute("/_authenticated/units")({ component: UnitsPage });

function UnitsPage() {
  const qc = useQueryClient();
  const { projectId } = useProject();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [unitLetter, setUnitLetter] = useState("A");
  const [unitNumber, setUnitNumber] = useState("01");

  useEffect(() => {
    if (open) {
      const s = splitUnit(editing?.unit_number);
      setUnitLetter(s.letter);
      setUnitNumber(s.number);
    }
  }, [open, editing]);

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await supabase.from("projects").select("id,name_ar")).data ?? [],
  });

  const { data: units } = useQuery({
    queryKey: ["units", projectId],
    queryFn: async () => {
      let q = supabase.from("units").select("*, projects(name_ar)");
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      const collator = new Intl.Collator("ar", { numeric: true, sensitivity: "base" });
      return (data ?? []).slice().sort((a: any, b: any) =>
        collator.compare(String(a.unit_number ?? ""), String(b.unit_number ?? "")),
      );
    },
  });

  // Realtime auto-sync
  useEffect(() => {
    const ch = supabase
      .channel("units-rt")
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "units" },
        () => qc.invalidateQueries({ queryKey: ["units"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const upsert = useMutation({
    mutationFn: async (form: Partial<Unit> & { project_id: string; unit_number: string }) => {
      if (editing) {
        const { error } = await supabase.from("units").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("units").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["units"] });
      toast.success(editing ? "تم التحديث" : "تمت الإضافة");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      if (msg.includes("units_project_id_unit_number_key") || e?.code === "23505") {
        toast.error("رقم الوحدة موجود مسبقاً في هذا المشروع");
      } else {
        toast.error(msg || "حدث خطأ");
      }
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("units").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["units"] });
      toast.success("تم الحذف");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">الوحدات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            إدارة وحدات المشاريع — يتم التحديث تلقائياً مع الداتا بيز
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="ms-2 h-4 w-4" />
              وحدة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "تعديل وحدة" : "إضافة وحدة جديدة"}</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const project_id = String(fd.get("project") ?? "");
                if (!project_id) {
                  toast.error("اختر المشروع");
                  return;
                }
                const unit_number = `${unitLetter} ${unitNumber}`;
                const dup = (units ?? []).some(
                  (u: any) =>
                    u.project_id === project_id &&
                    String(u.unit_number) === unit_number &&
                    (!editing || u.id !== editing.id),
                );
                if (dup) {
                  toast.error("رقم الوحدة موجود مسبقاً في هذا المشروع");
                  return;
                }
                upsert.mutate({
                  project_id,
                  unit_number,
                  floor: (String(fd.get("floor") ?? "") || null) as string | null,
                  area: fd.get("area") ? Number(fd.get("area")) : null,
                  price: fd.get("price") ? Number(fd.get("price")) : null,
                  status: String(fd.get("status") ?? "available"),
                  notes: (String(fd.get("notes") ?? "") || null) as string | null,
                });
              }}
            >
              <div className="space-y-1.5">
                <Label>المشروع</Label>
                <Select name="project" defaultValue={editing?.project_id ?? projectId ?? undefined}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر مشروع" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects?.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name_ar}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>رقم الوحدة</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={unitLetter} onValueChange={setUnitLetter}>
                      <SelectTrigger><SelectValue placeholder="حرف" /></SelectTrigger>
                      <SelectContent className="max-h-64">
                        {LETTERS.map((l) => (
                          <SelectItem key={l} value={l}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={unitNumber} onValueChange={setUnitNumber}>
                      <SelectTrigger><SelectValue placeholder="رقم" /></SelectTrigger>
                      <SelectContent className="max-h-64">
                        {NUMBERS.map((n) => (
                          <SelectItem key={n} value={n}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">المعاينة: {unitLetter} {unitNumber}</p>
                </div>
                <div className="space-y-1.5">
                  <Label>الدور</Label>
                  <Input name="floor" defaultValue={editing?.floor ?? ""} />
                </div>
                <div className="space-y-1.5">
                  <Label>المساحة (م²)</Label>
                  <Input name="area" type="number" step="0.01" defaultValue={editing?.area ?? ""} />
                </div>
                <div className="space-y-1.5">
                  <Label>السعر</Label>
                  <Input name="price" type="number" step="0.01" defaultValue={editing?.price ?? ""} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>الحالة</Label>
                <Select name="status" defaultValue={editing?.status ?? "available"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">متاحة</SelectItem>
                    <SelectItem value="reserved">محجوزة</SelectItem>
                    <SelectItem value="sold">مباعة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>ملاحظات</Label>
                <Input name="notes" defaultValue={editing?.notes ?? ""} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={upsert.isPending}>
                  {upsert.isPending ? "جاري…" : "حفظ"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr className="text-right">
                <th className="p-3">رقم الوحدة</th>
                <th className="p-3">المشروع</th>
                <th className="p-3">الدور</th>
                <th className="p-3">المساحة</th>
                <th className="p-3">السعر</th>
                <th className="p-3">الحالة</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {units?.map((u: any) => {
                const s = STATUS[u.status] ?? { label: u.status, variant: "outline" as const };
                return (
                  <tr key={u.id} className="border-b">
                    <td className="p-3 font-mono">{u.unit_number}</td>
                    <td className="p-3 text-muted-foreground">{u.projects?.name_ar ?? "—"}</td>
                    <td className="p-3">{u.floor ?? "—"}</td>
                    <td className="p-3">{u.area ?? "—"}</td>
                    <td className="p-3">{u.price ?? "—"}</td>
                    <td className="p-3">
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </td>
                    <td className="p-3 text-left">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditing(u);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => confirm("حذف الوحدة؟") && remove.mutate(u.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!units?.length && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    لا توجد وحدات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
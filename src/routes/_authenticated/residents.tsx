import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createResident, deleteUser } from "@/lib/admin-users.functions";
import { useProject } from "@/contexts/project-context";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/residents")({ component: ResidentsPage });

function ResidentsPage() {
  const qc = useQueryClient();
  const { projectId } = useProject();
  const [open, setOpen] = useState(false);
  const createFn = useServerFn(createResident);
  const deleteFn = useServerFn(deleteUser);

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await supabase.from("projects").select("id,name_ar")).data ?? [],
  });

  const { data: residents } = useQuery({
    queryKey: ["residents", projectId],
    queryFn: async () => {
      let q = supabase.from("residents").select("*, projects(name_ar)").order("created_at", { ascending: false });
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: (form: Parameters<typeof createResident>[0]["data"]) => createFn({ data: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["residents"] });
      toast.success("تم إنشاء الساكن");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => deleteFn({ data: { userId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["residents"] });
      toast.success("تم الحذف");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">السكان</h1>
          <p className="mt-1 text-sm text-muted-foreground">إدارة سكان المشاريع</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="ms-2 h-4 w-4" />ساكن جديد</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>إضافة ساكن جديد</DialogTitle></DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                create.mutate({
                  unitNumber: String(fd.get("unit")),
                  name: String(fd.get("name")),
                  password: String(fd.get("password")),
                  phone: String(fd.get("phone") ?? "") || undefined,
                  projectId: (String(fd.get("project")) || null) as string | null,
                  unitPrice: fd.get("price") ? Number(fd.get("price")) : null,
                });
              }}
            >
              <div className="space-y-1.5"><Label>رقم الوحدة</Label><Input name="unit" required /></div>
              <div className="space-y-1.5"><Label>الاسم</Label><Input name="name" required /></div>
              <div className="space-y-1.5"><Label>الهاتف</Label><Input name="phone" /></div>
              <div className="space-y-1.5"><Label>سعر الوحدة</Label><Input name="price" type="number" step="0.01" /></div>
              <div className="space-y-1.5">
                <Label>المشروع</Label>
                <Select name="project">
                  <SelectTrigger><SelectValue placeholder="اختر مشروع" /></SelectTrigger>
                  <SelectContent>
                    {projects?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name_ar}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>كلمة المرور</Label><Input name="password" type="password" minLength={6} required /></div>
              <DialogFooter><Button type="submit" disabled={create.isPending}>{create.isPending ? "جاري…" : "حفظ"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr className="text-right">
              <th className="p-3">الوحدة</th><th className="p-3">الاسم</th>
              <th className="p-3">المشروع</th><th className="p-3">الهاتف</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {residents?.map((r: any) => (
              <tr key={r.id} className="border-b">
                <td className="p-3 font-mono">{r.unit_number}</td>
                <td className="p-3">{r.name}</td>
                <td className="p-3 text-muted-foreground">{r.projects?.name_ar ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{r.phone ?? "—"}</td>
                <td className="p-3 text-left">
                  {r.user_id && (
                    <Button size="icon" variant="ghost" onClick={() => confirm("حذف الساكن؟") && remove.mutate(r.user_id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {!residents?.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">لا يوجد سكان</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
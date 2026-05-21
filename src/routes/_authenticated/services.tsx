import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { upsertService, deleteService } from "@/lib/admin-users.functions";
import { useAuthSession, useUserRoles, hasAnyRole } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/services")({ component: ServicesPage });

type Service = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  icon: string;
  color: string;
  bg_color: string;
};

function ServicesPage() {
  const qc = useQueryClient();
  const { user } = useAuthSession();
  const { data: roles } = useUserRoles(user);
  const canManage = hasAnyRole(roles, ["admin", "manager"]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const upsertFn = useServerFn(upsertService);
  const deleteFn = useServerFn(deleteService);

  const { data } = useQuery({
    queryKey: ["services"],
    queryFn: async () =>
      ((await supabase.from("services").select("*").order("name_ar")).data ?? []) as Service[],
  });

  const upsert = useMutation({
    mutationFn: (vars: { id?: string; values: Omit<Service, "id"> }) => upsertFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      toast.success("تم الحفظ");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      toast.success("تم الحذف");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => { setEditing(null); setOpen(true); };
  const openEdit = (s: Service) => { setEditing(s); setOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">أنواع الخدمات</h1>
          <p className="mt-1 text-sm text-muted-foreground">تظهر هذه الخدمات للسكان عند إنشاء طلب صيانة</p>
        </div>
        {canManage && (
          <Button onClick={openCreate}><Plus className="ms-2 h-4 w-4" />خدمة جديدة</Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg" style={{ background: s.bg_color, color: s.color }} />
                <div>
                  <p className="font-semibold">{s.name_ar}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">{s.name_en}</p>
                </div>
              </div>
              {canManage && (
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm("حذف الخدمة؟") && remove.mutate(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {!data?.length && (
          <p className="col-span-full py-12 text-center text-muted-foreground">لا توجد خدمات بعد</p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل خدمة" : "خدمة جديدة"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              upsert.mutate({
                id: editing?.id,
                values: {
                  slug: String(fd.get("slug")).trim().toLowerCase(),
                  name_ar: String(fd.get("name_ar")).trim(),
                  name_en: String(fd.get("name_en")).trim(),
                  icon: String(fd.get("icon") || "wrench").trim(),
                  color: String(fd.get("color") || "#6b7280"),
                  bg_color: String(fd.get("bg_color") || "#f3f4f6"),
                },
              });
            }}
          >
            <div className="space-y-1.5"><Label>الاسم بالعربية</Label><Input name="name_ar" defaultValue={editing?.name_ar ?? ""} required /></div>
            <div className="space-y-1.5"><Label>Name (English)</Label><Input name="name_en" defaultValue={editing?.name_en ?? ""} required dir="ltr" /></div>
            <div className="space-y-1.5"><Label>المعرّف (slug)</Label><Input name="slug" defaultValue={editing?.slug ?? ""} required dir="ltr" placeholder="plumbing" pattern="[a-z0-9_\-]+" /></div>
            <div className="space-y-1.5"><Label>الأيقونة (lucide name)</Label><Input name="icon" defaultValue={editing?.icon ?? "wrench"} dir="ltr" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>لون الأيقونة</Label><Input name="color" type="color" defaultValue={editing?.color ?? "#6b7280"} /></div>
              <div className="space-y-1.5"><Label>لون الخلفية</Label><Input name="bg_color" type="color" defaultValue={editing?.bg_color ?? "#f3f4f6"} /></div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={upsert.isPending}>{upsert.isPending ? "جاري…" : "حفظ"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
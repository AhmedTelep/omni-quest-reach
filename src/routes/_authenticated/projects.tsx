import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects")({ component: ProjectsPage });

type Project = {
  id: string;
  name_ar: string;
  name_en: string;
  description: string | null;
  color: string;
  total_units: number;
};

function ProjectsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Project | null>(null);
  const [open, setOpen] = useState(false);

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (form: {
      name_ar: string;
      name_en: string;
      description: string | null;
      color: string;
      total_units: number;
    }) => {
      if (editing) {
        const { error } = await supabase.from("projects").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("projects").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success(editing ? "تم التعديل" : "تم الإنشاء");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("تم الحذف");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">المشاريع</h1>
          <p className="mt-1 text-sm text-muted-foreground">إدارة المشاريع السكنية</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="ms-2 h-4 w-4" />
              مشروع جديد
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "تعديل مشروع" : "مشروع جديد"}</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                upsert.mutate({
                  name_ar: String(fd.get("name_ar")),
                  name_en: String(fd.get("name_en")),
                  description: String(fd.get("description") ?? "") || null,
                  color: String(fd.get("color")) || "#1d4ed8",
                  total_units: Number(fd.get("total_units") || 0),
                });
              }}
            >
              <div className="space-y-2">
                <Label>الاسم بالعربي</Label>
                <Input name="name_ar" required defaultValue={editing?.name_ar} />
              </div>
              <div className="space-y-2">
                <Label>Name (English)</Label>
                <Input name="name_en" required defaultValue={editing?.name_en} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>الوصف</Label>
                <Textarea name="description" defaultValue={editing?.description ?? ""} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>عدد الوحدات</Label>
                  <Input name="total_units" type="number" min={0} defaultValue={editing?.total_units ?? 0} />
                </div>
                <div className="space-y-2">
                  <Label>اللون</Label>
                  <Input name="color" type="color" defaultValue={editing?.color ?? "#1d4ed8"} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={upsert.isPending}>
                  {upsert.isPending ? "جاري الحفظ…" : "حفظ"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects?.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full" style={{ background: p.color }} />
                  <div>
                    <CardTitle className="text-base">{p.name_ar}</CardTitle>
                    <CardDescription className="text-xs" dir="ltr">{p.name_en}</CardDescription>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`حذف مشروع "${p.name_ar}"؟`)) del.mutate(p.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
              <p className="mt-2 text-xs text-muted-foreground">عدد الوحدات: {p.total_units}</p>
            </CardContent>
          </Card>
        ))}
        {!projects?.length && (
          <p className="col-span-full py-12 text-center text-muted-foreground">لا توجد مشاريع بعد</p>
        )}
      </div>
    </div>
  );
}
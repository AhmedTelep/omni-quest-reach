import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { upsertProject, deleteProject } from "@/lib/admin-users.functions";
import { useEffect, useState } from "react";
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
import { Plus, Pencil, Trash2, Upload, X } from "lucide-react";
import { uploadFile, publicUrl } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/projects")({ component: ProjectsPage });

type Space = { name: string; area: number | null; notes?: string | null };
type Project = {
  id: string;
  name_ar: string;
  name_en: string;
  description: string | null;
  color: string;
  total_units: number;
  images: string[];
  spaces: Space[];
};

function ProjectsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Project | null>(null);
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [uploading, setUploading] = useState(false);
  const upsertFn = useServerFn(upsertProject);
  const deleteFn = useServerFn(deleteProject);

  useEffect(() => {
    if (open) {
      setImages(editing?.images ?? []);
      setSpaces(editing?.spaces ?? []);
    }
  }, [open, editing]);

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        ...p,
        images: (p.images ?? []) as string[],
        spaces: (Array.isArray(p.spaces) ? p.spaces : []) as Space[],
      })) as Project[];
    },
  });

  const upsert = useMutation({
    mutationFn: (form: {
      name_ar: string;
      name_en: string;
      description: string | null;
      color: string;
      total_units: number;
      images: string[];
      spaces: Space[];
    }) => upsertFn({ data: { id: editing?.id, values: form } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success(editing ? "تم التعديل" : "تم الإنشاء");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("تم الحذف");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) {
        const path = await uploadFile("project-images", f, "projects");
        urls.push(publicUrl("project-images", path));
      }
      setImages((prev) => [...prev, ...urls]);
    } catch (e: any) {
      toast.error(e?.message ?? "فشل رفع الصور");
    } finally {
      setUploading(false);
    }
  }

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
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
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
                  images,
                  spaces: spaces.filter((s) => s.name.trim()),
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

              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <Label>صور المشروع</Label>
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-muted">
                    <Upload className="h-3.5 w-3.5" />
                    {uploading ? "جاري الرفع…" : "رفع صور"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => onPickFiles(e.target.files)}
                    />
                  </label>
                </div>
                {images.length === 0 ? (
                  <p className="text-xs text-muted-foreground">لا توجد صور بعد</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {images.map((u, i) => (
                      <div key={u + i} className="group relative aspect-square overflow-hidden rounded-md border">
                        <img src={u} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setImages((p) => p.filter((_, idx) => idx !== i))}
                          className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 transition group-hover:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <Label>مساحات / مرافق المشروع</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSpaces((p) => [...p, { name: "", area: null, notes: "" }])}
                  >
                    <Plus className="ms-1 h-3.5 w-3.5" />
                    إضافة مساحة
                  </Button>
                </div>
                {spaces.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    مثال: مسبح، حديقة، نادي، جراج، مصعد…
                  </p>
                ) : (
                  <div className="space-y-2">
                    {spaces.map((s, i) => (
                      <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2">
                        <Input
                          placeholder="الاسم (مسبح، حديقة…)"
                          value={s.name}
                          onChange={(e) =>
                            setSpaces((p) => p.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))
                          }
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="المساحة م²"
                          value={s.area ?? ""}
                          onChange={(e) =>
                            setSpaces((p) =>
                              p.map((x, idx) =>
                                idx === i ? { ...x, area: e.target.value === "" ? null : Number(e.target.value) } : x,
                              ),
                            )
                          }
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => setSpaces((p) => p.filter((_, idx) => idx !== i))}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
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
            {p.images?.length > 0 && (
              <div className="relative aspect-video w-full overflow-hidden rounded-t-lg bg-muted">
                <img src={p.images[0]} alt={p.name_ar} className="h-full w-full object-cover" />
                {p.images.length > 1 && (
                  <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
                    +{p.images.length - 1}
                  </span>
                )}
              </div>
            )}
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
              {p.spaces?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.spaces.map((s, i) => (
                    <span
                      key={i}
                      className="rounded-full border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {s.name}
                      {s.area ? ` · ${s.area} م²` : ""}
                    </span>
                  ))}
                </div>
              )}
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
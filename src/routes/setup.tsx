import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapFirstAdmin } from "@/lib/admin-users.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/setup")({ component: SetupPage });

function SetupPage() {
  const navigate = useNavigate();
  const bootstrap = useServerFn(bootstrapFirstAdmin);

  // Block setup if any admin already exists
  const { data: alreadySetup, isLoading } = useQuery({
    queryKey: ["bootstrap-check"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");
      if (error) return false;
      return (count ?? 0) > 0;
    },
  });

  const [form, setForm] = useState({ email: "", password: "", fullName: "" });

  const mutation = useMutation({
    mutationFn: () => bootstrap({ data: form }),
    onSuccess: async () => {
      toast.success("تم إنشاء حساب الأدمن. جاري تسجيل الدخول…");
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (error) {
        toast.error(error.message);
        navigate({ to: "/login" });
      } else {
        navigate({ to: "/dashboard" });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center">جاري التحميل…</div>;
  }

  if (alreadySetup) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>تم الإعداد مسبقاً</CardTitle>
            <CardDescription>يوجد حساب أدمن بالفعل في النظام.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/login" className="text-primary underline">
              اذهب إلى تسجيل الدخول
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>إعداد أول حساب أدمن</CardTitle>
          <CardDescription>هذه الصفحة تظهر مرة واحدة فقط. أنشئ حساب الأدمن الأول للنظام.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="name">الاسم الكامل</Label>
              <Input id="name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input id="password" type="password" minLength={8} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "جاري الإنشاء…" : "إنشاء حساب الأدمن"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
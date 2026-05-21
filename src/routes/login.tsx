import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    let email = String(fd.get("email")).trim();
    // Resident shortcut: allow "unit-A01" or just "A01" → unit-a01@resident.local
    if (!email.includes("@")) {
      const raw = email.toLowerCase().replace(/^unit-/, "");
      const slug = raw.replace(/[^a-z0-9]/g, "-");
      email = `unit-${slug}@resident.local`;
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: String(fd.get("password")),
    });
    if (error) {
      setLoading(false);
      toast.error("بيانات الدخول غير صحيحة");
      return;
    }
    // Determine redirect based on user role
    const userId = data.user?.id;
    let isStaff = false;
    if (userId) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const staffRoles = ["admin", "manager", "sales_manager", "sales", "accountant"];
      isStaff = (roles ?? []).some((r) => staffRoles.includes(r.role));
    }
    setLoading(false);
    toast.success("تم تسجيل الدخول");
    navigate({ to: isStaff ? "/dashboard" : "/my-requests" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">نظام إدارة الصيانة</CardTitle>
          <CardDescription>سجل دخولك للوصول إلى لوحة التحكم</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleLogin} dir="rtl">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني أو رقم الوحدة</Label>
              <Input id="email" name="email" type="text" required dir="ltr" placeholder="example@x.com  أو  unit-A01" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "جاري الدخول…" : "دخول"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
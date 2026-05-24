import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building } from "lucide-react";

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
    <div className="bg-dot-grid flex min-h-screen items-center justify-center bg-background p-4">
      <Card
        className="w-full max-w-md border-border/60"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <CardHeader className="text-center">
          <div className="mx-auto flex flex-col items-center gap-2">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{
                background: "var(--gradient-cyan-glow)",
                boxShadow: "var(--shadow-glow-cyan)",
                color: "var(--primary-foreground)",
              }}
            >
              <Building className="h-7 w-7" />
            </div>
            <CardTitle className="mt-2 text-2xl font-extrabold tracking-wide">X REAL ESTATE</CardTitle>
            <CardDescription>سجل دخولك للوصول إلى لوحة التحكم</CardDescription>
          </div>
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
            <Button
              type="submit"
              className="w-full font-semibold"
              disabled={loading}
              style={{
                background: "var(--gradient-cyan-glow)",
                color: "var(--primary-foreground)",
                boxShadow: "var(--shadow-glow-cyan)",
              }}
            >
              {loading ? "جاري الدخول…" : "دخول"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
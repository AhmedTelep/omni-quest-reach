import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleStaffLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    setLoading(false);
    if (error) {
      toast.error("بيانات الدخول غير صحيحة");
      return;
    }
    toast.success("تم تسجيل الدخول");
    navigate({ to: "/dashboard" });
  };

  const handleResidentLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const unit = String(fd.get("unit")).toLowerCase().replace(/[^a-z0-9]/g, "-");
    const email = `unit-${unit}@resident.local`;
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: String(fd.get("password")),
    });
    setLoading(false);
    if (error) {
      toast.error("رقم الوحدة أو كلمة المرور غير صحيحة");
      return;
    }
    toast.success("مرحباً بك");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">نظام إدارة الصيانة</CardTitle>
          <CardDescription>سجل دخولك للوصول إلى لوحة التحكم</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="staff" className="w-full" dir="rtl">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="staff">موظف / إدارة</TabsTrigger>
              <TabsTrigger value="resident">ساكن</TabsTrigger>
            </TabsList>

            <TabsContent value="staff">
              <form className="space-y-4 pt-4" onSubmit={handleStaffLogin}>
                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input id="email" name="email" type="email" required dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">كلمة المرور</Label>
                  <Input id="password" name="password" type="password" required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "جاري الدخول…" : "دخول"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="resident">
              <form className="space-y-4 pt-4" onSubmit={handleResidentLogin}>
                <div className="space-y-2">
                  <Label htmlFor="unit">رقم الوحدة</Label>
                  <Input id="unit" name="unit" required placeholder="مثال: BL-U823" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rpassword">كلمة المرور</Label>
                  <Input id="rpassword" name="password" type="password" required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "جاري الدخول…" : "دخول"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            أول مرة تستخدم النظام؟{" "}
            <Link to="/setup" className="text-primary underline">
              إنشاء أول حساب أدمن
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createEmployee, deleteUser } from "@/lib/admin-users.functions";
import { useAuthSession, useUserRoles } from "@/hooks/use-auth";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/employees")({ component: EmployeesPage });

const ROLE_LABEL: Record<string, string> = {
  admin: "أدمن",
  manager: "مدير",
  sales_manager: "مدير مبيعات",
  sales: "مبيعات",
  accountant: "محاسب",
};

function EmployeesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const createFn = useServerFn(createEmployee);
  const deleteFn = useServerFn(deleteUser);
  const { user } = useAuthSession();
  const { data: callerRoles } = useUserRoles(user);
  const callerIsAdmin = !!callerRoles?.includes("admin");
  // Only admin sees the "admin" role option; manager does not.
  const roleOptions = Object.entries(ROLE_LABEL).filter(([v]) =>
    callerIsAdmin ? true : v !== "admin",
  );

  const { data: employees } = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => {
      const { data: emps } = await supabase.from("employees").select("*").order("created_at", { ascending: false });
      if (!emps?.length) return [];
      const ids = emps.map((e) => e.user_id);
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", ids);
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, phone").in("id", ids);
      return emps.map((e) => ({
        ...e,
        role: roles?.find((r) => r.user_id === e.user_id)?.role,
        profile: profiles?.find((p) => p.id === e.user_id),
      }));
    },
  });

  const create = useMutation({
    mutationFn: (form: { email: string; password: string; name: string; role: "admin"|"manager"|"sales_manager"|"sales"|"accountant"; phone?: string }) =>
      createFn({ data: form }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees-list"] }); toast.success("تم إنشاء الموظف"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => deleteFn({ data: { userId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees-list"] }); toast.success("تم الحذف"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">الموظفين</h1>
          <p className="mt-1 text-sm text-muted-foreground">إدارة حسابات الموظفين والصلاحيات</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="ms-2 h-4 w-4" />موظف جديد</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>إضافة موظف</DialogTitle></DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                create.mutate({
                  email: String(fd.get("email")),
                  password: String(fd.get("password")),
                  name: String(fd.get("name")),
                  role: String(fd.get("role")) as any,
                  phone: String(fd.get("phone") ?? "") || undefined,
                });
              }}
            >
              <div className="space-y-1.5"><Label>الاسم</Label><Input name="name" required /></div>
              <div className="space-y-1.5"><Label>البريد</Label><Input name="email" type="email" dir="ltr" required /></div>
              <div className="space-y-1.5"><Label>الهاتف</Label><Input name="phone" /></div>
              <div className="space-y-1.5">
                <Label>الدور</Label>
                <Select name="role" defaultValue="sales">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roleOptions.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
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
              <th className="p-3">الاسم</th><th className="p-3">الدور</th>
              <th className="p-3">الهاتف</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {employees?.map((e: any) => (
              <tr key={e.id} className="border-b">
                <td className="p-3">{e.name}</td>
                <td className="p-3">{ROLE_LABEL[e.role] ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{e.profile?.phone ?? "—"}</td>
                <td className="p-3 text-left">
                  {(callerIsAdmin || e.role !== "admin") && (
                    <Button size="icon" variant="ghost" onClick={() => confirm("حذف الموظف؟") && remove.mutate(e.user_id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {!employees?.length && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">لا يوجد موظفين</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
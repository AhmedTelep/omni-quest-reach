import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession, useUserRoles, type AppRole } from "@/hooks/use-auth";
import { useProject } from "@/contexts/project-context";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Building2,
  Users,
  Wrench,
  Settings as SettingsIcon,
  Receipt,
  UserCog,
  LogOut,
  Menu,
  ClipboardList,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { toast } from "sonner";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; roles: AppRole[] };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "الرئيسية", icon: LayoutDashboard, roles: ["admin", "manager", "sales_manager", "sales", "accountant"] },
  { to: "/projects", label: "المشاريع", icon: Building2, roles: ["admin", "manager"] },
  { to: "/residents", label: "السكان", icon: Users, roles: ["admin", "manager", "sales_manager", "sales"] },
  { to: "/requests", label: "طلبات الصيانة", icon: Wrench, roles: ["admin", "manager", "sales_manager", "sales", "accountant"] },
  { to: "/installments", label: "الأقساط", icon: Receipt, roles: ["admin", "manager", "sales_manager", "accountant"] },
  { to: "/services", label: "أنواع الخدمات", icon: SettingsIcon, roles: ["admin", "manager"] },
  { to: "/employees", label: "الموظفين", icon: UserCog, roles: ["admin", "manager"] },
  { to: "/my-requests", label: "طلباتي", icon: ClipboardList, roles: ["resident"] },
  { to: "/my-installments", label: "أقساطي", icon: Wallet, roles: ["resident"] },
];

export function AppShell() {
  const { user } = useAuthSession();
  const { data: roles } = useUserRoles(user);
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { projectId, setProjectId } = useProject();
  const [open, setOpen] = useState(false);

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("name_ar");
      if (error) throw error;
      return data ?? [];
    },
  });

  const visibleNav = NAV.filter((n) => roles?.some((r) => n.roles.includes(r)));

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("تم تسجيل الخروج");
    navigate({ to: "/login" });
  };

  const SidebarBody = (
    <div className="flex h-full flex-col">
      <div className="border-b p-4">
        <h1 className="text-lg font-bold">نظام الصيانة</h1>
        <p className="mt-1 truncate text-xs text-muted-foreground">{user?.email}</p>
      </div>

      <div className="border-b p-3">
        <label className="mb-1 block text-xs text-muted-foreground">المشروع الحالي</label>
        <Select
          value={projectId ?? "all"}
          onValueChange={(v) => setProjectId(v === "all" ? null : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="اختر مشروع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع المشاريع</SelectItem>
            {projects.data?.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name_ar}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <nav className="flex-1 space-y-1 overflow-auto p-2">
        {visibleNav.map((n) => {
          const active = path === n.to || path.startsWith(n.to + "/");
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{n.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <Button variant="outline" className="w-full justify-start gap-2" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-l bg-card lg:block">{SidebarBody}</aside>

      <div className="flex flex-1 flex-col">
        {/* Top bar (mobile) */}
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              {SidebarBody}
            </SheetContent>
          </Sheet>
          <h1 className="text-base font-semibold">نظام الصيانة</h1>
          <div className="w-9" />
        </header>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
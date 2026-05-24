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
  Home,
  Bell,
  Megaphone,
  Search,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; roles: AppRole[] };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "الرئيسية", icon: LayoutDashboard, roles: ["admin", "manager", "sales_manager", "sales", "accountant", "resident"] },
  { to: "/projects", label: "المشاريع", icon: Building2, roles: ["admin", "manager", "sales_manager"] },
  { to: "/units", label: "الوحدات", icon: Home, roles: ["admin", "manager", "sales_manager", "sales"] },
  { to: "/residents", label: "السكان", icon: Users, roles: ["admin", "manager", "sales_manager", "sales"] },
  { to: "/requests", label: "طلبات الصيانة", icon: Wrench, roles: ["admin", "manager", "sales_manager", "sales"] },
  { to: "/installments", label: "الأقساط", icon: Receipt, roles: ["admin", "manager", "sales_manager", "accountant"] },
  { to: "/services", label: "أنواع الخدمات", icon: SettingsIcon, roles: ["admin", "manager"] },
  { to: "/employees", label: "الموظفين", icon: UserCog, roles: ["admin", "manager"] },
  { to: "/announcements", label: "الإعلانات", icon: Megaphone, roles: ["admin", "manager"] },
  { to: "/notifications", label: "الإشعارات", icon: Bell, roles: ["admin", "manager", "sales_manager", "sales", "accountant", "resident"] },
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
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex flex-col items-center gap-2 border-b border-sidebar-border px-4 py-5">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{
            background: "var(--gradient-cyan-glow)",
            boxShadow: "var(--shadow-glow-cyan)",
            color: "var(--sidebar-primary-foreground)",
          }}
        >
          <Building className="h-6 w-6" />
        </div>
        <div className="text-center">
          <h1 className="text-base font-extrabold tracking-wide">X REAL ESTATE</h1>
          <p className="mt-0.5 text-[10px] text-sidebar-primary">للعقارات الذكية</p>
        </div>
      </div>

      {/* User card */}
      <div className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
            style={{
              background: "var(--gradient-cyan-glow)",
              color: "var(--sidebar-primary-foreground)",
            }}
          >
            {(user?.email?.[0] ?? "U").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 text-end">
            <p className="truncate text-sm font-medium">{user?.email?.split("@")[0] ?? "—"}</p>
            <p className="truncate text-[11px] opacity-70">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Project selector */}
      <div className="border-b border-sidebar-border px-4 py-3">
        <label className="mb-1.5 block text-[11px] text-sidebar-primary">المشروع الحالي</label>
        <Select
          value={projectId ?? "all"}
          onValueChange={(v) => setProjectId(v === "all" ? null : v)}
        >
          <SelectTrigger className="border-sidebar-border bg-sidebar-accent text-sidebar-foreground">
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

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-auto px-3 py-3">
        {visibleNav.map((n) => {
          const active = path === n.to || path.startsWith(n.to + "/");
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
              style={
                active
                  ? {
                      background: "var(--gradient-cyan-glow)",
                      boxShadow: "var(--shadow-glow-cyan)",
                    }
                  : undefined
              }
            >
              <span>{n.label}</span>
              <Icon className="h-4 w-4 opacity-90" />
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.01]"
          style={{
            background: "var(--gradient-cyan-glow)",
            color: "var(--sidebar-primary-foreground)",
            boxShadow: "var(--shadow-glow-cyan)",
          }}
        >
          تسجيل الخروج
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-72 shrink-0 lg:block">{SidebarBody}</aside>

      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 border-0 bg-sidebar p-0">
                {SidebarBody}
              </SheetContent>
            </Sheet>
            <ThemeToggle />
          </div>

          <div className="mx-auto w-full max-w-xl">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="البحث"
                className="h-10 rounded-full border-border/60 bg-muted/40 pr-10 text-sm shadow-none focus-visible:ring-primary/40"
              />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <NotificationBell />
          </div>
        </header>

        <main className="bg-dot-grid flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
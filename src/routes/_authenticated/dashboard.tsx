import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/contexts/project-context";
import { useAuthSession, useUserRoles } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Wrench, Receipt, Home, Wallet, Cloud, MapPin, ImageIcon } from "lucide-react";
import { StatCard } from "@/components/stat-card";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { projectId } = useProject();
  const { user } = useAuthSession();
  const { data: roles } = useUserRoles(user);
  const isResident = !!roles?.length && roles.every((r) => r === "resident");
  const isAccountantOnly = !!roles?.length && roles.every((r) => r === "accountant");

  const stats = useQuery({
    queryKey: ["dashboard-stats", projectId],
    enabled: !isResident && !isAccountantOnly,
    queryFn: async () => {
      const projectsQ = supabase.from("projects").select("*", { count: "exact", head: true });
      let residentsQ = supabase.from("residents").select("*", { count: "exact", head: true });
      let requestsOpen = supabase
        .from("maintenance_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "open");
      let installmentsPending = supabase
        .from("installments")
        .select("*", { count: "exact", head: true })
        .eq("payment_status", "pending_confirmation");

      if (projectId) {
        residentsQ = residentsQ.eq("project_id", projectId);
        requestsOpen = requestsOpen.eq("project_id", projectId);
        installmentsPending = installmentsPending.eq("project_id", projectId);
      }

      const [projects, residents, openReqs, pendingInst] = await Promise.all([
        projectsQ,
        residentsQ,
        requestsOpen,
        installmentsPending,
      ]);

      return {
        projects: projects.count ?? 0,
        residents: residents.count ?? 0,
        openRequests: openReqs.count ?? 0,
        pendingInstallments: pendingInst.count ?? 0,
      };
    },
  });

  if (isResident) {
    return <ResidentDashboard />;
  }

  if (isAccountantOnly) {
    return <AccountantDashboard projectId={projectId} />;
  }

  return (
    <div className="space-y-8">
      <div className="text-end">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">لوحة التحكم</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          نظرة عامة على بيانات النظام {projectId ? "للمشروع المختار" : "لكل المشاريع"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <StatCard title="المشاريع" value={stats.data?.projects ?? 0} icon={Building2} variant="blue" />
        <StatCard title="السكان" value={stats.data?.residents ?? 0} icon={Users} variant="green" />
        <StatCard title="طلبات صيانة مفتوحة" value={stats.data?.openRequests ?? 0} icon={Wrench} variant="orange" />
        <StatCard title="أقساط بانتظار التأكيد" value={stats.data?.pendingInstallments ?? 0} icon={Receipt} variant="purple" />
      </div>
    </div>
  );
}

// ============================================================
// Accountant dashboard — installments-focused summary
// ============================================================
function AccountantDashboard({ projectId }: { projectId: string | null }) {
  const { data } = useQuery({
    queryKey: ["accountant-stats", projectId],
    queryFn: async () => {
      const base = () => {
        let q = supabase.from("installments").select("amount, payment_status, project_id");
        if (projectId) q = q.eq("project_id", projectId);
        return q;
      };
      const { data, error } = await base();
      if (error) throw error;
      const rows = data ?? [];
      const sumBy = (s: string) =>
        rows.filter((r) => r.payment_status === s).reduce((a, r) => a + Number(r.amount || 0), 0);
      return {
        pending: rows.filter((r) => r.payment_status === "pending_confirmation").length,
        confirmedTotal: sumBy("confirmed"),
        pendingTotal: sumBy("pending_confirmation"),
        rejectedCount: rows.filter((r) => r.payment_status === "rejected").length,
      };
    },
  });

  const cards = [
    { label: "أقساط بانتظار التأكيد", value: data?.pending ?? 0, icon: Receipt, color: "text-amber-600" },
    { label: "إجمالي المؤكد (ج.م)", value: (data?.confirmedTotal ?? 0).toLocaleString(), icon: Wallet, color: "text-emerald-600" },
    { label: "إجمالي بانتظار التأكيد (ج.م)", value: (data?.pendingTotal ?? 0).toLocaleString(), icon: Wallet, color: "text-amber-600" },
    { label: "أقساط مرفوضة", value: data?.rejectedCount ?? 0, icon: Receipt, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">لوحة المحاسب</h1>
        <p className="mt-1 text-sm text-muted-foreground">ملخص حركة الأقساط</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((it) => (
          <Card key={it.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{it.label}</CardTitle>
              <it.icon className={`h-5 w-5 ${it.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{it.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-4">
          <Link to="/installments" className="text-sm text-primary underline">
            الانتقال إلى صفحة تأكيد الأقساط ←
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Resident dashboard
// ============================================================
function ResidentDashboard() {
  // Resident profile + linked project
  const { data: resident } = useQuery({
    queryKey: ["my-resident-full"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: r } = await supabase
        .from("residents")
        .select("id, name, unit_number, unit_price, project_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!r) return null;
      let project: any = null;
      if (r.project_id) {
        const { data: p } = await supabase
          .from("projects")
          .select("name_ar, images, spaces, city, latitude, longitude")
          .eq("id", r.project_id)
          .maybeSingle();
        project = p;
      }
      return { ...r, project };
    },
  });

  const { data: installments } = useQuery({
    queryKey: ["my-installments-summary", resident?.id],
    enabled: !!resident?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("installments")
        .select("amount, payment_status, due_date, description")
        .eq("resident_id", resident!.id)
        .order("due_date", { ascending: true });
      return data ?? [];
    },
  });

  const { data: requests } = useQuery({
    queryKey: ["my-requests-summary", resident?.id],
    enabled: !!resident?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("maintenance_requests")
        .select("id, service_type, status, created_at")
        .eq("resident_id", resident!.id)
        .order("created_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const paid = (installments ?? [])
    .filter((i) => i.payment_status === "confirmed")
    .reduce((a, i) => a + Number(i.amount || 0), 0);
  const totalPrice = Number(resident?.unit_price ?? 0);
  const remaining = Math.max(totalPrice - paid, 0);
  const progress = totalPrice > 0 ? Math.min((paid / totalPrice) * 100, 100) : 0;

  const upcomingUnpaid = (installments ?? [])
    .filter((i) => i.payment_status !== "confirmed")
    .slice(0, 2);

  if (!resident) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">مرحباً بك</h1>
        <p className="text-sm text-muted-foreground">
          لم يتم ربط حسابك بأي وحدة بعد. تواصل مع الإدارة.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">مرحباً، {resident.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          وحدتك في مشروع {resident.project?.name_ar ?? "—"}
        </p>
      </div>

      {/* Top row: unit info + finance + weather */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">بيانات وحدتك</CardTitle>
            <Home className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold">وحدة {resident.unit_number}</div>
            <p className="text-xs text-muted-foreground">
              {resident.project?.name_ar ?? "بدون مشروع"}
            </p>
            {totalPrice > 0 && (
              <p className="text-xs text-muted-foreground">
                السعر: {totalPrice.toLocaleString()} ج.م
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">الملخص المالي</CardTitle>
            <Wallet className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">المدفوع</span>
              <span className="font-semibold text-emerald-600">{paid.toLocaleString()} ج.م</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">المتبقي</span>
              <span className="font-semibold">{remaining.toLocaleString()} ج.م</span>
            </div>
            {totalPrice > 0 && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <WeatherCard
          city={resident.project?.city ?? null}
          lat={resident.project?.latitude ?? null}
          lng={resident.project?.longitude ?? null}
        />
      </div>

      {/* Project images */}
      {(resident.project?.images?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="h-4 w-4" /> صور المشروع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {resident.project.images.map((u: string, i: number) => (
                <div key={u + i} className="aspect-square overflow-hidden rounded-md border">
                  <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Project amenities/spaces */}
      {(resident.project?.spaces?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">مرافق المشروع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {resident.project.spaces.map((s: { name: string; area?: number | string }, i: number) => (
                <span key={i} className="rounded-full border bg-muted/50 px-3 py-1 text-sm">
                  {s.name}{s.area ? ` · ${s.area} م²` : ""}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Maintenance + installments quick lists */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4" /> آخر طلبات الصيانة
            </CardTitle>
            <Link to="/my-requests" className="text-xs text-primary underline">عرض الكل</Link>
          </CardHeader>
          <CardContent>
            {requests?.length ? (
              <ul className="space-y-2">
                {requests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <span className="text-sm">{r.service_type}</span>
                    <Badge variant={r.status === "completed" ? "default" : r.status === "in_progress" ? "secondary" : "outline"}>
                      {r.status === "completed" ? "منتهي" : r.status === "in_progress" ? "قيد التنفيذ" : "جديد"}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">لا توجد طلبات صيانة</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4" /> الأقساط القادمة
            </CardTitle>
            <Link to="/my-installments" className="text-xs text-primary underline">عرض الكل</Link>
          </CardHeader>
          <CardContent>
            {upcomingUnpaid.length ? (
              <ul className="space-y-2">
                {upcomingUnpaid.map((i, idx) => (
                  <li key={idx} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{Number(i.amount).toLocaleString()} ج.م</p>
                      <p className="text-xs text-muted-foreground">
                        {i.due_date ? new Date(i.due_date).toLocaleDateString("ar-EG") : "بدون تاريخ"}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {i.payment_status === "pending_confirmation" ? "بانتظار التأكيد" : i.payment_status === "rejected" ? "مرفوض" : "مستحق"}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">لا توجد أقساط مستحقة</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// Weather card — uses Open-Meteo (no API key required)
// ============================================================
const WEATHER_CODE_AR: Record<number, string> = {
  0: "صافي", 1: "صافي غالباً", 2: "غائم جزئياً", 3: "غائم",
  45: "ضباب", 48: "ضباب كثيف",
  51: "رذاذ خفيف", 53: "رذاذ", 55: "رذاذ كثيف",
  61: "مطر خفيف", 63: "مطر", 65: "مطر غزير",
  71: "ثلج خفيف", 73: "ثلج", 75: "ثلج كثيف",
  80: "زخات مطر", 81: "زخات مطر", 82: "زخات مطر غزيرة",
  95: "عاصفة رعدية", 96: "عاصفة مع برد", 99: "عاصفة شديدة",
};

function WeatherCard({ city, lat, lng }: { city: string | null; lat: number | null; lng: number | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ["weather", lat, lng],
    enabled: lat != null && lng != null,
    staleTime: 1000 * 60 * 15,
    queryFn: async () => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("weather fetch failed");
      const j = await res.json();
      return {
        temp: j?.current?.temperature_2m as number | undefined,
        code: j?.current?.weather_code as number | undefined,
      };
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">الطقس الآن</CardTitle>
        <Cloud className="h-5 w-5 text-sky-600" />
      </CardHeader>
      <CardContent>
        {lat == null || lng == null ? (
          <p className="text-sm text-muted-foreground">
            لم تتم إضافة موقع للمشروع بعد.
          </p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">جاري التحميل…</p>
        ) : data?.temp != null ? (
          <div className="space-y-1">
            <div className="text-3xl font-bold">{Math.round(data.temp)}°C</div>
            <p className="text-sm text-muted-foreground">
              {data.code != null ? (WEATHER_CODE_AR[data.code] ?? "—") : "—"}
            </p>
            {city && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {city}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">تعذر جلب الطقس</p>
        )}
      </CardContent>
    </Card>
  );
}

type Space = { name: string; area: number | null };
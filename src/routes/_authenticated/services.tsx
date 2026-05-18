import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/services")({ component: ServicesPage });

function ServicesPage() {
  const { data } = useQuery({
    queryKey: ["services"],
    queryFn: async () => (await supabase.from("services").select("*").order("name_ar")).data ?? [],
  });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">أنواع الخدمات</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((s: any) => (
          <Card key={s.id}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="h-10 w-10 rounded-lg" style={{ background: s.bg_color, color: s.color }} />
              <div>
                <p className="font-semibold">{s.name_ar}</p>
                <p className="text-xs text-muted-foreground" dir="ltr">{s.name_en}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession, useUserRoles, hasAnyRole } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";
import { Megaphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/announcements")({ component: AnnouncementsPage });

const AUDIENCE_LABEL: Record<string, string> = {
  all: "الجميع",
  residents: "كل السكان",
  employees: "كل الموظفين",
  "role:admin": "المدراء العامون",
  "role:manager": "المدراء",
  "role:sales_manager": "مدراء المبيعات",
  "role:sales": "موظفي المبيعات",
  "role:accountant": "المحاسبين",
};

function AnnouncementsPage() {
  const { user } = useAuthSession();
  const { data: roles } = useUserRoles(user);
  const canManage = hasAnyRole(roles, ["admin", "manager"]);
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");

  const list = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("announcements" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("announcements" as any).insert({
        title, body, audience, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إرسال الإعلان");
      setTitle(""); setBody(""); setAudience("all");
      qc.invalidateQueries({ queryKey: ["announcements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الإعلانات</h1>
        <p className="mt-1 text-sm text-muted-foreground">إرسال إعلانات للسكان أو الموظفين</p>
      </div>

      {canManage && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5" /> إعلان جديد</CardTitle></CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!title || !body) { toast.error("املأ العنوان والنص"); return; }
                create.mutate();
              }}
            >
              <div className="space-y-1.5"><Label>العنوان</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
              <div className="space-y-1.5"><Label>النص</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} required /></div>
              <div className="space-y-1.5">
                <Label>الجمهور المستهدف</Label>
                <Select value={audience} onValueChange={setAudience}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(AUDIENCE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={create.isPending}>{create.isPending ? "جاري الإرسال…" : "إرسال الإعلان"}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">الإعلانات السابقة</h2>
        {list.data?.map((a: any) => (
          <Card key={a.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{a.title}</h3>
                    <Badge variant="outline">{AUDIENCE_LABEL[a.audience] ?? a.audience}</Badge>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString("ar-EG")}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
        {!list.data?.length && <p className="py-8 text-center text-muted-foreground">لا توجد إعلانات</p>}
      </div>
    </div>
  );
}

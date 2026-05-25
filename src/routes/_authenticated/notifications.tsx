import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useNotifications } from "@/hooks/use-notifications";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/notifications")({ component: NotificationsPage });

const TYPE_LABEL: Record<string, string> = {
  installment_new: "قسط جديد",
  installment_due_soon: "قسط قريب",
  installment_overdue: "قسط متأخر",
  installment_confirmed: "تأكيد قسط",
  installment_rejected: "رفض قسط",
  installment_pending_review: "إيصال للمراجعة",
  request_new: "طلب صيانة جديد",
  request_status_changed: "تحديث طلب",
  resident_added: "ساكن جديد",
  announcement: "إعلان",
};

function NotificationsPage() {
  const { items, markRead, markAllRead, unreadCount } = useNotifications();
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const list = filter === "unread" ? items.filter((n) => !n.is_read) : items;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الإشعارات</h1>
          <p className="mt-1 text-sm text-muted-foreground">آخر 50 إشعار</p>
        </div>
        {unreadCount > 0 && (
          <Button onClick={() => markAllRead.mutate()}>تعليم الكل كمقروء</Button>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>الكل</Button>
        <Button variant={filter === "unread" ? "default" : "outline"} size="sm" onClick={() => setFilter("unread")}>
          غير مقروء {unreadCount > 0 && `(${unreadCount})`}
        </Button>
      </div>

      <div className="space-y-2">
        {list.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">لا توجد إشعارات</p>
        ) : (
          list.map((n) => (
            <Card
              key={n.id}
              className={`cursor-pointer transition ${!n.is_read ? "border-primary/40 bg-primary/5" : ""}`}
              onClick={() => {
                if (!n.is_read) markRead.mutate(n.id);
                if (n.link) {
                  router.history.push(n.link);
                }
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{n.title}</h3>
                      <Badge variant="outline" className="text-xs">{TYPE_LABEL[n.type] ?? n.type}</Badge>
                      {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("ar-EG")}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

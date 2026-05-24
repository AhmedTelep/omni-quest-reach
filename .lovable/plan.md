
# نظام التنبيهات والإشعارات

## 1) قاعدة البيانات (migration واحد)

### جدول `notifications`
```
id uuid PK
user_id uuid (المستلم — auth user)
type text  (installment_new | installment_due_soon | installment_confirmed | installment_rejected |
            request_new | request_status_changed | resident_added | announcement | ...)
title text
body text
link text  (مسار داخلي للنقر — مثلا /my-installments)
metadata jsonb  (installment_id / request_id / project_id ...)
is_read boolean default false
created_at timestamptz
```
- RLS: المستخدم يقرأ/يحدّث (is_read) إشعاراته فقط. الإدراج عبر SECURITY DEFINER triggers أو server functions فقط.
- Index على `(user_id, is_read, created_at desc)`.
- إضافة الجدول إلى `supabase_realtime` publication + `REPLICA IDENTITY FULL`.

### جدول `announcements` (الإعلانات اليدوية)
```
id, title, body, audience (all|residents|employees|role:<role>|project:<uuid>),
created_by, created_at
```
- بعد الإدراج: trigger يولّد صفوف `notifications` لكل مستخدم في الجمهور المستهدف.

### Triggers (SECURITY DEFINER) تولّد إشعارات تلقائياً:
1. `installments AFTER INSERT` → إشعار للساكن صاحب الـ resident_id (installment_new).
2. `installments AFTER UPDATE` على payment_status:
   - `pending_confirmation` → إشعار لكل المحاسبين والأدمن (installment_pending_review).
   - `confirmed` / `rejected` → إشعار للساكن.
3. `maintenance_requests AFTER INSERT` → إشعار للأدمن/المدير/sales/sales_manager (request_new).
4. `maintenance_requests AFTER UPDATE` على status → إشعار للساكن (request_status_changed).
5. `residents AFTER INSERT` → إشعار للأدمن/المدير.
6. `announcements AFTER INSERT` → إشعارات للجمهور.

### Cron يومي (pg_cron) لتذكيرات الأقساط
- يفحص الأقساط غير المدفوعة المستحقة خلال 3 أيام/اليوم/متأخرة، ويولّد إشعارات `installment_due_soon` / `installment_overdue` (مرة واحدة في اليوم لكل قسط — جدول مساعد `notification_dedup` أو فحص `notifications` بنفس الـ metadata + اليوم).

## 2) الواجهة (Frontend)

### Hook: `useNotifications()`
- جلب آخر 30 إشعار + عدد غير المقروء.
- اشتراك realtime على `notifications` filter بـ `user_id=eq.<me>` → invalidate query + toast (sonner) للجديد.

### مكوّن `NotificationBell` في `app-shell.tsx` (header)
- أيقونة جرس + Badge بعدد غير المقروء.
- Popover يعرض القائمة: عنوان + نص مختصر + وقت نسبي + نقطة "غير مقروء".
- زر "تعليم الكل كمقروء".
- النقر على إشعار → علّمه مقروء + انتقل إلى `link`.

### صفحة `/_authenticated/notifications`
- قائمة كاملة بكل الإشعارات مع تصفية (الكل / غير مقروء / حسب النوع).

### صفحة `/_authenticated/announcements` (للأدمن/المدير فقط)
- نموذج: عنوان + نص + اختيار الجمهور (الكل / السكان / الموظفين / دور محدد / مشروع محدد).
- قائمة الإعلانات السابقة.

### تكامل مع باقي الصفحات
- إضافة إدخال "الإشعارات" في sidebar لكل الأدوار.
- إضافة "الإعلانات" في sidebar للأدمن/المدير فقط.

## 3) قنوات إضافية

### بريد إلكتروني (Lovable Emails)
- إعداد البنية التحتية للبريد (`setup_email_infra`) + قالب transactional.
- Server function `sendNotificationEmail` تُستدعى من نفس الـ triggers (عبر `pg_net` على edge function — أو من server functions عند الإنشاء بدل الـ trigger).
- المستخدم يقدر يعطّل البريد لنوع معين من صفحة "إعدادات الإشعارات".

### WhatsApp
- يحتاج مزود (Twilio أو wa.me). نقترح **مرحلة لاحقة**: زر "إرسال على واتساب" بجوار كل إشعار/قسط يفتح `wa.me/<phone>?text=...` بدون أي مفاتيح API. لو احتجت إرسال آلي فعلي → نضيف Twilio connector في خطوة منفصلة (يحتاج موافقتك وإضافة secrets).

### تفضيلات المستخدم (اختياري - مرحلة 2)
- جدول `notification_preferences (user_id, type, in_app bool, email bool)`.
- صفحة "إعدادات الإشعارات".

## 4) ملفات سيتم تعديلها/إنشاؤها

**Migration:**
- جدول `notifications` + RLS + realtime
- جدول `announcements` + RLS
- جدول `notification_dedup` (للـ cron)
- 6 triggers + دوال SECURITY DEFINER
- pg_cron job يومي للتذكيرات

**Frontend جديد:**
- `src/hooks/use-notifications.ts`
- `src/components/notification-bell.tsx`
- `src/routes/_authenticated/notifications.tsx`
- `src/routes/_authenticated/announcements.tsx`

**تعديلات:**
- `src/components/app-shell.tsx` (إضافة الجرس + روابط sidebar)
- `.lovable/plan.md` (تحديث)

**بريد (مرحلة 2 من نفس الخطة):**
- `setup_email_infra` + `scaffold_transactional_email`
- استدعاء البريد من server functions الجديدة (بدل triggers مباشرة) لأنواع مختارة (تأكيد قسط/رفض/إعلان).

## نقطة قرار
هل أبدأ بالتنفيذ كاملاً (داخل التطبيق + realtime + إعلانات + cron + بريد)؟ أم نبدأ بالمرحلة 1 (داخل التطبيق + realtime + إعلانات) ثم نضيف البريد بعد التأكد من السلوك؟

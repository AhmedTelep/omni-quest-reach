## الهدف
عند الضغط على إشعار، يفتح المستخدم مباشرة على الكيان المعني (القسط/الطلب/الساكن) ويتم تمييزه بصرياً.

## التغييرات

### 1) قاعدة البيانات (Migration جديد)
تحديث دوال الإشعارات لتضمين معرّف الكيان في الرابط (hash) بدل صفحات عامة:

| النوع | الرابط الحالي | الرابط الجديد |
|---|---|---|
| `installment_new` | `/my-installments` | `/my-installments#inst-{id}` |
| `installment_confirmed` | `/my-installments` | `/my-installments#inst-{id}` |
| `installment_rejected` | `/my-installments` | `/my-installments#inst-{id}` |
| `installment_due_soon` / `installment_overdue` | `/my-installments` | `/my-installments#inst-{id}` |
| `installment_late_fee` | `/my-installments` | `/my-installments#inst-{id}` |
| `installment_pending_review` (للموظفين) | `/installments` | `/residents/{resident_id}#inst-{id}` |
| `request_new` (للموظفين) | `/requests` | `/requests#req-{id}` |
| `request_status_changed` (للساكن) | `/my-requests` | `/my-requests#req-{id}` |
| `resident_added` (للأدمن) | `/residents` | `/residents/{resident_id}` |
| `announcement` | `/notifications` | يبقى `/notifications` |

يتم تعديل: `trg_installments_notify`, `trg_requests_notify`, `trg_residents_notify`, `apply_installment_late_fees`, `run_installment_reminders`.

### 2) التنقّل (Frontend)
- `src/components/notification-bell.tsx` و `src/routes/_authenticated/notifications.tsx`: تقسيم `n.link` إلى `pathname` و`hash` وتمريرها لـ `navigate({ to, hash })` بدل تمرير string كامل (TanStack يتعامل مع الـ hash بشكل صحيح).

### 3) التمييز البصري عند الفتح (Highlight)
Hook صغير جديد `src/hooks/use-scroll-to-hash.ts`: يقرأ `window.location.hash`، يبحث عن `id` المطابق، ثم `scrollIntoView` + إضافة class `ring-2 ring-primary` لمدة ~2.5 ثانية.

استدعاؤه + إضافة `id={`inst-${row.id}`}` أو `id={`req-${row.id}`}` على بطاقات/صفوف:
- `src/routes/_authenticated/my-installments.tsx`
- `src/routes/_authenticated/installments.tsx`
- `src/routes/_authenticated/my-requests.tsx`
- `src/routes/_authenticated/requests.tsx`
- `src/routes/_authenticated/residents_.$residentId.tsx` (لتمييز قسط داخل تبويب الأقساط)

### 4) لا تغييرات على
- منطق RLS أو الصلاحيات.
- شكل جدول `notifications` (الـ link يبقى نص واحد، يحوي المسار + hash).
- باقي الـ business logic.

## السلوك النهائي
ضغطة على إشعار "تم تأكيد قسطك" → فتح `/my-installments` مع تمرير تلقائي إلى القسط المعني وإضاءته لثوانٍ. ضغطة على إشعار "إيصال جديد بانتظار التأكيد" → فتح صفحة الساكن صاحب القسط مع تمييز القسط.

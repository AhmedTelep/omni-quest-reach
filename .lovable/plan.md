## نظرة عامة

البروجيكت الأصلي = Monorepo (Express + Drizzle + JWT يدوي + Expo). هنعيد بناء جزء الـ Admin Panel على Lovable مع نقل السكيمة كاملة لـ Supabase، وتطبيق Expo الموجود هيشتغل على نفس الداتابيز عن طريق `@supabase/supabase-js` (تعديل بسيط من جهتك).

## النتيجة النهائية

- لوحة تحكم أدمن كاملة (عربي RTL) على Lovable + Cloudflare
- داتابيز موحّدة على Supabase (PostgreSQL + Auth + Storage + Realtime)
- تطبيق Expo بيتصل بنفس الـ Supabase = أي تعديل من الويب يظهر فوراً على الموبايل والعكس
- جاهز للنشر مباشرة من زر Publish في Lovable

## القرارات المعمارية

| القرار | التفسير |
|---|---|
| **Auth**: Supabase Auth بدل JWT يدوي | الأدمن/الموظف → email + password عبر Supabase Auth. السكان → unit_number كـ email داخلي (`unit@compound.local`) + password. ده يدّيهم Realtime + RLS مظبوط. |
| **الأدوار**: جدول `user_roles` منفصل | admin / manager / sales_manager / sales / accountant / resident — لمنع privilege escalation. |
| **التخزين**: Supabase Storage | بدل `artifacts/api-server/uploads/` — للإيصالات وصور طلبات الصيانة. |
| **سكيمة DB**: مطابقة 1:1 للسكيمة الأصلية | نفس الجداول والأعمدة (projects, residents, employees, maintenance_requests, services, installments) عشان تطبيق Expo يتحول بأقل تعديل. |
| **RLS**: مفعّل على كل الجداول | السكان يشوفوا بياناتهم بس. الموظفين حسب الدور. الأدمن كل حاجة. |

## المراحل

### المرحلة 1 — الباك إند (Lovable Cloud)
1. تفعيل Lovable Cloud
2. Migration ينشئ كل الجداول مطابقة للسكيمة الأصلية + جدول `user_roles` + enum للأدوار
3. RLS policies لكل جدول + `has_role()` security definer function
4. Storage buckets: `receipts`, `request-images`, `project-logos`
5. Trigger لتحويل `auth.users` الجديد → صف في `employees` أو `residents` حسب metadata

### المرحلة 2 — Admin Panel UI
صفحات (مطابقة للأصلي):
- `/login` — تسجيل دخول أدمن/موظف موحّد
- `/` — Dashboard (إحصائيات + فلتر مشروع)
- `/projects` — CRUD مشاريع
- `/residents` — CRUD سكان + إنشاء حساب Auth
- `/requests` — طلبات الصيانة (تحديث الحالة + ملاحظات)
- `/services` — إدارة أنواع الخدمات
- `/installments` — أقساط + سير عمل التأكيد
- `/employees` — إدارة الموظفين
- `/employee-accountant` — بورتال المحاسب (رفع إيصال)
- `/employee-sales` / `/employee-sales-manager` — حسب الدور

كله بـ shadcn + Tailwind + RTL عربي + sidebar فيه dropdown اختيار المشروع.

### المرحلة 3 — Realtime
- اشتراك على `maintenance_requests` و `installments` — أي تعديل من الموبايل يظهر فوراً في الأدمن.

### المرحلة 4 — توثيق تعديلات تطبيق Expo (هتعملها أنت)
هسلّملك:
- الـ Supabase URL + Anon Key (من Lovable Cloud)
- ملف SQL للسكيمة (للمراجعة)
- دليل قصير: استبدل client الـ API القديم في `resident-app/` بـ `createClient` من `@supabase/supabase-js`، استخدم `signInWithPassword` للسكان، والاستعلامات مباشرة بدل REST endpoints.
- نفس RLS هتحمي الموبايل تلقائياً.

### المرحلة 5 — النشر
زر Publish من Lovable.

## ما هو خارج النطاق

- ❌ مش هنبني تطبيق Expo من جديد — هتعدّله أنت بنفسك بناءً على الدليل
- ❌ مش هنحوّل الـ Express API القديم — هيتشال كلياً، Supabase هيقوم بدوره
- ❌ ترحيل بيانات قديمة من قاعدة Replit القديمة — لو محتاج ده قولي

## التفاصيل التقنية

```text
[Web Admin - TanStack Start]  ─┐
                                ├─► Supabase (Postgres + Auth + Storage + Realtime)
[Mobile - Expo + supabase-js]  ─┘
```

- Auth flow: `supabase.auth.signInWithPassword()` على الويب والموبايل
- RLS policies تستخدم `auth.uid()` و `public.has_role(auth.uid(), 'role')`
- بيانات السكان مرتبطة بـ `auth_user_id uuid references auth.users(id)`
- ترحيل سلس: عند إنشاء resident جديد من الأدمن → ينشئ Supabase user تلقائياً + صف في `residents`

## المدة المتوقعة

شغل كبير. مراحل 1+2+3 هتاخد عدة جولات. هبدأ بالباك إند والسكيمة، وبعد ما تتأكد منها هنبني الواجهة.

## الموافقة

لو موافق، هبدأ فوراً بتفعيل Lovable Cloud والمرحلة 1.

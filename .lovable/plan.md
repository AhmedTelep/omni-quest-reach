
## 1) إعادة التسمية إلى x-project

### إخفاء شارة "Edit with Lovable"
- استدعاء `publish_settings--set_badge_visibility` بـ `hide_badge: true` (يتطلب Pro plan؛ سيُبلَّغ المستخدم لو الخطة لا تسمح).

### استبدال اسم "Lovable Cloud" في docs/
- `docs/mobile-integration.md` و `docs/expo-integration.md`: استبدال كل ظهور للنص العربي/الإنجليزي "Lovable Cloud" / "Lovable" بـ **x-project** في الشرح والعناوين، مع الإبقاء على المسارات التقنية الداخلية كما هي (روابط Supabase، أسماء المتغيرات `VITE_SUPABASE_*`).

ملاحظة: لن نلمس الملفات التالية لأنها بنية تحتية محمية أو ستكسر البناء:
- `src/integrations/supabase/*` (auto-generated)
- `package.json` / `vite.config.ts` / `bunfig.toml` (تستخدم اسم الحزمة `@lovable.dev/vite-tanstack-config`)
- `LOVABLE_API_KEY` (secret مدمج مع AI Gateway)

## 2) فحص الأمان الكامل — المشاكل المكتشفة والمعالجة

### A. RLS Policies — مشاكل حرجة

**A1. `notification_dedup` بدون أي سياسة SELECT** (warn)
- المشكلة: RLS مفعّل لكن لا سياسة → أي قراءة من client تفشل صامتاً، وأي إضافة سياسة لاحقاً قد تُسرّب dedup keys.
- الحل: إضافة سياسة صريحة `FOR ALL TO authenticated USING (false)` (الوصول فقط عبر SECURITY DEFINER functions كما هو معمول حالياً)، مع منع `INSERT/UPDATE/DELETE` من المستخدمين.

**A2. سياسات Storage ناقصة (`receipts` bucket)** (warn)
- الساكن لا يستطيع تعديل/استبدال إيصال رفعه بالخطأ.
- الحل: إضافة سياسة `receipts_owner_update` بنطاق `auth.uid()::text = (storage.foldername(name))[1]`.

**A3. سياسة `project-images` UPDATE بدون WITH CHECK** (warn)
- مدير يقدر يغيّر `bucket_id` لباكت آخر ويتجاوز سياساته.
- الحل: إضافة `WITH CHECK (bucket_id = 'project-images' AND is_admin_or_manager(auth.uid()))`.

**A4. الباكتات العامة (`project-logos`, `project-images`) تسمح بـ LISTING** (warn)
- يمكن لأي زائر سرد كل الملفات.
- الحل: تقييد سياسة SELECT العامة على `bucket_id` فقط دون السماح بقراءة object listing (تعديل storage.objects policy للسماح بـ GET المباشر للملفات الأفراد فقط، أو الاحتفاظ بها كما هي بعد تأكيد المستخدم أن السرد العام مقبول للشعارات).

### B. SECURITY DEFINER Functions قابلة للتنفيذ من المستخدمين (warn)
- الدوال مثل `notify_user`, `recompute_installment_totals`, `apply_installment_late_fees`, `run_installment_reminders` يجب ألا يستدعيها مستخدم نهائي مباشرة.
- الحل: `REVOKE EXECUTE ... FROM PUBLIC, authenticated` لكل دالة من هذه الدوال؛ الإبقاء على الصلاحية للـ `postgres` role فقط (تُستدعى من triggers و pg_cron).

### C. مراجعة سياسات RLS منطقياً (بدون مشاكل حالية مكتشفة، لكن للتأكيد)
- ✅ `installments_resident_update_own` تُقيّد المستخدم على الحقول المالية عبر `guard_resident_installment_update` trigger.
- ✅ `payments_resident_insert_own` تفرض `payment_status = 'pending_confirmation'`.
- ✅ كل الجداول الحساسة (`residents`, `installments`, `user_roles`, `profiles`) مفصولة عن staff/resident بشكل صحيح.
- ✅ `user_roles` منفصل عن `profiles` (يتبع best practice ضد privilege escalation).

### D. Auth Settings
- التأكيد على تفعيل **Leaked Password Protection (HIBP)** عبر `configure_auth` — يمنع كلمات المرور المسرّبة عند التسجيل/التغيير.
- التأكد من أن `auto_confirm_email` معطل (المستخدم لم يطلبه).

### E. Server Functions & Frontend
- مراجعة كل `createServerFn` في `src/lib/*.functions.ts` للتأكد من:
  - استخدام `requireSupabaseAuth` middleware حيثما يجب.
  - وجود `inputValidator` بـ Zod مع حدود (min/max للأرقام والنصوص).
  - عدم تمرير أسرار للـ client.
- مراجعة `src/lib/admin-users.functions.ts` خاصة (تستخدم `supabaseAdmin` → يجب التأكد من فحص الدور قبل أي عملية).

## ترتيب التنفيذ
1. **Migration واحد** يجمع: حل A1+A2+A3 + REVOKE EXECUTE للدوال (B) + شد سياسات Storage listing (A4).
2. تفعيل HIBP عبر `configure_auth`.
3. مراجعة وتعديل `src/lib/admin-users.functions.ts` و server functions لإضافة validators ناقصة.
4. تعديل docs/ لاستبدال "Lovable Cloud" → "x-project".
5. إخفاء شارة Lovable (مع تنبيه لو الخطة لا تسمح).
6. إعادة تشغيل `supabase--linter` و security scan للتأكد من حل كل المشاكل.

## ما لن يتغيّر
- اسم الحزمة `@lovable.dev/vite-tanstack-config` في `package.json` (مكتبة الـ build).
- ملفات `src/integrations/supabase/*` (مُولّدة تلقائياً).
- متغيرات البيئة `VITE_SUPABASE_*` و `LOVABLE_API_KEY` (تكامل داخلي).
- منطق الأعمال (الأقساط، الغرامات، الإشعارات) كما هو.

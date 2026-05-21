
# خطة: مراجعة الصلاحيات + Dashboard الساكن

## 1) ضبط صلاحيات الموظفين

### تعديل الـ Sidebar (`src/components/app-shell.tsx`)
إعادة تعريف القوائم لكل دور بدقة:

| الصفحة | admin | manager | sales_manager | sales | accountant |
|---|---|---|---|---|---|
| الرئيسية | ✅ | ✅ | ✅ | ✅ | ✅ (مبسطة) |
| المشاريع | ✅ | ✅ | ✅ | ❌ | ❌ |
| الوحدات | ✅ | ✅ | ✅ | ✅ | ❌ |
| السكان | ✅ | ✅ | ✅ | ✅ | ❌ |
| طلبات الصيانة | ✅ | ✅ | ✅ | ✅ | ❌ |
| الأقساط | ✅ | ✅ | ✅ (read-only) | ❌ | ✅ |
| أنواع الخدمات | ✅ | ✅ | ❌ | ❌ | ❌ |
| الموظفين | ✅ | ✅ (بدون admin) | ❌ | ❌ | ❌ |

### ضبط داخل الصفحات
- **`installments.tsx`**: إخفاء زر "إضافة قسط" + أزرار التأكيد/الرفض عن `sales_manager`. هو يشوف القائمة فقط.
- **`employees.tsx`**: المدير (manager) لا يرى خيار دور "admin" في الـ Select ولا يقدر يحذف/يعدّل أدمن.
- **Dashboard الرئيسي**: للمحاسب نعرض كروت إحصائيات أقساط فقط (مدفوع/مستحق/بانتظار التأكيد).

### ضبط server-side
- **`createEmployee`**: لو الـ caller `manager` فقط (مش `admin`) ولـ `role` المطلوب = `admin` → رفض.
- **`deleteUser` / `resetUserPassword`**: نفس المنطق — `manager` لا يقدر يلمس أدمن.
- **`createInstallment`** + **`decideInstallment`**: تأكيد أن `sales_manager` مش ضمن المسموح لهم في إنشاء/تأكيد الأقساط (مراجعة المنطق الحالي).

## 2) إضافة "المدينة" للمشاريع (للطقس)

### Migration
```
ALTER TABLE projects ADD COLUMN city text;
ALTER TABLE projects ADD COLUMN latitude numeric;
ALTER TABLE projects ADD COLUMN longitude numeric;
```
- `city`: اسم المدينة (للعرض)
- `lat/lng`: نملأها تلقائياً من Open-Meteo geocoding API بعد إدخال المدينة (مجاني، بدون مفتاح).

### تعديل `projects.tsx` + `admin-users.functions.ts`
- إضافة حقل "المدينة" في نموذج المشروع.
- عند الحفظ: نداء geocoding وتخزين lat/lng.

## 3) إعادة بناء Dashboard الساكن (`dashboard.tsx`)

عند `isResident`، نعرض صفحة كاملة بدل النص الفارغ الحالي. الأقسام:

### أ) كارت بيانات الوحدة
- رقم الوحدة، اسم المشروع، السعر الإجمالي.

### ب) ملخص مالي
- إجمالي مدفوع (مجموع الأقساط `confirmed`) / إجمالي مستحق / متبقي من سعر الوحدة.
- شريط تقدم بصري.

### ج) معرض صور المشروع
- carousel بسيط لصور `projects.images`.

### د) مساحات المشروع
- شارات (badges) من `projects.spaces`: مسبح، جيم...

### هـ) طلبات الصيانة المفتوحة
- آخر 3 طلبات للساكن مع حالتها + رابط "كل طلباتي".

### و) الأقساط القادمة
- أقرب قسطين غير مدفوعين + رابط "كل أقساطي".

### ز) كارت الطقس
- جلب من `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current=temperature_2m,weather_code` باستخدام lat/lng من المشروع.
- لو المشروع مفيش له إحداثيات → نخفي الكارت بهدوء.
- عرض: الحرارة الحالية + أيقونة الحالة + اسم المدينة.

## التفاصيل التقنية

- لا migrations حساسة على RLS (الأعمدة الجديدة ترث RLS الحالي للمشاريع).
- جلب الطقس يتم client-side مباشرة من المتصفح (Open-Meteo CORS-enabled، بدون مفتاح، بدون server function).
- استعلامات Dashboard الساكن نستخدم `useQuery` متعددة وموازية (`Promise.all` غير ضروري لأن React Query يوازي بطبيعته).
- لا تغييرات على ملفات auto-generated (`types.ts`, `client.ts`).
- تعديلات قواعد البيانات: migration واحد فقط (3 أعمدة على `projects`).

## ملفات سيتم تعديلها
- `supabase/migrations/<new>.sql` — أعمدة city/lat/lng
- `src/lib/admin-users.functions.ts` — حماية manager من admin، schema المشروع
- `src/components/app-shell.tsx` — قوائم navigation الجديدة
- `src/routes/_authenticated/dashboard.tsx` — Dashboard الساكن + كارت المحاسب
- `src/routes/_authenticated/installments.tsx` — إخفاء أزرار للـ sales_manager
- `src/routes/_authenticated/employees.tsx` — منع manager من admin
- `src/routes/_authenticated/projects.tsx` — حقل المدينة + geocoding

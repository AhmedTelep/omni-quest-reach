
# إعادة تصميم النظام بأسلوب "X REAL ESTATE"

## 1. نظام الألوان (`src/styles.css`)

تحديث الـ design tokens لـ:

**Light (افتراضي)**
- `--background`: أبيض/رمادي فاتح جداً مع نقاط خفيفة (grid pattern)
- `--card`: أبيض نقي
- `--primary` / accent: **Electric Cyan** `oklch(0.72 0.15 200)` (#06b6d4)
- `--primary-glow`: cyan فاتح متوهج للأزرار النشطة
- `--sidebar`: داكن جداً `oklch(0.15 0.03 240)` (navy/black) — السايدبار **دائماً داكن** حتى في light mode (مطابق للصورة)
- `--sidebar-foreground`: فاتح
- `--sidebar-accent`: cyan متوهج

**Dark**
- `--background`: navy غامق `oklch(0.12 0.02 240)`
- `--card`: navy أفتح قليلاً
- accents نفسها

**Gradients & shadows جديدة (tokens)**
- `--gradient-stat-blue`, `--gradient-stat-green`, `--gradient-stat-orange`, `--gradient-stat-purple` — للكروت
- `--gradient-cyan-glow` — لزر تسجيل الخروج
- `--shadow-glow-cyan` — توهج حول العناصر النشطة
- `--shadow-card` — ظل ناعم للكروت
- grid background pattern عبر `background-image: radial-gradient(...)` على `<main>`

## 2. ThemeProvider جديد

ملف `src/components/theme-provider.tsx`:
- يخزّن الثيم في `localStorage` (`theme: light | dark`)
- يضيف/يزيل class `dark` على `<html>`
- يصدّر `useTheme()` hook
- الافتراضي: **light**

تطبيقه في `src/router.tsx` أو `__root.tsx` بحيث يلف التطبيق.

زر التبديل (أيقونة قمر/شمس) في التوب بار يسار.

## 3. إعادة بناء `src/components/app-shell.tsx`

**السايدبار (يمين، RTL)** — `w-72`، خلفية `bg-sidebar` داكنة، يحتوي:
1. **شعار الشركة**: أيقونة مبنى دائرية بخلفية cyan متوهجة + نص "X REAL ESTATE" + سطر صغير "للعقارات الذكية".
2. **كارت المستخدم**: avatar دائري بـ gradient cyan، اسم، إيميل.
3. **Select المشروع الحالي**: مع label "المشروع الحالي".
4. **روابط NAV**: زر مستطيل، النشط بخلفية cyan/teal متوهجة (`shadow-glow-cyan`) + نص داكن، غير النشط بنص فاتح + أيقونة يمين.
5. **زر تسجيل الخروج**: أسفل، عرض كامل، خلفية بـ gradient cyan متوهج + أيقونة.

**التوب بار**:
- يسار: زر تبديل ثيم (Moon/Sun icon).
- النص: شريط بحث عريض (input + أيقونة Search) — placeholder "البحث".
- يمين: `NotificationBell` (الموجود حالياً) مع نقطة حمراء.
- خلفية شفافة/blur خفيف، حد سفلي رفيع.

**Main**: padding أكبر، خلفية بنقاط خفيفة (dot grid pattern).

## 4. صفحة الداشبورد `src/routes/_authenticated/dashboard.tsx`

- **هيدر الصفحة**: عنوان كبير "لوحة التحكم" بخط ثقيل + سطر وصف رمادي تحته.
- **شبكة 2×2 من الكروت** (responsive: 1 col mobile, 2 cols desktop):
  - كل كارت: ارتفاع ~140px، `rounded-2xl`، خلفية gradient (أزرق/أخضر/برتقالي/بنفسجي بشفافية)، أيقونة دائرية يمين أعلى داخل دائرة شفافة، نص العنوان أعلى يمين، رقم ضخم (text-5xl bold) أسفل يمين، **sparkline SVG** على اليسار (خط منحني بسيط بلون الكارت).
  - الكروت: المشاريع (أزرق)، السكان (أخضر)، طلبات صيانة مفتوحة (برتقالي)، أقساط بانتظار التأكيد (بنفسجي).
- إعادة استخدام queries الموجودة لجلب الأرقام.

مكوّن `StatCard` جديد في `src/components/stat-card.tsx` بـ props: `title, value, icon, variant: 'blue'|'green'|'orange'|'purple', sparklineData?`.

## 5. تنسيق صفحات داخلية

تحديث `Card`, `Button`, `Input`, `Table` لتستخدم نفس الـ tokens الجديدة — لن نلمس بنية الصفحات الأخرى، فقط الـ tokens تطبّق تلقائياً عليها لأنها كلها تستخدم semantic classes.

## 6. صفحة Login

تحديث `src/routes/login.tsx` بنفس الطابع: خلفية بنقاط، كارت توسّط بظل ناعم، شعار "X REAL ESTATE" بأيقونة دائرية cyan في الأعلى.

## الملفات المتأثرة

- ✏️ `src/styles.css` — tokens جديدة كاملة
- ➕ `src/components/theme-provider.tsx`
- ➕ `src/components/theme-toggle.tsx`
- ➕ `src/components/stat-card.tsx`
- ✏️ `src/components/app-shell.tsx` — إعادة بناء كامل للسايدبار والتوب بار
- ✏️ `src/routes/_authenticated/dashboard.tsx` — استخدام StatCard + sparklines
- ✏️ `src/routes/login.tsx` — توحيد الطابع
- ✏️ `src/router.tsx` أو `__root.tsx` — ThemeProvider

النتيجة: نظام موحّد بطابع "X REAL ESTATE" — أنيق، داكن/فاتح، accent cyan متوهج، كروت ملوّنة بـ gradients، RTL كامل.

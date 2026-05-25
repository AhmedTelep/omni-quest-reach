# دليل ربط تطبيق Expo بـ x-project (Supabase)

التطبيق القديم في `resident-app/` كان يكلّم Express API يدوي. هنحوّله يكلّم Supabase مباشرة — نفس الداتابيز اللي بيستخدمها الـ Admin Panel.

## 1) المتغيرات

ضيف في `resident-app/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://hulilcpndpdtvcryykqx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1bGlsY3BuZHBkdHZjcnl5a3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMDQ4MjQsImV4cCI6MjA5NDY4MDgyNH0.7gCbLZCtshSH-wzrj_mx60Xm85FiwShXVB5tWE-qTq8
```

## 2) Install

```
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
```

## 3) Supabase client (`lib/supabase.ts`)

```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
```

## 4) تسجيل دخول الساكن

الإيميل الداخلي للساكن = `unit-<unit>@resident.local` (نفس اللي بيعمله الأدمن وقت إنشاء الحساب).

```ts
const unit = userInput.toLowerCase().replace(/[^a-z0-9]/g, '-');
const email = `unit-${unit}@resident.local`;
await supabase.auth.signInWithPassword({ email, password });
```

## 5) جلب بيانات الساكن

```ts
const { data: { user } } = await supabase.auth.getUser();
const { data: resident } = await supabase
  .from('residents').select('*').eq('user_id', user!.id).single();
```

## 6) طلب صيانة جديد

```ts
// رفع صورة (اختياري) — لازم تحت auth uid عشان RLS تسمح
let image_url: string | null = null;
if (imageUri) {
  const ext = imageUri.split('.').pop() ?? 'jpg';
  const path = `${user.id}/${Date.now()}.${ext}`;
  const blob = await (await fetch(imageUri)).blob();
  const { error } = await supabase.storage.from('request-images').upload(path, blob);
  if (error) throw error;
  image_url = path;
}

await supabase.from('maintenance_requests').insert({
  resident_id: resident.id,
  project_id: resident.project_id,
  service_id: selectedServiceId,
  service_type: selectedServiceName,
  notes,
  image_url,
});
```

## 7) جلب الأقساط ورفع إيصال

```ts
const { data: items } = await supabase
  .from('installments').select('*').eq('resident_id', resident.id);

// رفع إيصال
const path = `${user.id}/${Date.now()}.jpg`;
await supabase.storage.from('receipts').upload(path, blob);
await supabase.from('installments').update({
  receipt_url: path,
  paid_at: new Date().toISOString(),
  paid_by_name: resident.name,
  payment_status: 'pending_confirmation',
}).eq('id', installmentId);
```

## 8) Realtime (اختياري)

```ts
const ch = supabase.channel('my-installments')
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'installments',
      filter: `resident_id=eq.${resident.id}` },
    (payload) => { /* حدّث الحالة */ })
  .subscribe();
// عند unmount: supabase.removeChannel(ch);
```

## 9) شيل القديم

- شيل أي `axios` بيكلّم الـ Express API.
- شيل JWT/AsyncStorage tokens القديمة — Supabase بيدير الجلسة لوحده.
- مفيش حاجة اسمها `/auth/login` يدوي بعد كده — `signInWithPassword` بيكفي.

## 10) الـ RLS بيحميك تلقائياً

- الساكن يقدر يقرأ بياناته بس (residents/installments/maintenance_requests الخاصة بيه).
- لا يحتاج تحقق إضافي في الـ client — أي query بترجع له بياناته فقط.

## التحقق

1. شغّل Admin Panel وأنشئ ساكن جديد (Unit مثلاً `BL-100` + password).
2. في الموبايل سجّل دخول بـ `BL-100` + نفس الـ password.
3. أنشئ طلب صيانة → افتح `/requests` في الويب → لازم يظهر فوراً (Realtime).
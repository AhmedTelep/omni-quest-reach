# دليل ربط تطبيقات Mobile (Android / iOS) بـ Lovable Cloud

التطبيق الموبايل بيتكلم مع **نفس قاعدة البيانات** اللي بتستخدمها لوحة الإدارة عبر Supabase. أي تعديل في الويب يظهر فوراً في الموبايل والعكس (عبر Realtime).

---

## 1) المفاتيح (Keys)

| المتغير | القيمة |
|---|---|
| `SUPABASE_URL` | `https://hulilcpndpdtvcryykqx.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1bGlsY3BuZHBkdHZjcnl5a3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMDQ4MjQsImV4cCI6MjA5NDY4MDgyNH0.7gCbLZCtshSH-wzrj_mx60Xm85FiwShXVB5tWE-qTq8` |

> `ANON_KEY` مفتاح عام آمن للاستخدام داخل تطبيقات الموبايل — الحماية الفعلية بتتم عبر **RLS** على كل الجداول.
> ❌ لا تستخدم أبداً `SERVICE_ROLE_KEY` داخل تطبيق موبايل.

---

## 2) تثبيت المكتبات (Expo)

```bash
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill expo-image-picker expo-file-system
```

ملف `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://hulilcpndpdtvcryykqx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1bGlsY3BuZHBkdHZjcnl5a3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMDQ4MjQsImV4cCI6MjA5NDY4MDgyNH0.7gCbLZCtshSH-wzrj_mx60Xm85FiwShXVB5tWE-qTq8
```

---

## 3) Supabase Client (`lib/supabase.ts`)

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
  }
);
```

---

## 4) المصادقة (Auth)

### تسجيل دخول الساكن
الويب بيقبل `unit-A01` كاسم دخول ويحوله لـ `unit-a01@resident.local`. الموبايل لازم يعمل نفس التحويل:

```ts
export async function loginResident(input: string, password: string) {
  let email = input.trim();
  if (!email.includes('@')) {
    const slug = email.toLowerCase().replace(/^unit-/, '').replace(/[^a-z0-9]/g, '-');
    email = `unit-${slug}@resident.local`;
  }
  return supabase.auth.signInWithPassword({ email, password });
}

export const logout = () => supabase.auth.signOut();

export function onAuthChange(cb: (uid: string | null) => void) {
  return supabase.auth.onAuthStateChange((_e, s) => cb(s?.user?.id ?? null));
}
```

---

## 5) الجداول المتاحة + أمثلة

كل القراءات تحت حماية RLS — الساكن بيشوف بياناته هو فقط تلقائياً.

### a) بروفايل الساكن الحالي
```ts
const { data: resident } = await supabase
  .from('residents')
  .select('*, projects(*)')
  .eq('user_id', (await supabase.auth.getUser()).data.user!.id)
  .single();
```

### b) أقساطي (`installments`)
```ts
const { data } = await supabase
  .from('installments')
  .select('*')
  .eq('resident_id', residentId)
  .order('due_date', { ascending: true });
```

### c) رفع إيصال دفع
```ts
import * as FileSystem from 'expo-file-system';

async function uploadReceipt(installmentId: string, fileUri: string) {
  const ext = fileUri.split('.').pop() ?? 'jpg';
  const path = `${installmentId}/${Date.now()}.${ext}`;
  const file = await FileSystem.readAsStringAsync(fileUri, { encoding: 'base64' });

  const { error: upErr } = await supabase.storage
    .from('receipts')
    .upload(path, Buffer.from(file, 'base64'), { contentType: `image/${ext}` });
  if (upErr) throw upErr;

  await supabase.from('installments').update({
    receipt_url: path,
    payment_status: 'pending_confirmation',
    paid_at: new Date().toISOString(),
  }).eq('id', installmentId);
}
```

### d) طلباتي (`maintenance_requests`)
```ts
// قراءة
const { data } = await supabase
  .from('maintenance_requests')
  .select('*, services(*)')
  .eq('resident_id', residentId)
  .order('created_at', { ascending: false });

// إنشاء
await supabase.from('maintenance_requests').insert({
  resident_id: residentId,
  project_id: projectId,
  service_id: serviceId,
  service_type: 'سباكة',
  notes: '...',
  preferred_date: new Date().toISOString(),
});
```

### e) أنواع الخدمات
```ts
const { data: services } = await supabase.from('services').select('*');
```

### f) الإعلانات
```ts
const { data } = await supabase
  .from('announcements')
  .select('*')
  .order('created_at', { ascending: false });
```

### g) الإشعارات
```ts
const { data } = await supabase
  .from('notifications')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(50);

// تعليم كمقروء
await supabase.from('notifications').update({ is_read: true }).eq('id', id);
```

---

## 6) Realtime (تحديث فوري)

```ts
const uid = (await supabase.auth.getUser()).data.user!.id;

const channel = supabase
  .channel(`notifications:${uid}`)
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
    (payload) => {
      console.log('إشعار جديد', payload.new);
    })
  .subscribe();

// عند الخروج:
// supabase.removeChannel(channel);
```

نفس الفكرة تنفع مع `installments` و `maintenance_requests`.

---

## 7) Storage Buckets

| Bucket | عام؟ | الاستخدام |
|---|---|---|
| `receipts` | لا | إيصالات الأقساط |
| `request-images` | لا | صور طلبات الصيانة |
| `project-logos` | نعم | لوجوهات المشاريع |
| `project-images` | نعم | صور المشاريع |

الحصول على رابط ملف خاص:
```ts
const { data } = await supabase.storage.from('receipts').createSignedUrl(path, 3600);
```

---

## 8) ملاحظات أمان

- ✅ `ANON_KEY` آمن في كود الموبايل.
- ✅ كل الحماية عبر RLS — الساكن لا يقدر يقرأ بيانات ساكن تاني حتى لو حاول.
- ✅ لو اتسرّب الـ key أو احتجت تدويره: من إعدادات Lovable Cloud → Rotate API Keys.
- ❌ لا تخزن `SERVICE_ROLE_KEY` في التطبيق إطلاقاً.
- ❌ لا تعطل RLS من الموبايل (مش هينفع أصلاً بالـ anon key).

---

## 9) iOS / Android خصوصيات

**iOS** — `Info.plist`:
- `NSPhotoLibraryUsageDescription` — لاختيار صور الإيصالات والطلبات.
- `NSCameraUsageDescription` — للتصوير المباشر.

**Android** — `AndroidManifest.xml`:
- `INTERNET` (افتراضي).
- `READ_MEDIA_IMAGES` (Android 13+).

للإشعارات الـ Push يفضّل استخدام `expo-notifications` مع تخزين الـ `expo_push_token` في جدول إضافي (`device_tokens`) لو احتجناه لاحقاً.
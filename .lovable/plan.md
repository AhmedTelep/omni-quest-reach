# خطة تحسين نظام الأقساط

## 1. سيريال فريد للقسط (Installment Serial)
- إضافة عمود `serial` (text, unique) لجدول `installments`
- توليده تلقائياً بصيغة: `INS-YYYYMM-XXXXXX` (مثلاً `INS-202605-000123`)
- استخدام sequence في Postgres + trigger لضمان عدم التكرار
- عرض السيريال في صفحات الأقساط (الإدارة + الساكن)

## 2. الدفع الجزئي (Partial Payments)
حالياً كل قسط = دفعة واحدة. سنضيف:
- عمود `paid_amount` (numeric, default 0) في `installments`
- عمود `remaining_amount` محسوب (`amount - paid_amount`)
- جدول جديد `installment_payments`:
  - `installment_id`, `amount`, `receipt_url`, `paid_at`, `paid_by_name`
  - `payment_status` (pending/confirmed/rejected)
  - `confirmed_at`, `confirmed_by_name`, `rejection_reason`
  - `serial` (PAY-YYYYMM-XXXXXX)
- تحديث الحالة تلقائياً: `paid` عند `paid_amount >= amount`، `partial` عند جزئي، `pending` لا شيء
- تحديث RLS: الساكن يضيف دفعات لأقساطه فقط، الموظف يؤكد/يرفض

## 3. جدولة الأقساط لكل عميل (Schedule)
- نموذج "إنشاء جدول أقساط" في صفحة تفاصيل الساكن:
  - المبلغ الإجمالي
  - عدد الأقساط
  - تاريخ أول قسط
  - تكرار (شهري / ربع سنوي / سنوي)
  - وصف
- زر يولّد كل الأقساط دفعة واحدة (server function) مع سيريال لكل قسط
- عرض الجدول في صفحة الساكن: ملخص (المدفوع/المتبقي/التالي مستحق)

## 4. PDF استمارة تأكيد الدفع
- زر "تحميل إيصال تأكيد" يظهر بعد تأكيد القسط/الدفعة
- يولّد PDF بالعربية يحتوي:
  - شعار المشروع + اسمه
  - سيريال القسط + سيريال الدفعة
  - اسم الساكن + رقم الوحدة
  - المبلغ المدفوع + المتبقي + الإجمالي
  - تاريخ الدفع + اسم المؤكد
  - QR code للتحقق (يحوي السيريال)
- باستخدام `jspdf` + `jspdf-autotable` مع خط عربي
- يتم التوليد client-side في المتصفح

## 5. تغييرات قاعدة البيانات (Migration)
```sql
-- Sequence + serial for installments
CREATE SEQUENCE installments_serial_seq;
ALTER TABLE installments ADD COLUMN serial text UNIQUE;
ALTER TABLE installments ADD COLUMN paid_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE installments ADD COLUMN installments_count integer; -- رقم القسط من العدد الكلي
ALTER TABLE installments ADD COLUMN installment_index integer; -- ترتيب القسط
ALTER TABLE installments ADD COLUMN schedule_id uuid; -- ربط بالجدول

-- جدول الجدولة
CREATE TABLE installment_schedules (
  id uuid PK, resident_id, project_id, total_amount, count, 
  frequency text, start_date, description, created_by, created_at
);

-- جدول الدفعات الجزئية
CREATE TABLE installment_payments (
  id uuid PK, installment_id, serial text UNIQUE,
  amount, receipt_url, paid_at, paid_by_name,
  payment_status, confirmed_at, confirmed_by_name, rejection_reason,
  created_at, updated_at
);

-- Triggers لتوليد السيريال + تحديث paid_amount + الحالة
```

## 6. ملفات الكود الجديدة/المُعدّلة
- `src/lib/installments.functions.ts` — server fns: `createSchedule`, `addPayment`, `decidePayment`
- `src/lib/installment-pdf.ts` — توليد PDF
- `src/routes/_authenticated/installments.tsx` — عرض السيريال + الدفعات + زر PDF
- `src/routes/_authenticated/my-installments.tsx` — دفع جزئي + PDF
- `src/routes/_authenticated/residents_.$residentId.tsx` — قسم جدولة الأقساط
- مكوّن `InstallmentScheduleDialog`
- مكوّن `PaymentsListDialog` لعرض دفعات قسط

## التنفيذ بالترتيب
1. Migration لكل التغييرات في الـ DB
2. server functions
3. PDF helper + خط عربي
4. تحديث الصفحات الموجودة
5. اختبار يدوي

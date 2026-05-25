import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getRoles(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as string);
}

function addPeriod(date: Date, freq: string, n: number): Date {
  const d = new Date(date);
  if (freq === "weekly") d.setDate(d.getDate() + n * 7);
  else if (freq === "monthly") d.setMonth(d.getMonth() + n);
  else if (freq === "quarterly") d.setMonth(d.getMonth() + n * 3);
  else if (freq === "biannual") d.setMonth(d.getMonth() + n * 6);
  else if (freq === "yearly") d.setFullYear(d.getFullYear() + n);
  return d;
}

const lateFeeSettingsSchema = z.object({
  lateFeeType: z.enum(["none", "fixed", "percent"]).optional().default("none"),
  lateFeeValue: z.number().min(0).max(1_000_000_000).optional().default(0),
  lateFeeGraceDays: z.number().int().min(0).max(3650).optional().default(0),
  lateFeeRecurrence: z.enum(["once", "daily", "weekly", "monthly"]).optional().default("once"),
  reminderDaysBefore: z.number().int().min(0).max(365).optional().default(3),
});

function settingsToColumns(s: {
  lateFeeType?: string; lateFeeValue?: number; lateFeeGraceDays?: number;
  lateFeeRecurrence?: string; reminderDaysBefore?: number;
}) {
  return {
    late_fee_type: s.lateFeeType ?? "none",
    late_fee_value: s.lateFeeValue ?? 0,
    late_fee_grace_days: s.lateFeeGraceDays ?? 0,
    late_fee_recurrence: s.lateFeeRecurrence ?? "once",
    reminder_days_before: s.reminderDaysBefore ?? 3,
  };
}

/** Create a schedule of installments for a resident (admin/manager) */
export const createInstallmentSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        residentId: z.string().uuid(),
        totalAmount: z.number().positive().max(1_000_000_000),
        count: z.number().int().min(1).max(600),
        frequency: z.enum(["weekly", "monthly", "quarterly", "biannual", "yearly"]),
        startDate: z.string().min(1),
        description: z.string().max(500).optional().default(""),
        downPayment: z.number().min(0).max(1_000_000_000).optional().default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const roles = await getRoles(context.userId);
    if (!roles.some((r) => ["admin", "manager"].includes(r))) {
      throw new Error("غير مصرح بإنشاء جدول أقساط");
    }
    const { data: resident, error: rerr } = await supabaseAdmin
      .from("residents")
      .select("id, project_id")
      .eq("id", data.residentId)
      .maybeSingle();
    if (rerr) throw new Error(rerr.message);
    if (!resident?.project_id) throw new Error("الساكن غير مرتبط بمشروع");

    const { data: sched, error: serr } = await supabaseAdmin
      .from("installment_schedules")
      .insert({
        resident_id: data.residentId,
        project_id: resident.project_id,
        total_amount: data.totalAmount,
        count: data.count,
        frequency: data.frequency,
        start_date: data.startDate,
        description: data.description || null,
        created_by: context.userId,
      })
      .select()
      .single();
    if (serr) throw new Error(serr.message);

    const down = Math.min(data.downPayment ?? 0, data.totalAmount);
    const remaining = Math.max(0, data.totalAmount - down);
    const per = data.count > 0 ? Math.round((remaining / data.count) * 100) / 100 : 0;
    const rows: Array<Record<string, unknown>> = [];
    let acc = 0;
    let idx = 0;
    if (down > 0) {
      rows.push({
        resident_id: data.residentId,
        project_id: resident.project_id,
        amount: down,
        description: data.description ? `${data.description} — دفعة مقدمة` : `دفعة مقدمة`,
        due_date: new Date(data.startDate).toISOString(),
        schedule_id: sched.id,
        installment_index: 0,
        installments_total: data.count,
      });
      idx = 1;
    }
    for (let i = 0; i < data.count; i++) {
      const isLast = i === data.count - 1;
      const amt = isLast ? Math.round((remaining - acc) * 100) / 100 : per;
      acc += amt;
      const dueDate = addPeriod(new Date(data.startDate), data.frequency, i + (down > 0 ? 1 : 0));
      rows.push({
        resident_id: data.residentId,
        project_id: resident.project_id,
        amount: amt,
        description: data.description ? `${data.description} — قسط ${i + 1}/${data.count}` : `قسط ${i + 1}/${data.count}`,
        due_date: dueDate.toISOString(),
        schedule_id: sched.id,
        installment_index: i + 1,
        installments_total: data.count,
      });
      idx++;
    }
    const { error: ierr } = await supabaseAdmin.from("installments").insert(rows as never);
    if (ierr) throw new Error(ierr.message);
    return { ok: true, scheduleId: sched.id, created: rows.length };
  });

/** Resident adds a (partial) payment to an installment */
export const addInstallmentPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        installmentId: z.string().uuid(),
        amount: z.number().positive().max(1_000_000_000),
        receiptUrl: z.string().min(1),
        paidByName: z.string().min(1).max(255),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Verify caller owns the installment (resident) OR is staff
    const roles = await getRoles(context.userId);
    const isStaff = roles.some((r) => ["admin", "manager", "sales_manager", "sales", "accountant"].includes(r));
    if (!isStaff) {
      const { data: inst } = await supabaseAdmin
        .from("installments")
        .select("id, residents!inner(user_id)")
        .eq("id", data.installmentId)
        .maybeSingle();
      const ownerId = (inst as unknown as { residents?: { user_id?: string } } | null)?.residents?.user_id;
      if (ownerId !== context.userId) throw new Error("غير مصرح بإضافة دفعة لهذا القسط");
    }
    const { error } = await supabaseAdmin.from("installment_payments").insert({
      installment_id: data.installmentId,
      amount: data.amount,
      receipt_url: data.receiptUrl,
      paid_at: new Date().toISOString(),
      paid_by_name: data.paidByName,
      payment_status: "pending_confirmation",
      created_by: context.userId,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Confirm/reject a single payment (admin/manager/accountant) */
export const decideInstallmentPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        paymentId: z.string().uuid(),
        approve: z.boolean(),
        reason: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const roles = await getRoles(context.userId);
    if (!roles.some((r) => ["admin", "manager", "accountant"].includes(r))) {
      throw new Error("غير مصرح بتأكيد/رفض الدفعات");
    }
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();
    const update = data.approve
      ? {
          payment_status: "confirmed",
          confirmed_at: new Date().toISOString(),
          confirmed_by_name: profile?.full_name ?? null,
          rejection_reason: null,
        }
      : {
          payment_status: "rejected",
          rejection_reason: data.reason?.trim() || "غير محدد",
        };
    const { error } = await supabaseAdmin
      .from("installment_payments")
      .update(update as never)
      .eq("id", data.paymentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Delete a schedule and all its (still-unpaid) installments (admin/manager) */
export const deleteInstallmentSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ scheduleId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const roles = await getRoles(context.userId);
    if (!roles.some((r) => ["admin", "manager"].includes(r))) {
      throw new Error("غير مصرح");
    }
    // Delete only installments with no confirmed payments
    await supabaseAdmin
      .from("installments")
      .delete()
      .eq("schedule_id", data.scheduleId)
      .eq("paid_amount", 0 as never)
      .or("payment_status.is.null,payment_status.neq.confirmed");
    await supabaseAdmin.from("installment_schedules").delete().eq("id", data.scheduleId);
    return { ok: true };
  });

/** Update a single installment (amount/due_date/description) — staff only */
export const updateInstallment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        installmentId: z.string().uuid(),
        amount: z.number().positive().max(1_000_000_000).optional(),
        dueDate: z.string().min(1).optional(),
        description: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const roles = await getRoles(context.userId);
    if (!roles.some((r) => ["admin", "manager", "sales_manager", "accountant"].includes(r))) {
      throw new Error("غير مصرح بتعديل القسط");
    }
    const patch: Record<string, unknown> = {};
    if (data.amount != null) patch.amount = data.amount;
    if (data.dueDate) patch.due_date = new Date(data.dueDate).toISOString();
    if (data.description !== undefined) patch.description = data.description || null;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin
      .from("installments")
      .update(patch as never)
      .eq("id", data.installmentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Delete a single installment (admin/manager) */
export const deleteInstallment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ installmentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const roles = await getRoles(context.userId);
    if (!roles.some((r) => ["admin", "manager"].includes(r))) {
      throw new Error("غير مصرح بحذف القسط");
    }
    // Block delete if there are confirmed payments
    const { data: pays } = await supabaseAdmin
      .from("installment_payments")
      .select("id, payment_status")
      .eq("installment_id", data.installmentId);
    if ((pays ?? []).some((p) => p.payment_status === "confirmed")) {
      throw new Error("لا يمكن حذف قسط به دفعات مؤكدة");
    }
    await supabaseAdmin.from("installment_payments").delete().eq("installment_id", data.installmentId);
    const { error } = await supabaseAdmin.from("installments").delete().eq("id", data.installmentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Create a fully-customized installment sheet (rows defined by user). */
export const createCustomInstallmentSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        residentId: z.string().uuid(),
        frequency: z.enum(["weekly", "monthly", "quarterly", "biannual", "yearly", "custom"]),
        startDate: z.string().min(1),
        description: z.string().max(500).optional().default(""),
        installments: z
          .array(
            z.object({
              amount: z.number().positive().max(1_000_000_000),
              dueDate: z.string().min(1),
              description: z.string().max(500).optional().default(""),
              isDownPayment: z.boolean().optional().default(false),
            }),
          )
          .min(1)
          .max(600),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const roles = await getRoles(context.userId);
    if (!roles.some((r) => ["admin", "manager"].includes(r))) {
      throw new Error("غير مصرح بإنشاء جدول أقساط");
    }
    const { data: resident, error: rerr } = await supabaseAdmin
      .from("residents")
      .select("id, project_id")
      .eq("id", data.residentId)
      .maybeSingle();
    if (rerr) throw new Error(rerr.message);
    if (!resident?.project_id) throw new Error("الساكن غير مرتبط بمشروع");

    const total = data.installments.reduce((s, x) => s + x.amount, 0);
    const freqForSchedule = data.frequency === "custom" ? "monthly" : data.frequency;
    const { data: sched, error: serr } = await supabaseAdmin
      .from("installment_schedules")
      .insert({
        resident_id: data.residentId,
        project_id: resident.project_id,
        total_amount: total,
        count: data.installments.length,
        frequency: freqForSchedule,
        start_date: data.startDate,
        description: data.description || null,
        created_by: context.userId,
      })
      .select()
      .single();
    if (serr) throw new Error(serr.message);

    const nonDownCount = data.installments.filter((x) => !x.isDownPayment).length;
    let idx = 0;
    let nonDownIdx = 0;
    const rows = data.installments.map((row) => {
      const isDown = row.isDownPayment;
      const label = isDown
        ? row.description || "دفعة مقدمة"
        : row.description || `قسط ${++nonDownIdx}/${nonDownCount}`;
      return {
        resident_id: data.residentId,
        project_id: resident.project_id,
        amount: row.amount,
        description: data.description ? `${data.description} — ${label}` : label,
        due_date: new Date(row.dueDate).toISOString(),
        schedule_id: sched.id,
        installment_index: isDown ? 0 : ++idx,
        installments_total: nonDownCount,
      };
    });
    const { error: ierr } = await supabaseAdmin.from("installments").insert(rows as never);
    if (ierr) throw new Error(ierr.message);
    return { ok: true, scheduleId: sched.id, created: rows.length };
  });
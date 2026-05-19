import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STAFF_ROLES = ["admin", "manager", "sales_manager", "sales", "accountant"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

async function assertCallerIsAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r) => r.role);
  if (!roles.includes("admin") && !roles.includes("manager")) {
    throw new Error("غير مصرح: فقط الأدمن/المدير يقدر يقوم بهذا الإجراء");
  }
}

/**
 * Bootstrap the very first admin. Only works when there are zero users with the admin role.
 * After that the endpoint refuses to create new admins.
 */
export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        fullName: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { count, error: countError } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) > 0) {
      throw new Error("يوجد أدمن بالفعل. استخدم تسجيل الدخول.");
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (createErr || !created.user) throw new Error(createErr?.message || "فشل الإنشاء");

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "admin" });
    if (roleErr) throw new Error(roleErr.message);

    return { ok: true, userId: created.user.id };
  });

/** Create a staff member (admin/manager/sales_manager/sales/accountant) */
export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().min(1),
        role: z.enum(STAFF_ROLES),
        phone: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context.userId);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.name, phone: data.phone ?? null },
    });
    if (error || !created.user) throw new Error(error?.message || "فشل الإنشاء");

    const uid = created.user.id;
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: uid, full_name: data.name, phone: data.phone ?? null });

    const { error: empErr } = await supabaseAdmin
      .from("employees")
      .insert({ user_id: uid, name: data.name, is_active: true });
    if (empErr) throw new Error(empErr.message);

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: data.role as StaffRole });
    if (roleErr) throw new Error(roleErr.message);

    return { ok: true, userId: uid };
  });

/** Create a resident — creates auth user + resident row + 'resident' role */
export const createResident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        unitNumber: z.string().min(1),
        name: z.string().min(1),
        password: z.string().min(6),
        phone: z.string().optional(),
        projectId: z.string().uuid().nullable().optional(),
        unitPrice: z.number().nullable().optional(),
        unitLink: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Sales staff can also create residents
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const rolesList = (roles ?? []).map((r) => r.role);
    if (!rolesList.some((r) => ["admin", "manager", "sales_manager", "sales"].includes(r))) {
      throw new Error("غير مصرح بإنشاء سكان");
    }

    const email = `unit-${data.unitNumber.toLowerCase().replace(/[^a-z0-9]/g, "-")}@resident.local`;

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.name, phone: data.phone ?? null, unit_number: data.unitNumber },
    });
    if (error || !created.user) throw new Error(error?.message || "فشل إنشاء حساب الساكن");

    const uid = created.user.id;

    await supabaseAdmin.from("profiles").upsert({
      id: uid,
      full_name: data.name,
      phone: data.phone ?? null,
    });

    const { data: resident, error: resErr } = await supabaseAdmin
      .from("residents")
      .insert({
        user_id: uid,
        unit_number: data.unitNumber,
        name: data.name,
        phone: data.phone ?? null,
        project_id: data.projectId ?? null,
        unit_price: data.unitPrice ?? null,
        unit_link: data.unitLink ?? null,
      })
      .select()
      .single();
    if (resErr) throw new Error(resErr.message);

    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "resident" });

    return { ok: true, residentId: resident.id, email };
  });

/** Reset password for a staff or resident user (admin/manager only) */
export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), newPassword: z.string().min(6) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Delete a user (cascade through profiles/residents/employees via FK) */
export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Confirm or reject an installment payment (admin/manager/accountant only) */
export const decideInstallment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        installmentId: z.string().uuid(),
        approve: z.boolean(),
        reason: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const rolesList = (roles ?? []).map((r) => r.role);
    if (!rolesList.some((r) => ["admin", "manager", "accountant"].includes(r))) {
      throw new Error("غير مصرح بتأكيد/رفض الأقساط");
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    const update = data.approve
      ? {
          payment_status: "confirmed" as const,
          confirmed_at: new Date().toISOString(),
          confirmed_by_name: profile?.full_name ?? null,
          rejection_reason: null,
        }
      : {
          payment_status: "rejected" as const,
          rejection_reason: data.reason?.trim() || "غير محدد",
        };

    const { error } = await supabaseAdmin
      .from("installments")
      .update(update)
      .eq("id", data.installmentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function assertCallerHasRoles(userId: string, allowed: readonly string[]) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const has = (data ?? []).some((r) => allowed.includes(r.role));
  if (!has) throw new Error("غير مصرح");
}

/** Create installment (admin/manager/sales_manager) */
export const createInstallment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        resident_id: z.string().uuid(),
        project_id: z.string().uuid(),
        amount: z.number().positive().max(100000000),
        description: z.string().max(2000).optional().default(""),
        due_date: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCallerHasRoles(context.userId, ["admin", "manager", "sales_manager"]);
    const { error } = await supabaseAdmin.from("installments").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Update maintenance request status (staff only) */
export const updateRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["open", "in_progress", "completed"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCallerHasRoles(context.userId, [...STAFF_ROLES]);
    const { error } = await supabaseAdmin
      .from("maintenance_requests")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ProjectInput = z.object({
  name_ar: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#1d4ed8"),
  total_units: z.number().int().min(0).max(100000).default(0),
});

/** Create/Update/Delete projects (admin/manager only) */
export const upsertProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid().optional(), values: ProjectInput }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCallerHasRoles(context.userId, ["admin", "manager"]);
    if (data.id) {
      const { error } = await supabaseAdmin.from("projects").update(data.values).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("projects").insert(data.values);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerHasRoles(context.userId, ["admin", "manager"]);
    const { error } = await supabaseAdmin.from("projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
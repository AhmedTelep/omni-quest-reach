#!/usr/bin/env node
/**
 * backup-all.mjs
 * ينزّل كل بيانات المشروع من Supabase (جداول + ملفات Storage) في مجلد واحد.
 *
 * التشغيل:
 *   SUPABASE_URL="https://xxxx.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
 *   node scripts/backup-all.mjs
 *
 * الناتج:
 *   ./backup/
 *     ├── tables/<table>.json
 *     └── storage/<bucket>/<path...>
 */

import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ لازم تحدد SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في environment");
  process.exit(1);
}

const OUT = "./backup";
const TABLES = [
  "announcements",
  "employees",
  "installments",
  "installment_payments",
  "installment_schedules",
  "maintenance_requests",
  "notifications",
  "notification_dedup",
  "profiles",
  "projects",
  "residents",
  "services",
  "units",
  "user_roles",
];
const BUCKETS = ["receipts", "request-images", "project-logos", "project-images"];
const PAGE = 1000;

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function dumpTable(name) {
  const all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from(name)
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`[${name}] ${error.message}`);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  const path = join(OUT, "tables", `${name}.json`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(all, null, 2), "utf8");
  console.log(`📄 ${name}: ${all.length} صف`);
}

async function listAll(bucket, prefix = "") {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb.storage
      .from(bucket)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`[${bucket}/${prefix}] ${error.message}`);
    if (!data?.length) break;
    for (const it of data) {
      const p = prefix ? `${prefix}/${it.name}` : it.name;
      if (it.id === null || it.metadata === null) {
        // مجلد
        out.push(...(await listAll(bucket, p)));
      } else {
        out.push(p);
      }
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

async function dumpBucket(bucket) {
  const files = await listAll(bucket);
  for (const f of files) {
    const { data, error } = await sb.storage.from(bucket).download(f);
    if (error) {
      console.warn(`⚠️  ${bucket}/${f}: ${error.message}`);
      continue;
    }
    const path = join(OUT, "storage", bucket, f);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.from(await data.arrayBuffer()));
  }
  console.log(`🗂️  ${bucket}: ${files.length} ملف`);
}

console.log("🚀 بدء التحميل...\n");
console.log("📊 الجداول:");
for (const t of TABLES) {
  try { await dumpTable(t); }
  catch (e) { console.error(`❌ ${t}: ${e.message}`); }
}
console.log("\n📦 الـ Storage:");
for (const b of BUCKETS) {
  try { await dumpBucket(b); }
  catch (e) { console.error(`❌ ${b}: ${e.message}`); }
}
console.log(`\n✅ خلص! كل حاجة في ${OUT}/`);
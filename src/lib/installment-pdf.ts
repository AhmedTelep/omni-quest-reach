// Open a print-friendly Arabic receipt window. The user can save as PDF via
// the browser's "Save as PDF" option in the print dialog (Ctrl/Cmd+P).

export type ReceiptData = {
  installmentSerial: string;
  paymentSerial?: string | null;
  residentName: string;
  unitNumber: string;
  projectName?: string | null;
  projectLogo?: string | null;
  installmentAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentAmount?: number | null;
  paidAt?: string | null;
  confirmedAt?: string | null;
  confirmedByName?: string | null;
  paidByName?: string | null;
  description?: string | null;
  dueDate?: string | null;
};

function fmt(n: number) {
  return new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(n) + " ج.م";
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG");
}

export function openReceiptPdf(r: ReceiptData) {
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) {
    alert("يرجى السماح بفتح النوافذ المنبثقة لتحميل الإيصال");
    return;
  }
  const html = `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<title>إيصال تأكيد دفع ${r.installmentSerial}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Cairo','Tahoma','Arial',sans-serif;margin:0;padding:32px;color:#111;background:#fff}
  .wrap{max-width:720px;margin:0 auto;border:2px solid #1d4ed8;border-radius:12px;padding:28px;background:#fff}
  .head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e5e7eb;padding-bottom:16px;margin-bottom:20px}
  .head .logo{max-height:64px;max-width:160px;object-fit:contain}
  .title{font-size:22px;font-weight:800;color:#1d4ed8;margin:0}
  .sub{font-size:13px;color:#6b7280;margin-top:4px}
  .serial-box{background:#eff6ff;border:1px dashed #1d4ed8;border-radius:8px;padding:10px 14px;text-align:center;margin-bottom:18px}
  .serial-box .lbl{font-size:11px;color:#1d4ed8}
  .serial-box .val{font-size:18px;font-weight:800;letter-spacing:1px;font-family:monospace;color:#1d4ed8}
  table{width:100%;border-collapse:collapse;margin-bottom:14px}
  td{padding:9px 8px;border-bottom:1px solid #f1f5f9;font-size:14px}
  td.k{color:#6b7280;width:38%}
  td.v{font-weight:600;text-align:end}
  .amount{font-size:28px;font-weight:800;color:#059669;text-align:center;padding:18px;background:#ecfdf5;border-radius:10px;margin:16px 0}
  .totals{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:10px 0}
  .totals .cell{background:#f8fafc;border-radius:8px;padding:10px;text-align:center}
  .totals .lbl{font-size:11px;color:#6b7280}
  .totals .val{font-size:16px;font-weight:700;margin-top:4px}
  .footer{margin-top:24px;display:flex;justify-content:space-between;align-items:flex-end;border-top:2px dashed #e5e7eb;padding-top:16px;font-size:12px;color:#6b7280}
  .stamp{border:2px solid #059669;color:#059669;border-radius:50%;width:110px;height:110px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;transform:rotate(-12deg)}
  @media print{ body{padding:0} .wrap{border:none} .noprint{display:none} button{display:none} }
  .bar{text-align:center;margin-top:18px}
  button{background:#1d4ed8;color:#fff;border:0;padding:10px 22px;border-radius:8px;font-size:14px;cursor:pointer;font-family:inherit}
</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <div>
      <h1 class="title">إيصال تأكيد دفع</h1>
      <div class="sub">${r.projectName ?? ""}</div>
    </div>
    ${r.projectLogo ? `<img class="logo" src="${r.projectLogo}" alt="logo">` : ""}
  </div>

  <div class="serial-box">
    <div class="lbl">رقم القسط</div>
    <div class="val">${r.installmentSerial}</div>
    ${r.paymentSerial ? `<div class="lbl" style="margin-top:8px">رقم الدفعة</div><div class="val">${r.paymentSerial}</div>` : ""}
  </div>

  <table>
    <tr><td class="k">اسم الساكن</td><td class="v">${r.residentName}</td></tr>
    <tr><td class="k">رقم الوحدة</td><td class="v">${r.unitNumber}</td></tr>
    ${r.description ? `<tr><td class="k">وصف القسط</td><td class="v">${r.description}</td></tr>` : ""}
    ${r.dueDate ? `<tr><td class="k">تاريخ الاستحقاق</td><td class="v">${fmtDate(r.dueDate)}</td></tr>` : ""}
    <tr><td class="k">تاريخ الدفع</td><td class="v">${fmtDate(r.paidAt)}</td></tr>
    ${r.paidByName ? `<tr><td class="k">المُسدد بواسطة</td><td class="v">${r.paidByName}</td></tr>` : ""}
    ${r.confirmedAt ? `<tr><td class="k">تاريخ التأكيد</td><td class="v">${fmtDate(r.confirmedAt)}</td></tr>` : ""}
    ${r.confirmedByName ? `<tr><td class="k">المؤكِّد</td><td class="v">${r.confirmedByName}</td></tr>` : ""}
  </table>

  ${r.paymentAmount != null ? `<div class="amount">${fmt(r.paymentAmount)}</div>` : ""}

  <div class="totals">
    <div class="cell"><div class="lbl">قيمة القسط</div><div class="val">${fmt(r.installmentAmount)}</div></div>
    <div class="cell"><div class="lbl">إجمالي المدفوع</div><div class="val" style="color:#059669">${fmt(r.paidAmount)}</div></div>
    <div class="cell"><div class="lbl">المتبقي</div><div class="val" style="color:${r.remainingAmount > 0 ? "#dc2626" : "#059669"}">${fmt(Math.max(0, r.remainingAmount))}</div></div>
  </div>

  <div class="footer">
    <div>
      تم إصدار هذا الإيصال إلكترونياً<br>
      تاريخ الإصدار: ${new Date().toLocaleString("ar-EG")}
    </div>
    ${r.confirmedAt ? `<div class="stamp">مدفوع</div>` : ""}
  </div>
</div>

<div class="bar noprint">
  <button onclick="window.print()">طباعة / حفظ PDF</button>
</div>

<script>
  window.addEventListener('load', () => { setTimeout(() => window.print(), 400); });
</script>
</body>
</html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
// DOT MEC (Medical Examiner's Certificate) expiration-reminder email content.
export function buildMecReminderEmail(opts: {
  driverName: string;
  companyName: string;
  expiresOn: Date;
  daysUntil: number;
  audience: "company" | "driver";
}): { subject: string; html: string; text: string } {
  const dateStr = opts.expiresOn.toLocaleDateString();
  const expired = opts.daysUntil < 0;
  const window = expired ? "has EXPIRED" : `expires in ${opts.daysUntil} day${opts.daysUntil === 1 ? "" : "s"}`;
  const subject = expired
    ? `ACTION NEEDED: DOT medical certificate expired — ${opts.driverName}`
    : `Reminder: DOT medical certificate ${window} — ${opts.driverName}`;

  const lead = opts.audience === "company"
    ? `The DOT Medical Examiner's Certificate (MCSA-5876) for your driver <strong>${opts.driverName}</strong> ${window} (${dateStr}).`
    : `Your DOT Medical Examiner's Certificate (MCSA-5876) ${window} (${dateStr}).`;
  const cta = expired
    ? "Please schedule a re-certification DOT physical as soon as possible — driving on an expired certificate is not permitted."
    : "Please schedule a re-certification DOT physical before the expiration date to stay compliant.";

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto">
      <div style="background:${expired ? "#b91c1c" : "#1e4fd8"};color:#fff;padding:18px 22px;border-radius:12px 12px 0 0">
        <h2 style="margin:0;font-size:18px">ProactiveClinics — Occupational Health</h2>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:22px">
        <p style="margin:0 0 12px">${lead}</p>
        <p style="margin:0 0 12px;color:#334155">${cta}</p>
        <p style="margin:0;color:#64748b;font-size:13px">Company: ${opts.companyName}<br/>Certificate expiration: <strong>${dateStr}</strong></p>
      </div>
    </div>`;
  const text = `${lead.replace(/<[^>]+>/g, "")}\n\n${cta}\n\nCompany: ${opts.companyName}\nExpiration: ${dateStr}`;
  return { subject, html, text };
}

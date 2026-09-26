import webpush from "web-push";
import { claimAlarmBlock, clearAlarmBlock, deleteDeviceAlarm, deviceId, getAlarmBlock, getAllDeviceAlarms, inQuietHours, istanbulParts, saveDeviceAlarm, type DeviceAlarm } from "../../../../lib/background-push";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_SUBJECT) {
    return Response.json({ error: "VAPID ortam değişkenleri eksik." }, { status: 503 });
  }
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return Response.json({ error: "Redis ortam değişkenleri eksik." }, { status: 503 });
  }

  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const now = new Date();
  const local = istanbulParts(now);
  if (inQuietHours(now)) return Response.json({ ok: true, quietHours: true });

  const rawRecords = await getAllDeviceAlarms();
  let sent = 0;
  let stale = 0;
  for (const raw of rawRecords) {
    let record: DeviceAlarm;
    try { record = JSON.parse(raw) as DeviceAlarm; } catch { continue; }
    const id = deviceId(record.subscription.endpoint);

    if (local.time >= "08:00" && record.resetDate !== local.date) {
      record = { ...record, resetDate: local.date };
      await saveDeviceAlarm(id, record);
      await clearAlarmBlock(id);
    }
    if (await getAlarmBlock(id)) continue;

    const due = [...record.reminders]
      .filter((reminder) => {
        const at = Date.parse(reminder.at);
        const delay = now.getTime() - at;
        return delay >= 0 && delay <= 5 * 60 * 1000;
      })
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0];
    if (!due) continue;

    if (!await claimAlarmBlock(id, due.id)) continue;
    try {
      await webpush.sendNotification(record.subscription as webpush.PushSubscription, JSON.stringify({
        title: `${due.medicine} zamanı`,
        body: "1 damla uygulama zamanı. Bildirime dokunarak uygulamada işaretleyebilirsin.",
        tag: due.id,
        reminderId: due.id,
      }), { TTL: 60 * 60 });
      sent += 1;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await deleteDeviceAlarm(id);
        await clearAlarmBlock(id);
        stale += 1;
      } else {
        await clearAlarmBlock(id);
      }
    }
  }

  return Response.json({ ok: true, checked: rawRecords.length, sent, stale });
}

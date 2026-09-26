import { assertSameOrigin, clearAlarmBlock, deviceId, ensureMinuteSchedule, getAlarmBlock, getDeviceAlarm, saveDeviceAlarm, type DeviceAlarm, type PushReminder, type PushSubscriptionData } from "../../../../lib/background-push";

export const runtime = "nodejs";

function validSubscription(value: unknown): value is PushSubscriptionData {
  if (!value || typeof value !== "object") return false;
  const subscription = value as Partial<PushSubscriptionData>;
  return typeof subscription.endpoint === "string"
    && subscription.endpoint.startsWith("https://")
    && typeof subscription.keys?.auth === "string"
    && typeof subscription.keys?.p256dh === "string";
}

function validReminder(value: unknown): value is PushReminder {
  if (!value || typeof value !== "object") return false;
  const reminder = value as Partial<PushReminder>;
  return typeof reminder.id === "string" && reminder.id.length <= 160
    && ["Navitae", "Moxidexa", "Lotemax"].includes(reminder.medicine ?? "")
    && typeof reminder.at === "string" && Number.isFinite(Date.parse(reminder.at));
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json() as { subscription?: unknown; reminders?: unknown; completedIds?: unknown };
    if (!validSubscription(body.subscription) || !Array.isArray(body.reminders) || body.reminders.length > 200
      || !body.reminders.every(validReminder) || !Array.isArray(body.completedIds)
      || !body.completedIds.every((id) => typeof id === "string" && id.length <= 160)) {
      return Response.json({ error: "Bildirim aboneliği veya alarm listesi geçersiz." }, { status: 400 });
    }

    const id = deviceId(body.subscription.endpoint);
    const previousRaw = await getDeviceAlarm(id);
    const previous = previousRaw ? JSON.parse(previousRaw) as DeviceAlarm : null;
    const completed = body.completedIds as string[];
    const record: DeviceAlarm = {
      subscription: body.subscription,
      reminders: body.reminders as PushReminder[],
      resetDate: previous?.resetDate ?? null,
    };
    await saveDeviceAlarm(id, record);
    const blockedReminderId = await getAlarmBlock(id);
    if (blockedReminderId && completed.includes(blockedReminderId)) await clearAlarmBlock(id);
    await ensureMinuteSchedule(request.url);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Arka plan alarmı kurulamadı.";
    const status = message.includes("ortam değişkeni eksik") ? 503 : message.startsWith("Bu istek") ? 403 : 502;
    return Response.json({ error: message }, { status });
  }
}

import { createHash } from "node:crypto";

export type PushSubscriptionData = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

export type PushReminder = { id: string; medicine: string; at: string };

export type DeviceAlarm = {
  subscription: PushSubscriptionData;
  reminders: PushReminder[];
  resetDate: string | null;
};

const devicesKey = "damla-alarmi:devices";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} ortam değişkeni eksik.`);
  return value;
}

export async function redisCommand<T>(...command: (string | number)[]): Promise<T> {
  const response = await fetch(requiredEnv("UPSTASH_REDIS_REST_URL"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnv("UPSTASH_REDIS_REST_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const payload = await response.json() as { result?: T; error?: string };
  if (!response.ok || payload.error) throw new Error(payload.error ?? "Redis isteği başarısız oldu.");
  return payload.result as T;
}

export function deviceId(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}

export async function getDeviceAlarm(id: string) {
  return redisCommand<string | null>("HGET", devicesKey, id);
}

export async function saveDeviceAlarm(id: string, value: DeviceAlarm) {
  await redisCommand("HSET", devicesKey, id, JSON.stringify(value));
}

export async function getAllDeviceAlarms() {
  const result = await redisCommand<string[]>("HVALS", devicesKey);
  return result ?? [];
}

export async function deleteDeviceAlarm(id: string) {
  await redisCommand("HDEL", devicesKey, id);
}

function blockKey(id: string) { return `damla-alarmi:blocked:${id}`; }

export async function getAlarmBlock(id: string) {
  return redisCommand<string | null>("GET", blockKey(id));
}

export async function claimAlarmBlock(id: string, reminderId: string) {
  return (await redisCommand<string | null>("SET", blockKey(id), reminderId, "NX", "EX", 172800)) === "OK";
}

export async function clearAlarmBlock(id: string) {
  await redisCommand("DEL", blockKey(id));
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
    throw new Error("Bu istek yalnızca uygulamanın kendi adresinden kabul edilir.");
  }
}

export async function ensureMinuteSchedule(requestUrl: string) {
  const token = requiredEnv("QSTASH_TOKEN");
  const secret = requiredEnv("CRON_SECRET");
  const destination = new URL("/api/push/tick", requestUrl).toString();
  if (!destination.startsWith("https://") || /localhost|127\.0\.0\.1/.test(new URL(destination).hostname)) {
    throw new Error("Arka plan alarmı için yayınlanmış HTTPS adresini kullan.");
  }
  const qstashUrl = (process.env.QSTASH_URL || "https://qstash.upstash.io").replace(/\/$/, "");
  const response = await fetch(`${qstashUrl}/v2/schedules/${encodeURIComponent(destination)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Upstash-Cron": "* * * * *",
      "Upstash-Schedule-Id": `damla-alarmi-minute-${createHash("sha256").update(destination).digest("hex").slice(0, 16)}`,
      "Upstash-Method": "GET",
      "Upstash-Retries": "1",
      "Upstash-Forward-Authorization": `Bearer ${secret}`,
      "Upstash-Label": "damla-alarmi-minute-tick",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`QStash zamanlayıcısı kurulamadı (${response.status}): ${detail.slice(0, 200)}`);
  }
}

export function istanbulParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function inQuietHours(date = new Date()) {
  const hour = Number(istanbulParts(date).time.slice(0, 2));
  return hour >= 2 && hour < 8;
}

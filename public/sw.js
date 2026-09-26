self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => {
  const payload = event.data?.json() ?? {};
  event.waitUntil(self.registration.showNotification(payload.title ?? "Damla Alarmı", {
    body: payload.body ?? "Damla zamanı.",
    icon: "/icon.svg",
    tag: payload.tag ?? "damla-alarmi",
    requireInteraction: true,
    renotify: true,
    vibrate: [800, 300, 800, 300, 1200],
    data: { reminderId: payload.reminderId },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const reminderId = event.notification.data?.reminderId;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    const url = new URL("/", self.location.origin);
    if (reminderId) url.searchParams.set("markReminder", reminderId);
    const client = clients[0];
    if (!client) return self.clients.openWindow(url.href);
    if (reminderId) client.postMessage({ type: "DOSE_ALARM_ACK", reminderId });
    return client.focus();
  }));
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => {
  const payload = event.data?.json() ?? {};
  event.waitUntil(self.registration.showNotification(payload.title ?? "Damla Alarmı", {
    body: payload.body ?? "Damla zamanı.",
    icon: "/icon.svg",
    tag: payload.tag ?? "damla-alarmi",
    requireInteraction: true,
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const client = clients[0];
    return client ? client.focus() : self.clients.openWindow("/");
  }));
});

/* Service Worker chuẩn PWA cho Cổng Vận hành YoFaSo Shop (Web Push VAPID + Deep Link Click) */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Thông báo mới từ YoFaSo Shop",
    body: "Bạn có một cập nhật vận hành mới.",
    link: "/",
    type: "HE_THONG",
    notificationId: null,
    icon: "/brand/YoFaSo_logo.png",
    badge: "/brand/YoFaSo_logo.png",
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon || "/brand/YoFaSo_logo.png",
    badge: payload.badge || "/brand/YoFaSo_logo.png",
    tag: payload.notificationId || payload.type || "yofaso-staff",
    renotify: true,
    vibrate: [150, 80, 150],
    data: {
      link: payload.link || "/",
      notificationId: payload.notificationId || null,
      type: payload.type || "HE_THONG",
    },
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const rawLink = typeof data.link === "string" && data.link.startsWith("/") ? data.link : "/";
  const targetUrl = new URL(rawLink, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.postMessage({
            type: "YOFASO_NOTIFICATION_CLICK",
            link: rawLink,
            notificationId: data.notificationId || null,
          });
          if ("navigate" in client && client.url !== targetUrl) {
            return client.navigate(targetUrl).then(() => client.focus()).catch(() => client.focus());
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});

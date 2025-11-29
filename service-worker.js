self.addEventListener("push", event => {
  let data = { title: "iSkool", body: "New update available!", url: "/" };
  try {
    if (event.data) {
      const jsonData = event.data.json();
      if (jsonData.title && jsonData.body) {
        data = jsonData;
      }
    }
  } catch (err) {
    console.error("Push event data parse error:", err);
  }

  const options = {
    body: data.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url },
    tag: "iSkool-notification", // Groups notifications
    renotify: true, // Replaces previous notification if same tag
    vibrate: [200, 100, 200], // WhatsApp-like vibration
    actions: [
      { action: "open", title: "Open iSkool", icon: "/icons/icon-192.png" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Update click event to handle actions
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});
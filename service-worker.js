self.addEventListener("push", event => {
  // Default values
  let data = { title: "iSkool", body: "New update available!", url: "/" };
  
  try {
    if (event.data) {
      const jsonData = event.data.json();
      
      // Update: Check for the URL inside the 'data' object OR at the root
      data.title = jsonData.title || data.title;
      data.body = jsonData.body || data.body;
      
      // This line ensures we grab the Deep Link we sent from PHP
      data.url = (jsonData.data && jsonData.data.url) ? jsonData.data.url : (jsonData.url || "/");
    }
  } catch (err) {
    console.error("Push event data parse error:", err);
  }

  const options = {
    body: data.body,
    icon: "/icons/icon-192.png", // Ensure this path is correct for your site
    badge: "/icons/icon-192.png",
    data: { url: data.url }, // This stores the URL for the click event below
    tag: "iSkool-notification",
    renotify: true,
    vibrate: [200, 100, 200],
    actions: [
      { action: "open", title: "Open iSkool" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener("notificationclick", event => {
    event.notification.close();
    
    // 1. Fallback to root if URL is missing
    const targetUrl = (event.notification.data && event.notification.data.url) 
                      ? event.notification.data.url 
                      : "/learner_dashboard.php";

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
            // 2. Check if the app is already open
            for (const client of clientList) {
                // If we find an open window, navigate it to the deep link and focus
                if ("navigate" in client && "focus" in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }

            // 3. If no window is open, open a new one
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
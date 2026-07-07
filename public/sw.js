// RosterHouse service worker.
// Two jobs: web push (shipped first — the push and notificationclick handlers
// below must keep working) and a small offline cache so the employee app
// still opens without a connection.

const SW_VERSION = "v2";
const CACHE_NAME = "rosterhouse-" + SW_VERSION;
// Only the public offline page is precached. Authenticated pages are NEVER
// cached: the Cache API outlives the session, so on a shared device a cached
// /shifts or /profile would leak one employee's data to the next.
const PRECACHE_URLS = ["/offline"];

// ---- Push (do not break: PushDeviceSetup subscribes against this) ----

self.addEventListener("push", function (event) {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, { body: data.body })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate("/notifications");
            return client.focus();
          }
        }
        return clients.openWindow("/notifications");
      })
  );
});

// ---- Offline cache ----

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function (cache) {
        // Best-effort precache: one failing URL must not block the install.
        // fetch + verify instead of cache.add — a redirected response (e.g.
        // middleware bouncing to /login) must not be pinned under the URL,
        // since browsers reject redirected responses for later navigations.
        return Promise.allSettled(
          PRECACHE_URLS.map(function (url) {
            return fetch(url).then(function (response) {
              if (response && response.ok && !response.redirected) {
                return cache.put(url, response);
              }
            });
          })
        );
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key !== CACHE_NAME;
            })
            .map(function (key) {
              return caches.delete(key);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

// Navigations go to the network; when it's unreachable, show the offline
// page. Page HTML is deliberately never cached — it's authenticated content
// (schedules, wages, the calendar feed link) and the Cache API has no notion
// of who is signed in.
function networkFirstNavigation(request) {
  return fetch(request).catch(function () {
    return caches.match("/offline").then(function (offline) {
      return (
        offline ||
        new Response("You're offline. Try again when you're back online.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
      );
    });
  });
}

// Stale-while-revalidate for immutable hashed assets and the app icons.
function staleWhileRevalidate(request) {
  return caches.open(CACHE_NAME).then(function (cache) {
    return cache.match(request).then(function (cached) {
      const refresh = fetch(request)
        .then(function (response) {
          if (response && response.ok) {
            cache.put(request, response.clone()).catch(function () {});
          }
          return response;
        })
        .catch(function () {
          return undefined;
        });
      if (cached) return cached;
      return refresh.then(function (response) {
        return response || Response.error();
      });
    });
  });
}

self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never intercept API traffic — always live.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon")
  ) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

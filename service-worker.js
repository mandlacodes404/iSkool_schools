/* iSkool learner offline-support service worker. */
const STATIC_CACHE = 'iskool-static-v2';
const CONTENT_CACHE = 'iskool-content-v2';
const NETWORK_CACHE = 'iskool-network-v2';
const QUEUE_DB = 'iskool-offline-writes-v1';
const QUEUE_STORE = 'requests';
const SYNC_TAG = 'iskool-retry-writes';

const APP_SHELL = [
    '/', '/icon.svg?v=1.4', '/manifest.php?v=1.1',
    '/assets/css/learner/quiz.css?v=5.4', '/assets/css/learner/manual.css?v=7.3',
    '/assets/css/learner/announcements.css?v=2.5', '/assets/css/learner/assignments.css?v=2.5',
    '/assets/css/learner/grades.css?v=2.9', '/assets/css/learner/resources.css?v=2.0',
    '/assets/css/learner/evaluations.css?v=4.0', '/assets/css/learner/learner_dashboard.css?v=10.2',
    '/assets/js/learner/main.js?v=1.2', '/assets/js/learner/manual.js?v=10.10',
    '/assets/js/learner/quiz.js?v=11.1', '/assets/js/learner/assignments.js?v=9.5',
    '/assets/js/learner/resources.js?v=8.3', '/assets/js/learner/announcements.js?v=8.9',
    '/assets/js/learner/grades.js?v=8.8', '/assets/js/learner/evaluations.js?v=6.7',
    '/assets/js/learner/discussions.js?v=10.8', '/assets/js/learner/syllabus.js?v=3.6',
    '/assets/js/learner/learner_calendar.js?v=2.3'
];

const STALE_WHILE_REVALIDATE_PATHS = new Set([
    '/api/learner/get_home_data.php', '/api/learner/get_my_class.php',
    '/api/learner/get_resources.php', '/api/learner/get_sbo.php'
]);
const NETWORK_FIRST_PATHS = new Set([
    '/learner_dashboard.php', '/api/learner/get_quizzes.php',
    '/api/learner/get_quiz_instructions.php', '/api/learner/get_assignments.php',
    '/api/learner/get_announcements.php', '/api/learner/get_grades.php',
    '/api/learner/get_progress_report.php', '/api/learner/get_evaluations.php',
    '/api/learner/get_discussions.php', '/api/learner/get_discussion_thread.php',
    '/api/learner/get_new_replies.php', '/api/learner/get_calendar_events.php',
    '/api/learner/get_learner_profile.php', '/get_quiz_stats.php',
    '/get_quiz_review.php', '/review_quiz.php', '/api/learner/get_session_identity.php'
]);
const NETWORK_ONLY_PATHS = new Set([
    '/take_quiz.php', '/save_progress.php', '/submit_quiz.php', '/submit_assignment.php',
    '/api/learner/submit_evaluation.php', '/api/learner/create_discussion.php',
    '/api/learner/submit_reply.php', '/api/learner/submit_discussion_report.php',
    '/api/learner/save_learner_profile.php', '/api/learner/join_class.php',
    '/upload_profile.php', '/subscribe_push.php', '/logout.php',
    '/api/set_typing.php', '/api/get_typing.php'
]);
// Reports, logout, profile updates, and class changes deliberately never queue.
const QUEUEABLE_WRITE_PATHS = new Set([
    '/save_progress.php', '/submit_quiz.php', '/submit_assignment.php',
    '/api/learner/submit_evaluation.php', '/api/learner/create_discussion.php',
    '/api/learner/submit_reply.php'
]);

self.addEventListener('install', event => {
    event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll(APP_SHELL)).then(async () => {
        const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        if (clientList.length === 0) return self.skipWaiting();
        clientList.forEach(client => client.postMessage({ type: 'iskool-update-available' }));
    }));
});

self.addEventListener('message', event => {
    if (event.data?.type === 'iskool-skip-waiting') self.skipWaiting();
    if (event.data?.type === 'iskool-replay-queued-writes') event.waitUntil(replayQueuedWrites());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names.filter(name => name.startsWith('iskool-') && ![STATIC_CACHE, CONTENT_CACHE, NETWORK_CACHE].includes(name)).map(name => caches.delete(name)));
        await self.clients.claim();
        await replayQueuedWrites();
    })());
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET') {
        if (url.origin === self.location.origin && url.pathname === '/logout.php') {
            event.respondWith(fetch(request).then(async response => {
                await Promise.all([clearQueuedWrites(), clearLearnerDataCaches()]);
                return response;
            }));
        } else {
            event.respondWith(handleWrite(request, url.pathname));
        }
        return;
    }
    if (url.origin !== self.location.origin && !isThirdPartyStatic(url)) return;
    if (request.mode === 'navigate' && isShellNavigationRoute(url.pathname)) {
        // The splash/login shell document. Prefer the network so a signed-in
        // learner always gets the live server-side redirect to the dashboard,
        // but fall back to the precached shell if there is no connection at
        // all, instead of leaving the browser's own offline error on screen.
        event.respondWith(networkFirst(request, STATIC_CACHE));
    } else if (NETWORK_ONLY_PATHS.has(url.pathname) || isAuthenticationRoute(url.pathname)) {
        if (url.origin === self.location.origin && isAuthenticationRoute(url.pathname)) event.waitUntil(clearLearnerDataCaches());
        event.respondWith(fetch(request));
    } else if (isStaticAsset(url)) {
        event.respondWith(cacheFirst(request, STATIC_CACHE));
    } else if (STALE_WHILE_REVALIDATE_PATHS.has(url.pathname)) {
        event.respondWith(staleWhileRevalidate(request, CONTENT_CACHE));
    } else if (NETWORK_FIRST_PATHS.has(url.pathname)) {
        event.respondWith(networkFirst(request, NETWORK_CACHE));
    }
});

self.addEventListener('sync', event => {
    if (event.tag === SYNC_TAG) event.waitUntil(replayQueuedWrites());
});

self.addEventListener('push', event => {
    let data = { title: 'iSkool', body: 'New update available!', url: '/', icon: '/icons/icon-192.png', tag: `iskool-${Date.now()}` };
    try {
        if (event.data) {
            const jsonData = event.data.json();
            data.title = jsonData.title || data.title;
            data.body = jsonData.body || data.body;
            data.icon = jsonData.icon || jsonData.data?.icon || data.icon;
            data.tag = jsonData.tag || jsonData.data?.tag || data.tag;
            data.url = jsonData.data?.url || jsonData.url || '/';
        }
    } catch (error) { console.error('Push event data parse error:', error); }
    event.waitUntil(self.registration.showNotification(data.title, {
        body: data.body, icon: data.icon, badge: '/icons/icon-192.png', data: { url: data.url },
        tag: data.tag, renotify: true, vibrate: [200, 100, 200], actions: [{ action: 'open', title: 'Open iSkool' }]
    }));
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/learner_dashboard.php';
    event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        for (const client of clientList) {
            if ('navigate' in client && 'focus' in client) return client.navigate(targetUrl).catch(() => client).then(windowClient => windowClient.focus());
        }
        return clients.openWindow ? clients.openWindow(targetUrl) : undefined;
    }));
});

function isAuthenticationRoute(pathname) {
    return pathname === '/index.php' || pathname === '/dashboard.php' || pathname.startsWith('/auth/');
}
function isShellNavigationRoute(pathname) {
    // Only the precached root document falls back to cache when offline.
    // Direct requests to /index.php, /dashboard.php, and /auth/* (actual
    // login/session actions) stay strictly network-only via
    // isAuthenticationRoute above — a failed auth action should fail
    // loudly, not silently serve cached HTML.
    return pathname === '/';
}
function isThirdPartyStatic(url) {
    return ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'].includes(url.hostname);
}
function isStaticAsset(url) {
    return isThirdPartyStatic(url) || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') ||
        url.pathname.startsWith('/resources/') || url.pathname === '/icon.svg' || url.pathname === '/manifest.php' || url.pathname === '/partials/manual.html';
}
async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') await cache.put(request, response.clone());
    return response;
}
async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    const refresh = fetch(request).then(async response => {
        if (response.ok) await cache.put(request, response.clone());
        return response;
    });
    if (cached) { refresh.catch(() => {}); return cached; }
    return refresh;
}
async function networkFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
    } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw error;
    }
}
async function handleWrite(request, pathname) {
    try {
        return await fetch(request);
    } catch (error) {
        if (!QUEUEABLE_WRITE_PATHS.has(pathname)) throw error;
        await queueRequest(request);
        await registerSync();
        return queuedResponse(request);
    }
}
function queuedResponse(request) {
    if (request.mode === 'navigate') {
        return new Response('<!doctype html><title>Submission queued</title><meta name="viewport" content="width=device-width, initial-scale=1"><body style="font-family:sans-serif;padding:2rem;background:#0d1117;color:#e2e8f0"><h1>Submission saved offline</h1><p>iSkool will send it automatically when you are back online. Keep this device signed in until it has sent.</p></body>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    return new Response(JSON.stringify({ success: false, queued: true, message: 'Saved offline. It will send automatically when you are back online.' }), { status: 202, headers: { 'Content-Type': 'application/json' } });
}
function openQueueDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(QUEUE_DB, 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(QUEUE_STORE)) request.result.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
async function queueRequest(request) {
    const queueUserHeader = request.headers.get('X-iSkool-Queue-User') || '';
    const formData = await request.clone().formData();
    const queueUser = queueUserHeader || String(formData.get('queue_user') || '');
    if (!queueUser) throw new Error('This submission cannot be safely queued without a learner identity.');
    const fields = [];
    for (const [name, value] of formData.entries()) fields.push(value instanceof File ? { name, type: 'file', value, filename: value.name } : { name, type: 'text', value });
    const db = await openQueueDb();
    await new Promise((resolve, reject) => {
        const transaction = db.transaction(QUEUE_STORE, 'readwrite');
        transaction.objectStore(QUEUE_STORE).add({ url: request.url, method: request.method, csrfToken: request.headers.get('X-CSRF-Token') || '', queueUser, fields, createdAt: Date.now() });
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
    });
    db.close();
}
async function getQueuedWrites() {
    const db = await openQueueDb();
    const records = await new Promise((resolve, reject) => {
        const request = db.transaction(QUEUE_STORE, 'readonly').objectStore(QUEUE_STORE).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    db.close();
    return records;
}
async function deleteQueuedWrite(id) {
    const db = await openQueueDb();
    await new Promise((resolve, reject) => {
        const transaction = db.transaction(QUEUE_STORE, 'readwrite');
        transaction.objectStore(QUEUE_STORE).delete(id);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
    });
    db.close();
}
async function clearQueuedWrites() {
    const db = await openQueueDb();
    await new Promise((resolve, reject) => {
        const transaction = db.transaction(QUEUE_STORE, 'readwrite');
        transaction.objectStore(QUEUE_STORE).clear();
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
    });
    db.close();
}
async function clearLearnerDataCaches() {
    await Promise.all([caches.delete(CONTENT_CACHE), caches.delete(NETWORK_CACHE)]);
}
async function replayQueuedWrites() {
    const records = await getQueuedWrites();
    for (const record of records) {
        const body = new FormData();
        record.fields.forEach(field => {
            if (field.type === 'file') body.append(field.name, field.value, field.filename);
            else body.append(field.name, field.value);
        });
        const headers = record.csrfToken ? { 'X-CSRF-Token': record.csrfToken } : {};
        try {
            const identityResponse = await fetch('/api/learner/get_session_identity.php', { cache: 'no-store', credentials: 'same-origin' });
            if (!identityResponse.ok) return;
            const identity = await identityResponse.json();
            if (!record.queueUser || identity.email !== record.queueUser) {
                await deleteQueuedWrite(record.id);
                await notifyClients({ type: 'offline-write-discarded', url: record.url });
                continue;
            }
            const response = await fetch(record.url, { method: record.method, headers, body, credentials: 'same-origin' });
            if (response.ok) {
                await deleteQueuedWrite(record.id);
                await notifyClients({ type: 'offline-write-synced', url: record.url });
            } else if (response.status >= 400 && response.status < 500) {
                await deleteQueuedWrite(record.id);
                await notifyClients({ type: 'offline-write-failed', url: record.url });
            }
        } catch (error) { return; }
    }
}
async function registerSync() {
    if ('sync' in self.registration) await self.registration.sync.register(SYNC_TAG);
}
async function notifyClients(message) {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clientList.forEach(client => client.postMessage(message));
}
/* iSkool learner offline-support service worker. */
const STATIC_CACHE = 'iskool-static-v6';
const CONTENT_CACHE = 'iskool-content-v6';
const NETWORK_CACHE = 'iskool-network-v6';
const QUEUE_DB = 'iskool-offline-writes-v1';
const QUEUE_STORE = 'requests';
const SYNC_TAG = 'iskool-retry-writes';

const APP_SHELL = [
    '/', '/icon.svg?v=1.4', '/manifest.php?v=1.2',
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
// The teacher's only queueable save is the quiz marks (a teacher in a classroom with no signal). Everything else a
// teacher does, such as grading an open-ended answer, creating a quiz, or posting an announcement, needs a connection.
const TEACHER_API_PREFIX = '/api/teacher/';
const TEACHER_MARKS_PATH = '/api/teacher/save_marks.php';
const LEARNER_IDENTITY_URL = '/api/learner/get_session_identity.php';
const TEACHER_IDENTITY_URL = '/api/teacher/get_session_identity.php';
// What a learner can send without signal: a finished quiz, an assignment, an evaluation. The server answers these in JSON
// when they are sent again later (X-iSkool-Queued-Replay), so the learner is told whether the school accepted them.
// A quiz's progress autosave (/save_progress.php) is deliberately NOT here: a delayed autosave could overwrite newer
// answers, and the next autosave or the final submission carries the answers anyway.
const LEARNER_SUBMISSION_PATHS = new Set(['/submit_quiz.php', '/submit_assignment.php', '/api/learner/submit_evaluation.php']);
const QUEUEABLE_WRITE_PATHS = new Set([
    '/submit_quiz.php', '/submit_assignment.php',
    '/api/learner/submit_evaluation.php', '/api/learner/create_discussion.php',
    '/api/learner/submit_reply.php', TEACHER_MARKS_PATH
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
    if (event.data?.type === 'iskool-queue-status') event.waitUntil(notifyQueueStatus());
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
// A request's body can be read only once, and fetch() uses it up: when the send then fails there is nothing left to
// keep ("Request body is already used"). So a copy is taken BEFORE sending, for the teacher's marks and for what a
// learner submits (a quiz, an assignment, an evaluation). Their screens already understand "saved for later" (the 202
// reply below, or the page from queuedResponse for a form that navigates).
const COPY_BEFORE_SEND = new Set([TEACHER_MARKS_PATH, ...LEARNER_SUBMISSION_PATHS]);
async function handleWrite(request, pathname) {
    const spare = COPY_BEFORE_SEND.has(pathname) ? request.clone() : null;
    try {
        return await fetch(request);
    } catch (error) {
        if (!QUEUEABLE_WRITE_PATHS.has(pathname)) throw error;
        await queueRequest(spare || request);
        await registerSync();
        await notifyQueueStatus().catch(() => {});
        return queuedResponse(request);
    }
}
function queuedResponse(request) {
    if (request.mode === 'navigate') {
        return new Response('<!doctype html><title>Submission queued</title><meta name="viewport" content="width=device-width, initial-scale=1"><body style="font-family:sans-serif;padding:2rem;background:#0d1117;color:#e2e8f0"><h1>Submission saved offline</h1><p>iSkool will send it automatically when you are back online. Keep this device signed in until it has sent.</p><p><a href="/learner_dashboard.php" target="_top" style="color:#4fd1c5">Back to iSkool</a></p></body>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
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
    // Marks saved twice for the same learner and quiz while offline: only the newest is sent, but it keeps the
    // baseline of the oldest (the marks the server held before any of them), so the server's check against the
    // stored marks (includes/marks_guard.php) still compares with what the teacher really started from.
    const replacedIds = [];
    if (urlPath(request.url) === TEACHER_MARKS_PATH) {
        const same = (await getQueuedWrites()).filter(record => urlPath(record.url) === TEACHER_MARKS_PATH
            && record.queueUser === queueUser && marksKey(record.fields) === marksKey(fields));
        if (same.length) {
            const oldest = same.reduce((first, next) => (first.createdAt <= next.createdAt ? first : next));
            for (let i = fields.length - 1; i >= 0; i--) if (MARKS_BASELINE_FIELDS.includes(fields[i].name)) fields.splice(i, 1);
            oldest.fields.forEach(field => { if (MARKS_BASELINE_FIELDS.includes(field.name)) fields.push(field); });
            same.forEach(record => replacedIds.push(record.id));
        }
    }
    const db = await openQueueDb();
    await new Promise((resolve, reject) => {
        const transaction = db.transaction(QUEUE_STORE, 'readwrite');
        const store = transaction.objectStore(QUEUE_STORE);
        store.add({ url: request.url, method: request.method, csrfToken: request.headers.get('X-CSRF-Token') || '', queueUser, fields, createdAt: Date.now() });
        replacedIds.forEach(id => store.delete(id));
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
    });
    db.close();
}
const MARKS_BASELINE_FIELDS = ['expected_known', 'expected_score', 'expected_total'];
function urlPath(url) {
    try { return new URL(url).pathname; } catch (error) { return ''; }
}
function isTeacherUrl(url) {
    return urlPath(url).startsWith(TEACHER_API_PREFIX);
}
function fieldValue(fields, name) {
    const field = fields.find(item => item.name === name && item.type === 'text');
    return field ? String(field.value) : '';
}
function marksKey(fields) {
    return fieldValue(fields, 'quiz_id') + '|' + fieldValue(fields, 'user_email');
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
let replayRunning = null;
let replayAgain = false;
// One pass at a time. The page, the browser's background sync and the worker's own start can all ask at once, and two
// passes would send the same saved item twice. A request that arrives while a pass runs makes it go round once more.
function replayQueuedWrites() {
    if (replayRunning) { replayAgain = true; return replayRunning; }
    replayRunning = (async () => {
        try {
            do { replayAgain = false; await replayPass(); } while (replayAgain);
        } finally { replayRunning = null; }
    })();
    return replayRunning;
}
// Right after a phone reconnects, the first request often fails because the connection is not really ready yet. A
// teacher's save and a learner's submission are therefore tried again a few times, a moment apart, before the pass gives
// up (the page asks again later, with growing gaps: net_status.js).
const REPLAY_RETRY_DELAYS_MS = [1500, 3000, 6000];
function isLearnerSubmission(url) {
    return LEARNER_SUBMISSION_PATHS.has(urlPath(url));
}
async function replayPass() {
    const records = await getQueuedWrites();
    for (const record of records) {
        const teacherRecord = isTeacherUrl(record.url);
        const retries = teacherRecord || isLearnerSubmission(record.url);
        let attempt = 0;
        for (;;) {
            try {
                if (await replayRecord(record, teacherRecord) === 'stop') return;
                break;
            } catch (error) {
                const delay = retries ? REPLAY_RETRY_DELAYS_MS[attempt++] : undefined;
                if (delay === undefined) return;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
}
// Sends one saved item. Returns 'next' to go on to the following one, or 'stop' when the rest should wait.
async function replayRecord(record, teacherRecord) {
    const learnerSubmission = isLearnerSubmission(record.url);
    const identityResponse = await fetch(teacherRecord ? TEACHER_IDENTITY_URL : LEARNER_IDENTITY_URL, { cache: 'no-store', credentials: 'same-origin' });
    // Nobody is signed in as that role right now: the save waits. It must not hold up the saves behind it, which
    // can belong to the other role if a teacher and a learner both used this phone.
    if (!identityResponse.ok) return 'next';
    const identity = await identityResponse.json();
    if (!record.queueUser || identity.email !== record.queueUser) {
        await deleteQueuedWrite(record.id);
        await notifyClients({ type: 'offline-write-discarded', url: record.url });
        await notifyQueueStatus();
        return 'next';
    }
    const body = new FormData();
    const headers = record.csrfToken ? { 'X-CSRF-Token': record.csrfToken } : {};
    if (teacherRecord || learnerSubmission) {
        // The token the save was made with belongs to a session that may be gone. The identity check above just
        // proved the signed-in person is the one who made the save, so the live token is the right one to use. (A
        // form that navigates carries its token in the body, and the server reads the body first: replace that too.)
        const liveToken = identity.csrf_token || '';
        record.fields.forEach(field => {
            if (field.type === 'file') body.append(field.name, field.value, field.filename);
            else if (field.name === 'csrf_token' && liveToken) body.append(field.name, liveToken);
            else body.append(field.name, field.value);
        });
        headers['X-CSRF-Token'] = liveToken || record.csrfToken || '';
        headers['X-iSkool-Queued-Replay'] = '1';
    } else {
        record.fields.forEach(field => {
            if (field.type === 'file') body.append(field.name, field.value, field.filename);
            else body.append(field.name, field.value);
        });
    }
    const response = await fetch(record.url, { method: record.method, headers, body, credentials: 'same-origin' });
    if (teacherRecord) return (await settleTeacherReplay(record, response)) ? 'stop' : 'next';
    if (learnerSubmission) return (await settleLearnerReplay(record, response)) ? 'stop' : 'next';
    if (response.ok) {
        await deleteQueuedWrite(record.id);
        await notifyClients({ type: 'offline-write-synced', url: record.url });
    } else if (response.status >= 400 && response.status < 500) {
        await deleteQueuedWrite(record.id);
        await notifyClients({ type: 'offline-write-failed', url: record.url });
    }
    return 'next';
}
// What a teacher's re-sent save came to. Returns true when the rest of the queue should wait for a better moment.
// The marks endpoint answers in JSON: success, a conflict (409: the marks changed meanwhile, so the save is NOT applied),
// or an error. A reply that is not JSON is a sign-in or a hotspot page, and a 5xx is the server having a bad moment:
// both keep the save in the queue to try again.
async function settleTeacherReplay(record, response) {
    let result = null;
    try { result = await response.clone().json(); } catch (error) { result = null; }
    const quizId = fieldValue(record.fields, 'quiz_id');
    const userEmail = fieldValue(record.fields, 'user_email');
    if (response.status === 409 && result && result.conflict) {
        await deleteQueuedWrite(record.id);
        await notifyClients({ type: 'offline-write-conflict', url: record.url, quizId, userEmail, currentScore: result.current_score, currentTotal: result.current_total, message: result.error || '' });
    } else if (response.ok && result && result.success === true) {
        await deleteQueuedWrite(record.id);
        await notifyClients({ type: 'offline-write-synced', url: record.url, quizId, userEmail });
    } else if (response.status >= 500 || (response.ok && !result)) {
        return true;
    } else {
        await deleteQueuedWrite(record.id);
        await notifyClients({ type: 'offline-write-failed', url: record.url, quizId, userEmail, message: (result && (result.error || result.message)) || '' });
    }
    await notifyQueueStatus();
    return false;
}
// What a learner's re-sent submission came to. Returns true when the rest of the queue should wait for a better moment.
// The quiz and assignment pages answer a re-sent submission in JSON ({ success, error, title, ... }, see
// submit_quiz.php and submit_assignment.php), the evaluation endpoint always does. Accepted: dropped and reported.
// Refused (the quiz had closed, the due date had passed, ...): dropped and reported WITH the reason, so the learner
// knows it did not arrive (kept until a page is open to say so). A server hiccup (5xx, "too many requests") or a page that is not JSON (a hotspot sign-in)
// keeps it to try again.
async function settleLearnerReplay(record, response) {
    let result = null;
    try { result = await response.clone().json(); } catch (error) { result = null; }
    const path = urlPath(record.url);
    const detail = {
        url: record.url,
        kind: path === '/submit_quiz.php' ? 'quiz' : (path === '/submit_assignment.php' ? 'assignment' : 'evaluation'),
        title: (result && typeof result.title === 'string') ? result.title : ''
    };
    if (response.ok && result && result.success === true) {
        await deleteQueuedWrite(record.id);
        await notifyClients({ type: 'offline-write-synced', ...detail });
    } else if (response.status >= 500 || response.status === 408 || response.status === 429 || (response.ok && !result)) {
        return true;
    } else {
        // The learner must hear that it did not arrive. Background Sync can send with the app closed, and then there is
        // nobody to tell: it stays, is refused again, and is reported the next time the app is open.
        if (!(await hasOpenWindow())) return true;
        await deleteQueuedWrite(record.id);
        await notifyClients({ type: 'offline-write-failed', ...detail, message: (result && (result.error || result.message)) || '' });
    }
    await notifyQueueStatus();
    return false;
}
// How many saves are waiting on this phone, per signed-in person, so a page can show "2 changes waiting": the teacher's
// marks under "teacher", a learner's submissions under "learner".
async function notifyQueueStatus() {
    const records = await getQueuedWrites();
    const teacher = {};
    const learner = {};
    records.filter(record => isTeacherUrl(record.url)).forEach(record => { teacher[record.queueUser] = (teacher[record.queueUser] || 0) + 1; });
    records.filter(record => isLearnerSubmission(record.url)).forEach(record => { learner[record.queueUser] = (learner[record.queueUser] || 0) + 1; });
    await notifyClients({ type: 'offline-queue-status', teacher, learner, total: records.length });
}
async function registerSync() {
    // Only a convenience: it lets the browser send the saves later even if the app is closed. Some browsers have it
    // switched off (Chrome reports "Background Sync is disabled"). That must never make a save that is safely queued look
    // like a failure; the page also sends the queue itself as soon as the phone is back online (net_status.js).
    try {
        if ('sync' in self.registration) await self.registration.sync.register(SYNC_TAG);
    } catch (error) { /* the page and the next start of the worker send the queue instead */ }
}
async function notifyClients(message) {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clientList.forEach(client => client.postMessage(message));
}
// Is a page of the app open right now, to hear the news?
async function hasOpenWindow() {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    return clientList.length > 0;
}
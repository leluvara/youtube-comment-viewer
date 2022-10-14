var cacheName = 'youtube-comment-viewer-v1';
var contentToCache = [
	'./',
	'./index.html',
	'./index.css',
	'./index.js',
	'./android-chrome-192x192.png',
	'./android-chrome-512x512.png',
	'./apple-touch-icon.png',
	'./favicon-16x16.png',
	'./favicon-32x32.png',
	'./favicon.ico',
	'./safari-pinned-tab.svg',
];

// Installing Service Worker
self.addEventListener('install', function (e) {
	console.log('[Service Worker] Install');
	e.waitUntil(
		caches.open(cacheName).then(function (cache) {
			console.log('[Service Worker] Caching all: app shell and content');
			return cache.addAll(contentToCache);
		})
	);
});

// Fetching content using Service Worker
self.addEventListener('fetch', function (e) {
	e.respondWith(
		caches.match(e.request).then(function (r) {
			console.log('[Service Worker] Fetching resource: ' + e.request.url);
			return (
				r ||
				fetch(e.request).then(function (response) {
					return caches.open(cacheName).then(function (cache) {
						console.log(
							'[Service Worker] Caching new resource: ' + e.request.url
						);
						cache.put(e.request, response.clone());
						return response;
					});
				})
			);
		})
	);
});

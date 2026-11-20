// Lets browsers treat the site as installable (Android Chrome asks for a fetch
// handler). Requests go straight to the network and nothing is cached, so
// listings and messages are always current.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

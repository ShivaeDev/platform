import { documentApp } from "#test/documentApp.ts";

documentApp.it("a redirected POST becomes GET and keeps document cookies", [], function* ({ redirectedPostIs }) {
	yield* redirectedPostIs(302, "GET", "");
});

documentApp.it("a 307 redirect keeps the POST body and headers", [], function* ({ redirectedPostIs }) {
	yield* redirectedPostIs(307, "POST", "story-body");
});

documentApp.it("loads the routed page and leaves its response readable", [], function* ({ loadPage }) {
	yield* loadPage();
});

documentApp.it("routes XMLHttpRequest through the document transport", [], function* ({ xhrIsRouted }) {
	yield* xhrIsRouted();
});

documentApp.it("refuses synchronous document requests before they reach the network", [], ({ syncRequestIsRefused }) => {
	syncRequestIsRefused();
});

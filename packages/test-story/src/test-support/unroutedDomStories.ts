import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { storyKit } from "#storyKit.ts";
import { domHost } from "#test/domHost.ts";

const app = storyKit({ clock: "live", create: () => ({}), name: "contained DOM", stages: ["host"], verbs: () => ({}) });

app.it("refuses host fetch even when the host catches it", [], function* () {
	const url = yield* domHost(async (_request, response) => {
		await fetch("https://unrouted-host.test/token").catch(() => undefined);
		response.end("host caught the error");
	});
	yield* Effect.promise(async () => {
		await (await window.fetch(url)).text();
	});
});

app.it("refuses document fetch even when the document catches it", [], function* () {
	yield* Effect.promise(() => window.fetch("https://unrouted-document.test/authorize").catch(() => undefined));
});

app.it("refuses an unrouted redirect destination", [], function* () {
	const url = yield* domHost((_request, response) => {
		response.writeHead(HttpStatus.fromLiteral("Found"), { location: "https://unrouted-redirect.test/authorize" }).end();
	});
	yield* Effect.promise(() => window.fetch(url).catch(() => undefined));
});

const networkEnabled = storyKit({
	clock: "live",
	create: () => ({}),
	name: "network enabled DOM",
	outbound: {},
	outboundPassthrough: true,
	stages: [],
	verbs: () => ({}),
});

networkEnabled.it("refuses Node-only network passthrough", [], function* () {
	yield* Effect.promise(() => fetch("https://unrouted-opt-in.test/user").catch(() => undefined));
});

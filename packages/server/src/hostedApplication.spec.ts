import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { failedMigration, migratedSql, postgresFeature } from "#test/app-host/database.ts";
import { assets } from "#test/app-host/options.ts";
import { host, sessionPolicy, startupFails } from "#test/app-host/story.ts";

host.it("an RPC handler queries the migrated database when the host declares no services", [migratedSql], function* ({ ping }) {
	expect(yield* ping()).toBe("pong");
});

host.it("application services start after migrations and read the table they created", [postgresFeature], function* ({ greet }) {
	expect(yield* greet("alice")).toBe("Hello, alice");
});

host.it(
	"a failed migration fails startup before application services start",
	[failedMigration, startupFails],
	function* ({ serviceLifecycle, startup }) {
		yield* outcomes({
			"application services": [serviceLifecycle(), []],
			"startup": [startup(), "failed with migration error"],
		});
	},
);

host.it("concurrent RPC calls each answer with their own session", [postgresFeature], function* ({ greet }) {
	expect(yield* Effect.all([greet("alice"), greet("bob")], { concurrency: "unbounded" })).toEqual(["Hello, alice", "Hello, bob"]);
});

host.it("a signed-out RPC call reaches the native client as unauthorized", [postgresFeature], function* ({ greetSignedOut }) {
	expect(yield* greetSignedOut()).toBe("failed with unauthorized");
});

host.it("a handler's typed conflict reaches the native client as conflict", [postgresFeature], function* ({ greetWithTakenName }) {
	expect(yield* greetWithTakenName("alice")).toBe("failed with conflict");
});

host.it("a session store outage reaches the native client as auth unavailable", [postgresFeature], function* ({ greetDuringSessionOutage }) {
	expect(yield* greetDuringSessionOutage()).toBe("failed with auth unavailable");
});

for (const [request, headers] of [
	["a foreign origin", { origin: "http://elsewhere.test" }],
	["a JSON content type", { "content-type": "application/json" }],
	["a foreign Host header", { host: "elsewhere.test" }],
] as const) {
	host.it(
		`a session host forbids an RPC post with ${request} before looking up its session`,
		[sessionPolicy],
		function* ({ postRpc, responseStatus, sessionLookups }) {
			yield* postRpc(headers);

			yield* outcomes({
				"response status": [responseStatus(), HttpStatus.fromLiteral("Forbidden")],
				"session lookups": [sessionLookups(), []],
			});
		},
	);
}

for (const [request, path, headers, body] of [
	["the root path", "/", {}, "<main>Hosted app</main>"],
	["an HTML navigation to a client route", "/sign-in", { accept: "text/html" }, "<main>Hosted app</main>"],
	["the application's /ready route", "/ready", {}, "Ready"],
] as const) {
	host.it(`the host answers ${request} beside the SPA assets with ${body}`, [assets], function* ({ request: get }) {
		expect(yield* get(path, { headers })).toMatchObject({ body, status: HttpStatus.fromLiteral("OK") });
	});
}

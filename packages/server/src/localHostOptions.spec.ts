import * as HttpStatus from "effect/http/HttpStatus";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { AppChanges } from "#appHost.ts";
import { failedRoute, lifecycleServices, rpcPath } from "#test/app-host/options.ts";
import { configuration, environment, host, sessionPolicy } from "#test/app-host/story.ts";

for (const [policy, traits] of [
	["the loopback policy", []],
	["a session policy", [sessionPolicy]],
] as const) {
	host.it(`a host without services serves native RPC under ${policy}`, traits, function* ({ ping }) {
		expect(yield* ping()).toBe("pong");
	});
}

host.it("a host without migrations answers health as service unavailable", [lifecycleServices], function* ({ health }) {
	expect(yield* health()).toMatchObject({ body: "", status: HttpStatus.fromLiteral("ServiceUnavailable") });
});

host.it("a host without migrations provides neither SQL nor app changes", [lifecycleServices], function* ({ provided }) {
	yield* outcomes({
		"app changes": [provided(AppChanges), "missing"],
		"SQL client": [provided(SqlClient.SqlClient), "missing"],
	});
});

host.it("closing the host releases the application services' scope", [lifecycleServices], function* ({ close, serviceLifecycle }) {
	expect(yield* serviceLifecycle()).toEqual(["started"]);

	yield* close();

	expect(yield* serviceLifecycle()).toEqual(["started", "closed"]);
});

host.it("a closed host refuses HTTP connections", [lifecycleServices], function* ({ close, httpAnswer }) {
	expect(yield* httpAnswer()).toBe("answers");

	yield* close();

	expect(yield* httpAnswer()).toBe("refuses connections");
});

host.it("rpcPath serves native RPC at the chosen route", [sessionPolicy, rpcPath("/custom/rpc")], function* ({ ping }) {
	expect(yield* ping()).toBe("pong");
});

host.it("rpcPath leaves /rpc unrouted", [sessionPolicy, rpcPath("/custom/rpc")], function* ({ postRpc }) {
	expect(yield* postRpc({})).toBe(HttpStatus.fromLiteral("NotFound"));
});

for (const [request, headers] of [
	["a foreign origin", { origin: "https://elsewhere.test" }],
	["a foreign Host header", { host: "elsewhere.test" }],
	["a JSON content type", { "content-type": "application/json" }],
	[
		"forwarded host and protocol headers",
		{ host: "elsewhere.test", origin: "https://elsewhere.test", "x-forwarded-host": "elsewhere.test", "x-forwarded-proto": "https" },
	],
] as const) {
	host.it(
		`the loopback policy forbids an RPC post with ${request} even with proxy trust configured`,
		[configuration({ trustedProxy: "127.0.0.1" }), environment({ "TRUSTED_PROXY": "127.0.0.1" })],
		function* ({ postRpc }) {
			expect(yield* postRpc(headers)).toBe(HttpStatus.fromLiteral("Forbidden"));
		},
	);
}

host.it("an application route's typed InternalServerError answers HTTP 500", [failedRoute], function* ({ request }) {
	expect(yield* request("/failed")).toMatchObject({ status: HttpStatus.fromLiteral("InternalServerError") });
});

import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { AppChanges } from "#appHost.ts";
import { failedRoute, lifecycleServices, rpcPath } from "#test/app-host/options.ts";
import { configuration, environment, host, sessionPolicy } from "#test/app-host/story.ts";

for (const policy of [[], [sessionPolicy]]) {
	host.it(`omitting services serves RPC with ${policy.length > 0 ? "sessions" : "loopback policy"}`, policy, function* ({ ping }) {
		expect(yield* ping()).toBe("pong");
	});
}
host.it(
	"omitting migrations serves RPC without database configuration or SQL services",
	[lifecycleServices],
	function* ({ ping, health, hasService, lifecycle, close, request }) {
		expect(yield* ping()).toBe("pong");
		expect(yield* health()).toMatchObject({ body: "", status: HttpStatus.fromLiteral("ServiceUnavailable") });
		expect(yield* hasService(SqlClient.SqlClient)).toBe(false);
		expect(yield* hasService(AppChanges)).toBe(false);
		expect(lifecycle()).toEqual(["started"]);
		yield* close();
		expect(lifecycle()).toEqual(["started", "closed"]);
		expect(yield* Effect.result(request())).toMatchObject({ _tag: "Failure" });
	},
);
host.it("rpcPath serves the native client at the chosen route instead of /rpc", [sessionPolicy, rpcPath("/custom/rpc")], function* ({ ping, post }) {
	expect(yield* ping()).toBe("pong");
	const status = yield* post({});
	expect(status).toBe(HttpStatus.fromLiteral("NotFound"));
});
host.it(
	"loopback policy refuses origin, Host, content type and proxy forwarding",
	[configuration({ trustedProxy: "127.0.0.1" }), environment({ "TRUSTED_PROXY": "127.0.0.1" })],
	function* ({ ping, post }) {
		expect(yield* ping()).toBe("pong");
		for (const headers of [
			{ origin: "https://elsewhere.test" },
			{ host: "elsewhere.test" },
			{ "content-type": "application/json" },
			{ host: "elsewhere.test", origin: "https://elsewhere.test", "x-forwarded-host": "elsewhere.test", "x-forwarded-proto": "https" },
		]) {
			const status = yield* post(headers);
			expect(status).toBe(HttpStatus.fromLiteral("Forbidden"));
		}
	},
);
host.it("application routes retain native typed failures at the HTTP boundary", [failedRoute], function* ({ request, ping }) {
	expect((yield* request("/failed")).status).toBe(HttpStatus.fromLiteral("InternalServerError"));
	expect(yield* ping()).toBe("pong");
});

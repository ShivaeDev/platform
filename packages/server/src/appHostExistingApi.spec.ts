import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { existingApi, migratedExistingApi } from "#test/app-host/existingApi.ts";
import { forwarded } from "#test/app-host/options.ts";
import { configuration, host, postgresHost, startupFails } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

host.it(
	"an existing request handler runs with scoped application services and no native RPC",
	[existingApi],
	function* ({ request, close, serviceLifecycle }) {
		expect(yield* request("/rpc", { body: "hello", method: "POST" })).toMatchObject({ body: "Existing API: hello", status: 200 });

		yield* close();

		expect(yield* serviceLifecycle()).toEqual(["acquired", "released"]);
	},
);

host.it("the existing API owns preflights at /rpc", [existingApi], function* ({ preflight }) {
	expect(yield* preflight("/rpc", "POST")).toMatchObject({ allowedOrigin: "*", status: 200 });
});

for (const chunked of [false, true]) {
	for (const [body, status, calls] of [
		["éé", 200, ["éé"]],
		["ééx", 413, []],
	] as const) {
		host.it(
			`the existing API applies the four-byte limit to ${body} with ${chunked ? "chunked" : "fixed-length"} transfer`,
			[existingApi, configuration({ maxBodySize: 4 })],
			function* ({ postNdjson, handledCalls, responseStatus }) {
				yield* postNdjson(body, { chunked });

				yield* outcomes([
					["response", () => responseStatus(), status],
					["handled bodies", () => handledCalls(), calls],
				]);
			},
		);
	}
}

host.it("health without PostgreSQL stays unavailable without native RPC", [existingApi], function* ({ health }) {
	expect(yield* health()).toEqual({ body: "", cacheControl: "no-store", status: 503 });
});

host.it(
	"an existing API bound publicly still requires proxy trust",
	[existingApi, configuration({ host: "0.0.0.0" }), startupFails],
	function* ({ startup }) {
		expect(yield* startup()).toBe("failed with trusted proxy required");
	},
);

for (const [trustedProxy, status] of [
	["127.0.0.1", 202],
	["127.0.0.2", 403],
] as const) {
	host.it(
		`browser reports through the proxy use host trust ${trustedProxy} without native RPC`,
		[existingApi, configuration({ host: "0.0.0.0", trustedProxy }), forwarded],
		function* ({ reportBrowserError }) {
			expect(yield* reportBrowserError("Legacy browser error", { headers: { origin: "https://app.example" } })).toMatchObject({ status });
		},
	);
}

host.it(
	"the existing API exports the HTTP route span and continues traceparent",
	[existingApi, collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json" } })],
	function* ({ request, close, serverSpan }) {
		const traceId = "0123456789abcdef0123456789abcdef";
		const parentSpanId = "0123456789abcdef";

		yield* request("/rpc", { body: "hello", headers: { traceparent: `00-${traceId}-${parentSpanId}-01` }, method: "POST" });

		yield* close();

		expect(yield* serverSpan("POST /rpc")).toMatchObject({ attributes: { "http.route": "/rpc" }, parentSpanId, traceId });
	},
);

for (const deferred of [false, true]) {
	postgresHost.it(
		`the ${deferred ? "deferred" : "direct"} existing API reads migrated PostgreSQL and keeps health ready`,
		[migratedExistingApi(deferred)],
		function* ({ request, health }) {
			yield* outcomes([
				["existing API", () => request("/rpc", { body: "hello", method: "POST" }), { body: "Migrated API: hello", status: 200 }],
				["database health", () => health(), { body: "", cacheControl: "no-store", status: 200 }],
			]);
		},
	);
}

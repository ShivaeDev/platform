import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { tracedRoutes } from "#test/app-host/diagnostics.ts";
import { rpcPath } from "#test/app-host/options.ts";
import { host, sessionPolicy } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

const tracedHost = [collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json" } }), rpcPath("/api/rpc"), sessionPolicy, tracedRoutes];
const traceparent = { parentSpanId: "0123456789abcdef", traceId: "0123456789abcdef0123456789abcdef" };

host.it("an RPC server span is named by its route template", tracedHost, function* ({ close, ping, serverSpan }) {
	yield* ping();

	yield* close();

	expect(yield* serverSpan("POST /api/rpc")).toMatchObject({ attributes: { "http.route": "/api/rpc" } });
});

host.it(
	"a router server span is named by its route template and continues the incoming traceparent",
	tracedHost,
	function* ({ close, request, serverSpan }) {
		yield* request("/items/42?secret=value", { headers: { traceparent: `00-${traceparent.traceId}-${traceparent.parentSpanId}-01` } });

		yield* close();

		expect(yield* serverSpan("GET /items/:id")).toMatchObject({ attributes: { "http.route": "/items/:id" }, ...traceparent });
	},
);

host.it(
	"a missing route's server span is named by its method alone and carries no route",
	tracedHost,
	function* ({ close, request, serverSpan, serverSpanNames }) {
		yield* request("/unknown/42");

		yield* close();

		yield* outcomes({
			"server span names": [serverSpanNames(), ["GET"]],
			"the GET span's attributes": [
				serverSpan("GET"),
				expect.objectContaining({ attributes: expect.not.objectContaining({ "http.route": expect.anything() }) }),
			],
		});
	},
);

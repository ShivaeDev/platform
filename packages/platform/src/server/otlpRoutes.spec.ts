import { expect } from "vitest";
import { tracedRoutes } from "#test/app-host/diagnostics.ts";
import { rpcPath } from "#test/app-host/options.ts";
import { host, sessionPolicy } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

host.it(
	"exports route templates for RPC and router spans, falls back for missing routes, and continues an incoming traceparent",
	[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json" } }), rpcPath("/api/rpc"), sessionPolicy, tracedRoutes],
	function* ({ ping, request, close, exportedSpans }) {
		const traceId = "0123456789abcdef0123456789abcdef";
		const parentSpanId = "0123456789abcdef";
		expect(yield* ping()).toBe("pong");
		expect((yield* request("/items/42?secret=value", { headers: { traceparent: `00-${traceId}-${parentSpanId}-01` } })).status).toBe(200);
		expect((yield* request("/unknown/42")).status).toBe(404);
		yield* close();
		const spans = exportedSpans();
		const servers = spans.filter(({ kind, attributes }) => kind === 2 && attributes.some(({ key }) => key === "http.request.method"));
		expect(servers).toHaveLength(3);
		expect(servers).toContainEqual(
			expect.objectContaining({
				attributes: expect.arrayContaining([{ key: "http.route", value: { stringValue: "/api/rpc" } }]),
				name: "POST /api/rpc",
			}),
		);
		expect(servers).toContainEqual(
			expect.objectContaining({
				attributes: expect.arrayContaining([{ key: "http.route", value: { stringValue: "/items/:id" } }]),
				name: "GET /items/:id",
				parentSpanId,
				traceId,
			}),
		);
		const missing = servers.find(({ name }) => name === "GET");
		expect(missing).toBeDefined();
		expect(missing?.attributes.some(({ key }) => key === "http.route")).toBe(false);
	},
);

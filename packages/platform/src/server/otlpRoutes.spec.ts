import { Layer, ManagedRuntime } from "effect";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import { expect, it } from "vitest";
import { appHost } from "#appHost.ts";
import { sessions } from "#test/app-host/fixture.ts";
import { Ping, ping, pingHandlers } from "#test/app-host/ping.ts";
import { otlpConfig } from "#test/otlpHost.ts";
import { otlpReceiver } from "#test/otlpReceiver.ts";

it("exports route templates for RPC and router spans, falls back for missing routes, and continues an incoming traceparent", async () => {
	const receiver = await otlpReceiver();
	const traceId = "0123456789abcdef0123456789abcdef";
	const parentSpanId = "0123456789abcdef";
	const runtime = ManagedRuntime.make(
		appHost({
			config: { port: 0 },
			group: Ping,
			handlers: pingHandlers,
			routes: HttpRouter.add("GET", "/items/:id", HttpServerResponse.text("item")),
			rpcPath: "/api/rpc",
			sessions: sessions([]),
		}).pipe(Layer.provide(otlpConfig({ "OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url, "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json" }))),
	);
	try {
		const server = await runtime.runPromise(HttpServer.HttpServer);
		const url = HttpServer.formatAddress(server.address);
		expect(await ping(`${url}/api/rpc`)).toBe("pong");
		expect((await fetch(`${url}/items/42?secret=value`, { headers: { traceparent: `00-${traceId}-${parentSpanId}-01` } })).status).toBe(200);
		expect((await fetch(`${url}/unknown/42`)).status).toBe(404);
		await runtime.dispose();
		const spans = receiver.spans;
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
	} finally {
		await runtime.dispose();
		await receiver.close();
	}
});

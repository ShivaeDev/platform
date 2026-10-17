import { Effect } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import { expect, it } from "vitest";
import { otlpHost } from "#test/otlpHost.ts";
import { otlpReceiver } from "#test/otlpReceiver.ts";

it.each(["http/protobuf", "http/json"])("redacts sensitive diagnostics before %s export", async (protocol) => {
	const receiver = await otlpReceiver();
	const routes = HttpRouter.add(
		"GET",
		"/failed",
		Effect.gen(function* () {
			yield* Effect.annotateCurrentSpan({
				authorization: "hidden-authorization",
				cookie: "hidden-cookie",
				"db.user": "hidden-database-user",
				detail: ["Bearer hidden-array-token"],
			});
			const span = yield* Effect.currentSpan.pipe(Effect.orDie);
			span.event("password=hidden-event-password", 0n, { cookie: "hidden-event-cookie" });
			span.addLinks([{ attributes: { authorization: "hidden-link-authorization" }, span }]);
			return yield* Effect.die(new Error("postgres://hidden-database-user:hidden-database-password@localhost/db token=hidden-token"));
		}),
	);
	const runtime = otlpHost(
		{
			"OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url,
			"OTEL_EXPORTER_OTLP_PROTOCOL": protocol,
			"OTEL_RESOURCE_ATTRIBUTES": "service.name=resource-name,api.token=hidden-resource-token",
		},
		routes,
	);
	try {
		const server = await runtime.runPromise(HttpServer.HttpServer);
		expect(
			(
				await fetch(`${HttpServer.formatAddress(server.address)}/failed`, {
					headers: { authorization: "Bearer hidden-header-token", cookie: "session=hidden-header-cookie" },
				})
			).status,
		).toBe(500);
		await runtime.dispose();
		expect(receiver.requests).toHaveLength(1);
		const body = receiver.requests[0]?.body;
		expect(body).toContain("resource-name");
		expect(receiver.requests[0]?.contentType).toBe(protocol === "http/protobuf" ? "application/x-protobuf" : "application/json");
		if (protocol === "http/protobuf") {
			expect(receiver.requests[0]?.bytes[0]).toBe(0x0a);
			expect(() => JSON.parse(body ?? "")).toThrow();
		} else {
			expect(JSON.parse(body ?? "")).toHaveProperty("resourceSpans");
		}
		expect(body).toContain("<redacted>");
		expect(body).not.toContain("hidden-");
	} finally {
		await runtime.dispose();
		await receiver.close();
	}
});

import { Effect } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import { expect, it } from "vitest";
import { otlpHost } from "#test/otlpHost.ts";
import { otlpReceiver } from "#test/otlpReceiver.ts";

function diagnostic(field: string) {
	return `${field} at https://example.test/${field}?code="hidden-${field}-code with spaces"&state=hidden-${field}-state\nmore hidden-${field}-value#"hidden-${field}-fragment with spaces"`;
}

it.each(["http/json", "http/protobuf"])("redacts quoted and spaced URLs in free-text trace fields before %s export", async (protocol) => {
	const receiver = await otlpReceiver();
	const routes = HttpRouter.add(
		"GET",
		"/diagnostics",
		Effect.gen(function* () {
			yield* Effect.annotateCurrentSpan({ detail: diagnostic("attribute") });
			const span = yield* Effect.currentSpan.pipe(Effect.orDie);
			span.event(diagnostic("event"), 0n, { detail: diagnostic("event-attribute") });
			span.addLinks([{ attributes: { detail: diagnostic("link-attribute") }, span }]);
			return yield* Effect.die(new Error(diagnostic("status")));
		}).pipe(Effect.withSpan(diagnostic("span"))),
	);
	const runtime = otlpHost({ "OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url, "OTEL_EXPORTER_OTLP_PROTOCOL": protocol }, routes);
	try {
		const server = await runtime.runPromise(HttpServer.HttpServer);
		expect((await fetch(`${HttpServer.formatAddress(server.address)}/diagnostics`)).status).toBe(500);
		await runtime.dispose();
		expect(receiver.requests).toHaveLength(1);
		expect(receiver.requests[0]?.contentType).toBe(protocol === "http/json" ? "application/json" : "application/x-protobuf");
		const body = receiver.requests[0]?.body;
		expect(body).not.toContain("hidden-");
		for (const field of ["attribute", "event", "event-attribute", "link-attribute", "span", "status"]) {
			expect(body).toContain(`${field} at https://example.test/${field}?code=<redacted>&state=<redacted>#<redacted>`);
		}
	} finally {
		await runtime.dispose();
		await receiver.close();
	}
});

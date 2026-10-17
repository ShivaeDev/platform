import { Effect } from "effect";
import { HttpClient, HttpClientResponse, HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from "effect/http";
import { expect, it, vi } from "vitest";
import { otlpHost } from "#test/otlpHost.ts";
import { otlpReceiver } from "#test/otlpReceiver.ts";

it("redacts query values in server URLs, client URLs and Referer headers before export", async () => {
	// Random trace IDs can contain the short secret "c1" by coincidence.
	const ids = vi.spyOn(Math, "random").mockReturnValue(0.5);
	const receiver = await otlpReceiver();
	const client = HttpClient.make((request) => Effect.succeed(HttpClientResponse.fromWeb(request, new Response("blob"))));
	const routes = HttpRouter.add(
		"GET",
		"/api/auth/callback/github",
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			yield* Effect.annotateCurrentSpan({ "http.request.header.referer": request.headers.referer });
			yield* client.get("https://blob.example/x?sv=1&sig=s2&se=3").pipe(Effect.orDie);
			return HttpServerResponse.text("ok");
		}),
	);
	const runtime = otlpHost({ "OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url }, routes);
	try {
		const server = await runtime.runPromise(HttpServer.HttpServer);
		expect(
			(
				await fetch(`${HttpServer.formatAddress(server.address)}/api/auth/callback/github?code=c1&state=s1`, {
					headers: { referer: "https://example.test/callback?code='c1'&state=s1" },
				})
			).status,
		).toBe(200);
		await runtime.dispose();
		const body = receiver.requests.map((request) => request.body).join("\n");
		for (const secret of ["c1", "s1", "s2"]) {
			expect(body).not.toContain(secret);
		}
		expect(body).toContain("/api/auth/callback/github?code=<redacted>&state=<redacted>");
		expect(body).toContain("https://blob.example/x?sv=<redacted>&sig=<redacted>&se=<redacted>");
		expect(body).toContain(
			'"key":"http.request.header.referer","value":{"stringValue":"https://example.test/callback?code=<redacted>&state=<redacted>"}',
		);
		expect(body).toContain('"key":"url.query","value":{"stringValue":"code=<redacted>&state=<redacted>"}');
		expect(body).toContain('"key":"url.query","value":{"stringValue":"sv=<redacted>&sig=<redacted>&se=<redacted>"}');
		expect(body).toContain('"kind":2');
		expect(body).toContain('"kind":3');
	} finally {
		await runtime.dispose();
		await receiver.close();
		ids.mockRestore();
	}
});

it("redacts URL attributes recursively on spans, events, links and resources, including free text", async () => {
	const receiver = await otlpReceiver();
	const url = "https://hidden-user:hidden-password@example.test/path?unknown=hidden-query&unknown=hidden-repeat#hidden-fragment";
	const attributes = {
		custom: [url, { "url.query": "custom=hidden-nested-query" }],
		detail: `request failed at ${url}`,
		"http.target": "/path?arbitrary=hidden-target#hidden-target-fragment",
		"http.url": url,
		"request.query": ["array=hidden-array-query", ["nested=hidden-deep-query"]],
		"url.fragment": "hidden-standalone-fragment",
		"url.original": url,
		"url.query": "bare&empty=&encoded%20name=hidden-encoded&next=hidden-equals=tail",
	};
	const routes = HttpRouter.add(
		"GET",
		"/urls",
		Effect.gen(function* () {
			yield* Effect.annotateCurrentSpan(attributes);
			const span = yield* Effect.currentSpan.pipe(Effect.orDie);
			span.event(`event ${url}`, 0n, attributes);
			span.addLinks([{ attributes, span }]);
			return yield* Effect.die(new Error(`failure ${url}`));
		}).pipe(Effect.withSpan(`span ${url}`)),
	);
	const runtime = otlpHost(
		{
			"OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url,
			"OTEL_RESOURCE_ATTRIBUTES": `deployment.url=${encodeURIComponent(url)}`,
		},
		routes,
	);
	try {
		const server = await runtime.runPromise(HttpServer.HttpServer);
		expect((await fetch(`${HttpServer.formatAddress(server.address)}/urls`)).status).toBe(500);
		await runtime.dispose();
		const body = receiver.requests.map((request) => request.body).join("\n");
		expect(receiver.requests).toHaveLength(1);
		expect(body).not.toContain("hidden-");
		expect(body).toContain("https://<redacted>@example.test/path?unknown=<redacted>&unknown=<redacted>#<redacted>");
		expect(body).toContain("/path?arbitrary=<redacted>#<redacted>");
		expect(body).toContain("bare=<redacted>&empty=<redacted>&encoded%20name=<redacted>&next=<redacted>");
		expect(body).toContain('"key":"url.fragment","value":{"stringValue":"<redacted>"}');
		expect(body).toContain("custom=<redacted>");
		expect(body).toContain("array=<redacted>");
		expect(body).toContain("nested=<redacted>");
	} finally {
		await runtime.dispose();
		await receiver.close();
	}
});

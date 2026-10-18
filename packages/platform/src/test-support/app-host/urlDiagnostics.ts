import { Effect } from "effect";
import { HttpClient, HttpClientResponse, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { vi } from "vitest";
import { otlpReceiver } from "#test/otlpReceiver.ts";
import { host } from "./story.ts";

export const callbackDiagnostics = host.trait("configured", "a callback traces client URLs and quoted Referer headers", (state) =>
	Effect.promise(async () => {
		// Random trace IDs can contain the short secret "c1" by coincidence.
		const ids = vi.spyOn(Math, "random").mockReturnValue(0.5);
		state.cleanup.push(() => {
			ids.mockRestore();
		});
		const blob = await otlpReceiver();
		state.cleanup.push(blob.close);
		const client = HttpClient.make((request) =>
			Effect.promise(async () => HttpClientResponse.fromWeb(request, await fetch(`${blob.url}/x?sv=1&sig=s2&se=3`))),
		);
		state.routes = HttpRouter.add(
			"GET",
			"/api/auth/callback/github",
			Effect.gen(function* () {
				const request = yield* HttpServerRequest.HttpServerRequest;
				yield* Effect.annotateCurrentSpan({ "http.request.header.referer": request.headers.referer });
				yield* client.get("https://blob.example/x?sv=1&sig=s2&se=3").pipe(Effect.orDie);
				return HttpServerResponse.text("ok");
			}),
		);
	}),
);
export const nestedUrlDiagnostics = host.trait("configured", "a failed route traces nested URLs in spans, events, links and resources", (state) => {
	const url = "https://hidden-user:hidden-password@example.test/path?unknown=hidden-query&unknown=hidden-repeat#hidden-fragment";
	const attributes = {
		custom: [url, { "url.query": "custom=hidden-nested-query" }],
		detail: `request failed at ${url}`,
		"http.request.header.origin": '//hidden-origin-user:hidden-origin-password@example.test/path?q="hidden-origin-query"',
		"http.request.header.referer":
			'https://example.test/path?q="hidden-header-query with spaces"&next=hidden-header-next#"hidden-header-fragment with spaces"',
		"http.response.header.location": '/path?q="hidden-location-query"#"hidden-location-fragment"',
		"http.target": "/path?arbitrary=hidden-target#hidden-target-fragment",
		"http.url": url,
		"request.query": ["array=hidden-array-query", ["nested=hidden-deep-query"]],
		"url.fragment": "hidden-standalone-fragment",
		"url.original": url,
		"url.query": "bare&empty=&encoded%20name=hidden-encoded&next=hidden-equals=tail",
	};
	state.routes = HttpRouter.add(
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
	state.env.OTEL_RESOURCE_ATTRIBUTES = `deployment.url=${encodeURIComponent(url)}`;
});

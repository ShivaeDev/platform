import { Effect, Layer } from "effect";
import { HttpEffect, HttpServerResponse } from "effect/http";
import { storyKit } from "#storyKit.ts";
import { domHost } from "#test/domHost.ts";
import { Recording, recording } from "#test/spanRecording.ts";

const host = Effect.gen(function* () {
	const context = yield* Effect.context<never>();
	const handler = HttpEffect.toWebHandlerWith(context)(Effect.succeed(HttpServerResponse.text("ok")).pipe(Effect.withSpan("request work")));
	return yield* domHost((incoming, outgoing) => {
		const headers = new Headers();
		for (const [name, values] of Object.entries(incoming.headersDistinct)) {
			for (const value of values ?? []) {
				headers.append(name, value);
			}
		}
		void handler(new Request("http://app.test/", { headers }))
			.then(async (response) => {
				outgoing.statusCode = response.status;
				outgoing.end(await response.text());
			})
			.catch((error: unknown) => outgoing.destroy(error instanceof Error ? error : new Error(String(error))));
	}).pipe(Effect.withSpan("host startup"));
});

export const afterTracingApp = storyKit({
	after: {
		*deployment(engine) {
			engine.url = yield* Effect.acquireRelease(host, () => Effect.void.pipe(Effect.withSpan("host teardown")));
			yield* Effect.addFinalizer(() => Effect.void.pipe(Effect.withSpan("deployment finalizer")));
		},
		ready: () =>
			Effect.addFinalizer(() => Effect.void.pipe(Effect.withSpan("ready finalizer"))).pipe(
				Effect.andThen(Effect.void.pipe(Effect.withSpan("host ready"))),
				Effect.ensuring(Effect.void.pipe(Effect.withSpan("ready ensuring"))),
			),
	},
	around: (effect) =>
		Effect.gen(function* () {
			const { spans, tracer } = yield* Recording;
			spans.length = 0;
			return yield* effect.pipe(Effect.withSpan("story"), Effect.withTracer(tracer));
		}),
	*create() {
		const { spans } = yield* Recording;
		yield* Effect.void.pipe(Effect.withSpan("engine startup"));
		yield* Effect.addFinalizer(() => Effect.void.pipe(Effect.withSpan("engine finalizer")));
		return { spans, url: "" };
	},
	layer: Layer.sync(Recording, recording),
	name: "after tracing app",
	stages: ["deployment", "ready"],
	verbs: (engine, story) => ({
		request: (headers?: HeadersInit) =>
			Effect.promise(async () => {
				story.tell("a caller sends a request");
				const response = await fetch(engine.url, { headers: headers ?? {} });
				return response.text();
			}).pipe(Effect.withSpan("request verb")),
		spans: engine.spans,
	}),
});

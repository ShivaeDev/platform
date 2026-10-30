import { Effect, Layer, type Tracer } from "effect";
import { HttpEffect, HttpServerResponse } from "effect/http";
import { storyKit } from "#storyKit.ts";
import { domHost } from "#test/domHost.ts";
import { Recording, recording, spanReadouts, tracedAsTheStory } from "#test/spanRecording.ts";

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
	around: (effect) => tracedAsTheStory(effect),
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
		...spanReadouts(engine.spans),
		keepsSpans: (keep: (spans: readonly Tracer.NativeSpan[]) => void) => Effect.sync(() => keep(engine.spans)),
		sendsRequest: () =>
			Effect.promise(async () => {
				story.tell("a caller sends a request");
				await (await fetch(engine.url)).text();
			}).pipe(Effect.withSpan("request verb")),
	}),
});

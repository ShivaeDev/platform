import { Effect, Layer } from "effect";
import { HttpEffect, HttpServerResponse } from "effect/http";
import { storyKit } from "#storyKit.ts";
import { Recording, recording } from "#test/spanRecording.ts";

export const tracingApp = storyKit({
	around: (effect) =>
		Effect.gen(function* () {
			const { spans, tracer } = yield* Recording;
			spans.length = 0;
			return yield* effect.pipe(Effect.withSpan("story"), Effect.withTracer(tracer));
		}),
	*create() {
		const { spans } = yield* Recording;
		const context = yield* Effect.context<never>();
		const handler = HttpEffect.toWebHandlerWith(context)(Effect.succeed(HttpServerResponse.text("ok")).pipe(Effect.withSpan("request work")));
		return { handler, spans, steps: 0 };
	},
	layer: Layer.sync(Recording, recording),
	name: "tracing app",
	run: {
		maxSteps: 1,
		*step(engine, tell) {
			yield* Effect.sync(() => {
				engine.steps += 1;
				tell("the engine takes a step");
			}).pipe(Effect.withSpan("story step"));
		},
	},
	stages: ["ready"],
	verbs: (engine, story) => ({
		request: (headers?: HeadersInit) =>
			Effect.promise(async () => {
				story.tell("a caller sends a request");
				const response = await engine.handler(new Request("http://app.test/", { headers: headers ?? {} }));
				return response.text();
			}),
		spans: engine.spans,
		step: () => story.runUntil((current) => current.steps === 1),
	}),
});

export const ready = tracingApp.trait("ready", "the application is ready", () => Effect.void.pipe(Effect.withSpan("story trait")));

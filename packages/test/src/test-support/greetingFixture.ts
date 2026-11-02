import type { TestContext } from "@effect/vitest";
import { Context, Effect, Layer, Option, type Tracer } from "effect";
import { makeEffectIt } from "#adapters/makeEffectIt.ts";
import { clockReading } from "./clockReading.ts";

export class Greeting extends Context.Service<Greeting, string>()("@test/Greeting") {}

class AcquisitionClock extends Context.Service<AcquisitionClock, string>()("@test/AcquisitionClock") {}

const WRAPPER = "the greeting wrapper";

function enclosingSpans(span: Tracer.AnySpan): readonly string[] {
	return span._tag === "Span" ? [span.name, ...Option.match(span.parent, { onNone: () => [], onSome: enclosingSpans })] : [];
}

const wrapperReading = Effect.match(Effect.currentSpan, {
	onFailure: () => `outside ${WRAPPER}`,
	onSuccess: (span) => (enclosingSpans(span).includes(WRAPPER) ? `inside ${WRAPPER}` : `outside ${WRAPPER}`),
});

const greetingLayer = Layer.mergeAll(Layer.succeed(Greeting, "hello from the Layer"), Layer.effect(AcquisitionClock, clockReading));

const greetingHarness = Effect.fn("GreetingFixture.greetingHarness")(function* (context: TestContext) {
	const greeting = yield* Greeting;
	const harnessClock = yield* clockReading;
	const harnessWrapper = yield* wrapperReading;
	return {
		clock: () => clockReading,
		greeting: () => Effect.succeed(greeting),
		harnessClock: () => Effect.succeed(harnessClock),
		harnessWrapper: () => Effect.succeed(harnessWrapper),
		layerClock: () => Effect.service(AcquisitionClock),
		testName: () => Effect.succeed(context.task.name),
		wrapper: () => wrapperReading,
	};
});

export const greetingApp = makeEffectIt({
	around: (effect) => Effect.withSpan(effect, WRAPPER),
	layer: greetingLayer,
	makeHarness: greetingHarness,
}).effectApp;

export const liveGreetingApp = makeEffectIt({ clock: "live", layer: greetingLayer, makeHarness: greetingHarness }).effectApp;

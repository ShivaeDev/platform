import type { TestContext } from "@effect/vitest";
import { Context, Data, Effect, Layer } from "effect";
import { makeEffectIt } from "#adapters/makeEffectIt.ts";
import { note, releasedOnClose } from "./lifecycleLog.ts";

class BodyFailure extends Data.TaggedError("BodyFailure")<{ readonly message: string }> {}

class Worker extends Context.Service<Worker, { readonly failure: BodyFailure }>()("@shivaedev/test/test/Worker") {}

const { effectApp } = makeEffectIt({
	layer: Layer.effect(
		Worker,
		Effect.gen(function* () {
			yield* note("the shared worker starts");
			yield* releasedOnClose("the shared worker");
			return { failure: new BodyFailure({ message: "the shared worker refused the body" }) };
		}),
	),
	makeHarness: (context) => Effect.map(Worker, (worker) => ({ context, worker })),
});

const refuse = Effect.fnUntraced(function* (
	harness: { readonly context: TestContext; readonly worker: { readonly failure: BodyFailure } },
	context: TestContext,
) {
	const worker = yield* Worker;
	yield* note(`${context.task.name}: ${harness.context === context ? "one context" : "different contexts"}`);
	yield* note(`${context.task.name}: ${harness.worker === worker ? "one worker" : "different workers"}`);
	return yield* worker.failure;
});

effectApp("ordinary generator refusal", function* (harness, context) {
	return yield* refuse(harness, context);
});
effectApp("ordinary Effect refusal", refuse);
effectApp.each(["refusal"])("table generator %s", function* (_item, harness, context) {
	return yield* refuse(harness, context);
});
effectApp.each(["refusal"])("table Effect %s", (_item, harness, context) => refuse(harness, context));

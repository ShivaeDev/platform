import type { TestContext } from "@effect/vitest";
import { Context, Data, Effect, Layer } from "effect";
import { makeEffectIt } from "#adapters/makeEffectIt.ts";
import { note, releasedOnClose } from "./lifecycleLog.ts";

class BodyFailure extends Data.TaggedError("BodyFailure")<{ readonly message: string }> {}
class FileFailure extends Context.Service<FileFailure, Effect.Effect<never, BodyFailure>>()("@test/FileFailure") {}

const { effectApp } = makeEffectIt({
	layer: Layer.effect(
		FileFailure,
		Effect.acquireRelease(Effect.as(note("the shared Layer opened"), Effect.fail(new BodyFailure({ message: "the shared service failed" }))), () =>
			note("the shared Layer closed"),
		),
	),
	makeHarness: (context) => Effect.as(releasedOnClose(`${context.task.name}'s harness`), context),
});

function* failingBody(harness: TestContext, context: TestContext) {
	yield* note(`${context.task.name}: ${harness === context ? "the same context" : "different contexts"}`);
	yield* releasedOnClose(`${context.task.name}'s body`);
	return yield* yield* FileFailure;
}

const effectBody = Effect.fnUntraced(failingBody);

effectApp("ordinary generator failure", failingBody);
effectApp("ordinary Effect failure", effectBody);
effectApp.each(["generator"])("table %s failure", function* (_item, harness, context) {
	return yield* failingBody(harness, context);
});
effectApp.each(["Effect"])("table %s failure", (_item, harness, context) => effectBody(harness, context));

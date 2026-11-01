import { Context, Data, Effect, Layer } from "effect";
import { it } from "vitest";
import { makeEffectIt } from "#adapters/makeEffectIt.ts";
import { note, releasedOnClose } from "./lifecycleLog.ts";

class StartupFailure extends Data.TaggedError("StartupFailure")<{ readonly message: string }> {}

class Connection extends Context.Service<Connection, string>()("@test/Connection") {}

const { effectApp } = makeEffectIt({
	layer: Layer.effect(
		Connection,
		Effect.gen(function* () {
			yield* releasedOnClose("the worker's connection");
			return yield* new StartupFailure({ message: "database connection refused during worker startup" });
		}),
	),
	makeHarness: () => Effect.void,
});

effectApp("a test of a worker whose Layer fails to start", function* () {
	yield* Connection;
	yield* note("the test body ran");
});

it("the test after the failed worker startup", () => Effect.runSync(note("the next test ran")));

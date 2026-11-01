import { Context, Effect, Layer } from "effect";
import { makeEffectIt } from "#adapters/makeEffectIt.ts";
import { note } from "./lifecycleLog.ts";

class FileService extends Context.Service<FileService, string>()("@test/PendingFileService") {}

const { effectApp } = makeEffectIt({
	layer: Layer.effect(
		FileService,
		Effect.gen(function* () {
			yield* Effect.addFinalizer(() => Effect.andThen(Effect.yieldNow, note("the pending Layer released its connection")));
			yield* note("the Layer is waiting for startup");
			return yield* Effect.never;
		}),
	),
	makeHarness: () => Effect.void,
});

effectApp(
	"a test waiting for its file Layer",
	function* () {
		yield* note("the test body ran");
	},
	25,
);

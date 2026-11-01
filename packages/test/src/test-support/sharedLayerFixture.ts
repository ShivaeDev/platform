import { Context, Effect, Layer } from "effect";
import { makeEffectIt } from "#adapters/makeEffectIt.ts";
import { note } from "./lifecycleLog.ts";

class FileService extends Context.Service<FileService, string>()("@test/FileService") {}

const { effectApp } = makeEffectIt({
	layer: Layer.effect(
		FileService,
		Effect.acquireRelease(Effect.as(note("the Layer opened its service"), "the file's service"), () => note("the Layer closed its service")),
	),
	makeHarness: () => Effect.void,
});

for (const test of ["first", "second"]) {
	effectApp(`the ${test} test of the shared Layer`, function* () {
		yield* note(`the ${test} test used ${yield* FileService}`);
	});
}

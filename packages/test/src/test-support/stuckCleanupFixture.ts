import { Effect, Layer } from "effect";
import { it } from "#it.ts";
import { makeEffectIt } from "#makeEffectIt.ts";
import { note } from "./lifecycleLog.ts";

const { effectApp } = makeEffectIt({ layer: Layer.empty, makeHarness: () => Effect.void });

effectApp(
	"a test whose cleanup never finishes",
	function* () {
		yield* Effect.addFinalizer(() => Effect.never);
		yield* Effect.never;
	},
	25,
);

for (const tester of ["effect", "live"] as const) {
	it[tester](
		`an it.${tester} test whose cleanup never finishes`,
		function* () {
			yield* Effect.addFinalizer(() => Effect.never);
			yield* Effect.never;
		},
		25,
	);
}

it("the test after a cleanup that never finishes", () => Effect.runSync(note("the next test ran")));

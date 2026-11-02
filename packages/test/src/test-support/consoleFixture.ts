import { Console, Effect, Layer } from "effect";
import * as TestConsole from "effect/testing/TestConsole";
import { makeEffectIt } from "#makeEffectIt.ts";
import { note } from "./lifecycleLog.ts";

for (const clock of ["live", "test"] as const) {
	const { effectApp } = makeEffectIt({ clock, layer: Layer.empty, makeHarness: () => Effect.void });
	for (const name of ["first", "next"] as const) {
		effectApp(`the ${name} console test under the ${clock} clock`, function* () {
			yield* note(`${name} starts with ${JSON.stringify(yield* TestConsole.logLines)}`);
			yield* Console.log(`${name}'s output`);
			yield* note(`${name} captures ${JSON.stringify(yield* TestConsole.logLines)}`);
		});
	}
}

import { Config, Effect, Layer } from "effect";
import { it } from "#it.ts";
import { makeEffectIt } from "#makeEffectIt.ts";
import type { BodyTester } from "./BodyTester.ts";
import { note } from "./lifecycleLog.ts";

const { effectApp } = makeEffectIt({ layer: Layer.empty, makeHarness: () => Effect.void });
const variant = Effect.runSync(Config.String("TESTER_VARIANT").pipe(Config.withDefault("default")));

const testers: readonly (readonly [string, BodyTester])[] = [
	["fixture", effectApp],
	["it.effect", it.effect],
	["it.live", it.live],
];

for (const [name, tester] of testers) {
	const register = (() => {
		switch (variant) {
			case "fails":
				return tester.fails;
			case "only":
				return tester.only;
			case "runIf":
				return tester.runIf(true);
			case "skipIf":
				return tester.skipIf(false);
			case "skip":
				return tester.skip;
			case "runIf(false)":
				return tester.runIf(false);
			case "skipIf(true)":
				return tester.skipIf(true);
			default:
				return tester;
		}
	})();
	function body(form: string) {
		return Effect.andThen(note(`${name} ran its ${form} body`), variant === "fails" ? Effect.fail("the expected failure") : Effect.void);
	}
	register(`${name} generator`, function* () {
		yield* body("generator");
	});
	register(`${name} Effect`, () => body("Effect"));
}

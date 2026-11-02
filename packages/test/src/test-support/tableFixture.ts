import { Effect, Layer, type Scope } from "effect";
import { it } from "#it.ts";
import { makeEffectIt } from "#makeEffectIt.ts";
import type { EffectItTest } from "#types.ts";
import { note, releasedOnClose } from "./lifecycleLog.ts";

const { effectApp } = makeEffectIt({ layer: Layer.empty, makeHarness: () => Effect.void });

type TableTest = EffectItTest<Scope.Scope, [item: string]>;
const tables: readonly (readonly [string, TableTest])[] = [
	["fixture", effectApp.each(["alpha", "beta"])],
	["it.effect", it.effect.each(["alpha", "beta"])],
	["it.live", it.live.each(["alpha", "beta"])],
];

for (const [name, table] of tables) {
	table(`${name} generator table case %s`, function* (item) {
		yield* releasedOnClose(`${item}'s resource`);
		yield* note(`the body received ${item}`);
	});
	table(`${name} Effect table case %s`, (item) => Effect.andThen(releasedOnClose(`${item}'s resource`), note(`the body received ${item}`)));
}

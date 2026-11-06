import { expect } from "@effect/vitest";
import { serviceParameters } from "#rules/effect/serviceParameters.ts";
import { effectResolves, serviceModule } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const [name, code, accepted] of [
	[
		"a callback consumed by its owner",
		"function consume(read: (store: StoreShape) => Effect.Effect<string>) { return Effect.flatMap(Store, read); } consume((store) => store.read());",
		true,
	],
	[
		"a wrapper returning a private operation",
		"const identity = <T>(value: T) => value; const privateOperation = identity((store: StoreShape) => store.read());",
		false,
	],
	[
		"an imported identity wrapper returning a private operation",
		'import { identity } from "effect/Function"; const wrapped = identity((store: StoreShape) => store.read());',
		false,
	],
	[
		"a callback consumed by an Effect function",
		"const consume = Effect.fnUntraced(function* (read: (store: StoreShape) => Effect.Effect<string>) { return yield* Effect.flatMap(Store, read); }); consume((store) => store.read());",
		true,
	],
	[
		"a wrapped private Effect operation",
		"const privateOperation = Effect.fnUntraced(function* (store: StoreShape) { return yield* store.read(); });",
		false,
	],
	["a service type guard", "export function isStore(store: StoreShape | undefined): store is StoreShape { return store !== undefined; }", true],
	["a private service operation", "function privateOperation(store: StoreShape) { return store.read(); }", false],
] as const) {
	ruleStory.it(
		`service parameters distinguishes ${name} from dependency plumbing`,
		[effectResolves(), repositoryHas(serviceModule("src/callback.ts", code))],
		function* ({ check }) {
			expect(yield* check(serviceParameters)).toEqual(accepted ? [] : [expect.objectContaining({ file: "src/callback.ts" })]);
		},
	);
}

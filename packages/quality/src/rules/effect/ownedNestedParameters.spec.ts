import { expect } from "@effect/vitest";
import { serviceParameters } from "#rules/effect/serviceParameters.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { serviceResolves } from "#test/serviceModelFiles.ts";

ruleStory.it(
	"service parameters follows owned state through nested helpers and reports borrowed helper parameters",
	[
		effectResolves(),
		serviceResolves(),
		repositoryHas(
			{
				content: `import { defineService } from "@shivaedev/service/adapters/defineService.ts";
import { initialize } from "./initialize.ts";
import { read } from "./read.ts";
export const Inventory = defineService({ id: "app/Inventory", initialize, requires: [], methods: (state) => ({ read: read(state) }) });`,
				path: "src/inventory/service.ts",
			},
			{
				content: `import { Effect, Scope } from "effect";
export const initialize = Effect.gen(function* () { return { lifetime: yield* Scope.Scope }; });`,
				path: "src/inventory/initialize.ts",
			},
			{
				content: `import { Effect, Scope } from "effect";
type State = { readonly lifetime: Scope.Scope };
const nested = Effect.fn("Inventory.nested")((scope: Scope.Scope) => Effect.succeed(scope));
function acquire(scope: Scope.Scope) { return nested(scope); }
function shared(scope: Scope.Scope) { return Effect.succeed(scope); }
export const read = (state: State) => Effect.fn("Inventory.read")(() => acquire(state.lifetime));
export const share = (state: State) => shared(state.lifetime);
export const unrelated = Effect.gen(function* () { return shared(yield* Scope.Scope); });
export const borrowed = (scope: Scope.Scope) => scope;`,
				path: "src/inventory/read.ts",
			},
		),
	],
	function* ({ check }) {
		const findings = yield* check(serviceParameters);

		expect(findings).toEqual([
			expect.objectContaining({ file: "src/inventory/read.ts", line: 7 }),
			expect.objectContaining({ file: "src/inventory/read.ts", line: 9 }),
			expect.objectContaining({ file: "src/inventory/read.ts", line: 5 }),
		]);
	},
);

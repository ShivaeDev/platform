import { expect } from "@effect/vitest";
import { serviceParameters } from "#rules/effect/serviceParameters.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { serviceResolves } from "#test/serviceModelFiles.ts";

for (const [name, otherCall] of [
	["owned state", ""],
	["hand-built state", "export const other = Effect.gen(function* () { const lifetime = yield* Scope.Scope; return inspect({ lifetime }); });"],
	["an omitted state argument", "export const missing = inspect();"],
] as const) {
	ruleStory.it(
		`service parameters ${otherCall ? `rejects ${name} beside` : "accepts"} state passed from the service methods factory while reporting an independent Scope`,
		[
			effectResolves(),
			serviceResolves(),
			repositoryHas(
				{
					content: `import { defineService } from "@shivaedev/service/defineService.ts";
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
function inspect(state?: State) { return state?.lifetime; }
export const read = (state: State) => Effect.fn("Inventory.read")(() => Effect.succeed(inspect(state)));
export const borrowed = (scope: Scope.Scope) => scope;
${otherCall}`,
					path: "src/inventory/read.ts",
				},
			),
		],
		function* ({ check }) {
			const findings = yield* check(serviceParameters);

			const stateFinding = expect.objectContaining({
				file: "src/inventory/read.ts",
				line: 3,
				message: expect.stringContaining("Parameter state carries a service."),
			});
			expect(findings).toEqual([
				expect.objectContaining({ file: "src/inventory/read.ts", line: 5, message: expect.stringContaining("Parameter scope carries a service.") }),
				...(otherCall ? [stateFinding] : []),
			]);
		},
	);
}

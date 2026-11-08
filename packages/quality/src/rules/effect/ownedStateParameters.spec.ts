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

ruleStory.it(
	"service parameters keeps imported owned state through helpers at every depth and reports a borrowed Scope",
	[
		effectResolves(),
		serviceResolves(),
		repositoryHas(
			{
				content: `import { defineService } from "@shivaedev/service/defineService.ts";
import { initialize } from "./initialize.ts";
import { execute } from "./execute.ts";
export const Fabric = defineService({ id: "app/Fabric", initialize, requires: [], methods: (state) => ({ execute: execute(state) }) });`,
				path: "src/fabric/service.ts",
			},
			{
				content: `import { Effect, Scope } from "effect";
import type { State } from "./state.ts";
export const initialize = Effect.fn("Fabric.initialize")(function* () { return { lifetime: yield* Scope.Scope, attachments: new Map() } satisfies State; })();`,
				path: "src/fabric/initialize.ts",
			},
			{
				content: `import type { Scope } from "effect";
export interface State { readonly lifetime: Scope.Scope; readonly attachments: Map<string, Scope.Closeable> }`,
				path: "src/fabric/state.ts",
			},
			{
				content: `import { Effect } from "effect";
import type { State } from "./state.ts";
import { run } from "./operation.ts";
export const execute = (state: State) => Effect.fn("Fabric.execute")(function* (id: string) { return yield* run(state, id); });`,
				path: "src/fabric/execute.ts",
			},
			{
				content: `import { Effect } from "effect";
import type { State } from "./state.ts";
import { close } from "./close.ts";
export const run = Effect.fn("Fabric.operation")(function* (state: State, id: string) { yield* close(state, id); });`,
				path: "src/fabric/operation.ts",
			},
			{
				content: `import { Effect, Exit, Scope } from "effect";
import type { State } from "./state.ts";
export const close = Effect.fn("Fabric.close")(function* (state: State, id: string) { const e = state.attachments.get(id); if (e) yield* Scope.close(e, Exit.void); });
export const borrowed = (scope: Scope.Scope) => scope;`,
				path: "src/fabric/close.ts",
			},
		),
	],
	function* ({ check }) {
		const findings = yield* check(serviceParameters);

		expect(findings).toEqual([expect.objectContaining({ file: "src/fabric/close.ts", line: 4 })]);
	},
);

import { expect } from "vitest";
import { effectPolicyStory, policyFiles } from "#effect-policy-story";
import { SERVICE_DECLARATION } from "#test/effectPolicyFiles.ts";

const ORDINARY_PARAMETERS = [
	{ name: "atom", type: "Atom.Atom<string>" },
	{ name: "schema", type: "Schema.Schema<string>" },
	{ name: "record", type: "Record<string, unknown>" },
	{ name: "tuple", type: "readonly [string, number]" },
	{ name: "lookalike", type: "{ readonly read: () => Effect.Effect<string> }" },
];

for (const { name, type } of ORDINARY_PARAMETERS) {
	effectPolicyStory.it(
		`${name} parameters are accepted alongside real service parameters`,
		[
			policyFiles({
				content: `${SERVICE_DECLARATION}
import { Duration, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as HttpMiddleware from "effect/http/HttpMiddleware";
export const Window = Context.Service<Duration.Input>("Window");
export const nameGenerator = HttpMiddleware.SpanNameGenerator;
export const ordinary = (${name}: ${type}) => ${name};
export const tag = (serviceTag: typeof Store) => serviceTag;
export const instance = (serviceInstance: Store) => serviceInstance;
export const implementation = (serviceShape: StoreShape) => serviceShape;
export const context = (services: Context.Context<Store>) => services;`,
				path: "src/parameters.ts",
			}),
		],
		function* ({ lint }) {
			const result = yield* lint();
			const exitCode = result.status;
			expect(exitCode).toBe(1);
			expect(result.stdout).not.toContain(`Parameter ${name} carries a service.`);
			expect(result.stdout.match(/Parameter .+ carries a service\./gu)).toEqual([
				"Parameter serviceTag carries a service.",
				"Parameter serviceInstance carries a service.",
				"Parameter serviceShape carries a service.",
				"Parameter services carries a service.",
			]);
		},
	);
}

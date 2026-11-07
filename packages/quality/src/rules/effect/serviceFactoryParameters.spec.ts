import { expect } from "@effect/vitest";
import { serviceParameters } from "#rules/effect/serviceParameters.ts";
import { effectResolves, serviceModule } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

ruleStory.it(
	"service parameters reports service factories beside computations, owned handles and recursive callable values",
	[
		effectResolves(),
		repositoryHas(
			serviceModule(
				"src/factory.ts",
				`import type { Scope } from "effect";
export const consume = (factory: () => Store) => factory();
export const computation = (factory: () => Effect.Effect<string, never, Store>) => factory();
export const ownedHandle = (factory: () => Scope.Closeable) => factory();
interface Recursive<T> { <U>(): Recursive<[T, U]>; }
export const recursive = (factory: Recursive<unknown>) => factory();`,
			),
		),
	],
	function* ({ check }) {
		const findings = yield* check(serviceParameters);

		expect(findings).toEqual([expect.objectContaining({ message: expect.stringContaining("Parameter factory carries a service.") })]);
	},
);

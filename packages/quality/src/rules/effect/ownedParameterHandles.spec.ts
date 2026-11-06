import { expect } from "@effect/vitest";
import { serviceParameters } from "#rules/effect/serviceParameters.ts";
import { effectResolves, serviceModule } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

ruleStory.it(
	"service parameters keeps owned lifetime handles separate from an environment service",
	[
		effectResolves(),
		repositoryHas(
			serviceModule(
				"src/handles.ts",
				`import { Fiber, Scope } from "effect";
import type * as Atom from "effect/reactivity/Atom";
function close(scope: Scope.Closeable) { return scope; }
function observe(fiber: Fiber.Fiber<void>) { return fiber; }
function atomValue(context: Atom.AtomContext) { return context; }
function borrowed(store: StoreShape) { return store.read(); }`,
			),
		),
	],
	function* ({ check }) {
		expect(yield* check(serviceParameters)).toEqual([
			expect.objectContaining({ message: expect.stringContaining("Parameter store carries a service.") }),
		]);
	},
);

import { expect } from "@effect/vitest";
import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { storyKit } from "#storyKit.ts";

const scoped = storyKit({
	after: {
		*setup(engine) {
			if (engine.refuseAfter) {
				engine.registry.set(engine.count, 9);
				return yield* Effect.fail("after hook refused");
			}
		},
	},
	*create() {
		const registry = yield* Effect.acquireRelease(
			Effect.sync(() => AtomRegistry.make()),
			(current) => Effect.sync(() => current.dispose()),
		);
		return { count: Atom.make(0), refuseAfter: false, registry };
	},
	inspect: (engine) => ({ count: engine.registry.get(engine.count) }),
	name: "scoped registry",
	stages: ["setup"],
	verbs: (engine) => ({ count: () => engine.registry.get(engine.count), edit: (count: number) => engine.registry.set(engine.count, count) }),
});
const refusal = scoped.trait("setup", "a trait refuses", function* (engine) {
	engine.registry.set(engine.count, 7);
	return yield* Effect.fail("trait refused");
});
const refusedAfter = scoped.trait("setup", "the after hook refuses", (engine) => {
	engine.refuseAfter = true;
});

scoped.it("fails in the body", [], ({ edit, count }) => {
	edit(42);
	expect(count()).toBe(0);
});
scoped.it("fails in a trait", [refusal]);
scoped.it("fails in an after hook", [refusedAfter]);

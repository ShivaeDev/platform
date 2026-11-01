import { Context, Effect, Layer } from "effect";
import { storyKit } from "#storyKit.ts";

const unavailable = {
	name: "unavailable mill",
	stages: [],
	verbs: () => ({}),
};

const throwing = storyKit({
	...unavailable,
	create: () => {
		throw new Error("the mill is closed");
	},
});
const failing = storyKit({ ...unavailable, create: () => Effect.fail("the mill is closed") });
const dying = storyKit({
	...unavailable,
	*create() {
		return yield* Effect.die({ reason: "the mill is closed" });
	},
});

throwing.it("creation throws", []);
failing.it("creation fails", []);
dying.it("creation dies", []);

class Inventory extends Context.Service<Inventory, string>()("lifecycleFailure/Inventory") {}

const closing = storyKit({
	*create() {
		const engine = { closed: false, inspection: "reads", sacks: 0 };
		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				engine.closed = true;
			}).pipe(Effect.andThen(Effect.die("the mill could not close"))),
		);
		return engine;
	},
	inspect: (engine) =>
		Effect.gen(function* () {
			yield* Effect.yieldNow;
			const inventory = yield* Inventory;
			if (engine.inspection === "fails") {
				return yield* Effect.fail("inventory is closed");
			}
			return { closed: engine.closed, inventory, sacks: engine.sacks };
		}),
	layer: Layer.succeed(Inventory, "grain"),
	name: "closing mill",
	stages: ["yard"],
	verbs: (engine, story) => ({
		grind: (sacks: number) => {
			story.tell(`the miller grinds ${sacks} sacks`);
			engine.sacks += sacks;
		},
	}),
});

const closedInventory = closing.trait("yard", "the inventory is closed", (engine) => {
	engine.inspection = "fails";
});

closing.it("cleanup fails", [], ({ grind }) => {
	grind(2);
});

closing.it("cleanup and inspection fail", [closedInventory]);

closing.it("the body and cleanup fail", [], function* ({ grind }) {
	grind(3);
	return yield* Effect.fail("the story failed");
});

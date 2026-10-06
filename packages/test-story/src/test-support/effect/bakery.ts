import { Context, Data, Effect, Layer } from "effect";
import { effectStoryKit } from "#effect/storyKit.ts";
import { type BakeReport, emptyBakery, fitBowls, ovenTrouble, stillWaiting } from "#test/bakery.ts";

export class SupplierShort extends Data.TaggedError("SupplierShort")<{ readonly message: string }> {}

export class NoBowls extends Data.TaggedError("NoBowls") {}

export class OutOfFlour extends Data.TaggedError("OutOfFlour")<{ readonly minute: number }> {}

export class MillClosed extends Data.TaggedError("MillClosed")<{ readonly until: string }> {}

const MOST_SACKS = 5;

export class Supplier extends Context.Service<Supplier, { readonly deliver: (sacks: number) => Effect.Effect<void, SupplierShort> }>()(
	"@shivaedev/test-story/Supplier",
) {
	static readonly layer = Layer.succeed(Supplier, {
		deliver: (sacks) =>
			sacks > MOST_SACKS ? Effect.fail(new SupplierShort({ message: `the supplier delivers at most ${MOST_SACKS} sacks` })) : Effect.void,
	});
}

const bakery = effectStoryKit({
	after: {
		*kitchen(state) {
			if (state.bowls === 0) {
				return yield* new NoBowls();
			}
			fitBowls(state);
		},
	},
	create: emptyBakery,
	inspect: ({ dough, flour, loaves, minute, ovenLit }) => ({ dough, flour, loaves, minute, ovenLit }),
	name: "bakery",
	run: {
		diagnose: stillWaiting,
		failed: ovenTrouble,
		maxSteps: 60,
		*step(state, tell) {
			state.minute += 1;
			if (state.flour === 0) {
				return yield* new OutOfFlour({ minute: state.minute });
			}
			state.flour -= 1;
			state.dough -= 1;
			state.loaves += 1;
			tell(`${state.minute}m a loaf comes out of the oven`);
		},
	},
	stages: ["kitchen", "pantry"],
	verbs: (state, story) => ({
		oven: {
			bakesEverything: (maxSteps?: number): Effect.Effect<BakeReport, OutOfFlour> =>
				story.runUntil((current) => current.dough === 0, { maxSteps }).pipe(Effect.map(() => ({ loaves: state.loaves, minutes: state.minute }))),
		},
	}),
});

export const newBakery = bakery.start;

export const { traits } = bakery;

export function hasBowls(count: number) {
	return bakery.trait("kitchen", `the bakery has ${count} bowls`, (state) => {
		state.bowls = count;
	});
}

export function ovenIsLit() {
	return bakery.trait("kitchen", "the oven is lit", (state) => {
		state.ovenLit = true;
	});
}

export function bakerIsCalledAway() {
	return bakery.trait("kitchen", "the baker is called away", function* () {
		yield* Effect.interrupt;
	});
}

export function hasSpoiledYeast() {
	return bakery.trait("pantry", "the yeast has spoiled", function* () {
		yield* Effect.die(new Error("the dough will not rise"));
	});
}

export function hasNoBowls() {
	return bakery.trait("kitchen", "the bakery has no bowls", (state) => {
		state.bowls = 0;
	});
}

export function hasFlourDelivered(sacks: number) {
	return bakery.trait("pantry", `the supplier has delivered ${sacks} sacks of flour`, function* (state) {
		const supplier = yield* Supplier;
		yield* supplier.deliver(sacks);
		state.flour = sacks;
	});
}

export function hasFlourFromTheMill() {
	return bakery.trait("pantry", "the mill has sent flour", function* () {
		yield* Effect.fail("the mill is closed");
	});
}

export function hasOatsFromTheMill() {
	return bakery.trait("pantry", "the mill has sent oats", function* () {
		yield* Effect.fail({ mill: "closed", sacks: 0 });
	});
}

export function hasRyeFromTheMill() {
	return bakery.trait("pantry", "the mill has sent rye", function* () {
		yield* new MillClosed({ until: "Monday" });
	});
}

export function hasDough(count: number) {
	return bakery.trait("pantry", `the baker has ${count} balls of dough`, (state) => {
		if (count > state.capacity) {
			throw new Error(`the bowls hold only ${state.capacity}`);
		}
		state.dough = count;
	});
}

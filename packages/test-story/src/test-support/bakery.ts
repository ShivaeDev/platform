import { Context, Data, Effect, Layer } from "effect";
import { storyKit } from "#storyKit.ts";

export interface Bakery {
	bowls: number;
	capacity: number;
	dough: number;
	flour: number;
	loaves: number;
	minute: number;
	orders: string[];
	ovenLit: boolean;
	overfired: boolean;
	smoking: boolean;
	starter: boolean;
}

export interface BakeReport {
	readonly loaves: number;
	readonly minutes: number;
}

export class SupplierShort extends Data.TaggedError("SupplierShort")<{ readonly message: string }> {}

export class NoBowls extends Data.TaggedError("NoBowls") {}

export class BurntLoaf extends Data.TaggedError("BurntLoaf")<{ readonly minute: number }> {}

export class MillClosed extends Data.TaggedError("MillClosed")<{ readonly until: string }> {}

const MOST_SACKS = 5;

const DOUGH_PER_BOWL = 3;

export class Supplier extends Context.Service<Supplier, { readonly deliver: (sacks: number) => Effect.Effect<void, SupplierShort> }>()(
	"@shivaedev/test-story/Supplier",
) {
	static readonly layer = Layer.succeed(Supplier, {
		deliver: (sacks) =>
			sacks > MOST_SACKS ? Effect.fail(new SupplierShort({ message: `the supplier delivers at most ${MOST_SACKS} sacks` })) : Effect.void,
	});
}

function emptyBakery(): Bakery {
	return {
		bowls: 1,
		capacity: 0,
		dough: 0,
		flour: 0,
		loaves: 0,
		minute: 0,
		orders: [],
		ovenLit: false,
		overfired: false,
		smoking: false,
		starter: false,
	};
}

function ovenTrouble(state: Bakery): string | undefined {
	if (state.smoking) {
		return "the oven fills the bakery with smoke";
	}
	return !state.ovenLit && state.dough > 0 ? `the oven is cold with ${state.dough} balls of dough waiting` : undefined;
}

function stillWaiting(state: Bakery): string {
	return `${state.dough} balls of dough still wait after ${state.minute} minutes${state.starter ? ": the sourdough starter never runs out" : ""}`;
}

export const bakery = storyKit({
	after: {
		*kitchen(state) {
			if (state.bowls === 0) {
				return yield* new NoBowls();
			}
			state.capacity = state.bowls * DOUGH_PER_BOWL;
		},
	},
	create: emptyBakery,
	layer: Supplier.layer,
	name: "bakery",
	run: {
		diagnose: stillWaiting,
		failed: ovenTrouble,
		maxSteps: 60,
		*step(state, tell) {
			state.minute += 1;
			if (state.overfired) {
				return yield* new BurntLoaf({ minute: state.minute });
			}
			state.dough += state.starter ? 0 : -1;
			state.loaves += 1;
			tell(`${state.minute}m a loaf comes out of the oven`);
		},
	},
	stages: ["kitchen", "pantry"],
	verbs: (state, story) => ({
		baker: {
			kneads: (count: number) => {
				story.tell(`the baker kneads ${count} balls of dough`);
				state.dough += count;
			},
		},
		oven: {
			bakesEverything: (maxSteps?: number): Effect.Effect<BakeReport, BurntLoaf> =>
				story.runUntil((current) => current.dough === 0, { maxSteps }).pipe(Effect.map(() => ({ loaves: state.loaves, minutes: state.minute }))),
		},
	}),
});

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

export function ovenSmokes() {
	return bakery.trait("kitchen", "the oven smokes", (state) => {
		state.smoking = true;
	});
}

export function ovenIsOverfired() {
	return bakery.trait("kitchen", "the oven is overfired", (state) => {
		state.overfired = true;
	});
}

export function keepsSourdough() {
	return bakery.trait("kitchen", "the baker keeps a sourdough starter", (state) => {
		state.starter = true;
	});
}

export function morningShift() {
	return bakery.traits(ovenIsLit(), hasBowls(1));
}

export function bakerIsCalledAway() {
	return bakery.trait("kitchen", "the baker is called away", function* () {
		yield* Effect.interrupt;
	});
}

export function hasNoBowls() {
	return bakery.trait("kitchen", "the bakery has no bowls", (state) => {
		state.bowls = 0;
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

export function hasOrders(count: number) {
	return bakery.trait("pantry", `the bakery has ${count} orders`, (state) => {
		state.orders = Array.from({ length: count }, (_, index) => `order ${index + 1}: a loaf of rye for the market stall`);
	});
}

export function hasSpoiledYeast() {
	return bakery.trait("pantry", "the yeast has spoiled", function* () {
		yield* Effect.die(new Error("the dough will not rise"));
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

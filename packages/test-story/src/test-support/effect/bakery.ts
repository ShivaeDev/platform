import { Context, Data, Effect, Layer } from "effect";
import { settleEffect } from "#effect/settle.ts";
import { effectStoryKit, type TargetTrait } from "#effect/storyKit.ts";
import { type BakeReport, type Bakery, emptyBakery, fitBowls, ovenTrouble, stillWaiting } from "#test/bakery.ts";

export class SupplierShort extends Data.TaggedError("SupplierShort")<{ readonly message: string }> {}

export class NoBowls extends Data.TaggedError("NoBowls") {}

export class OutOfFlour extends Data.TaggedError("OutOfFlour")<{ readonly minute: number }> {}

const MOST_SACKS = 5;

export class Supplier extends Context.Service<Supplier, { readonly deliver: (sacks: number) => Effect.Effect<void, SupplierShort> }>()(
	"@shivaedev/test-story/Supplier",
) {
	static readonly layer = Layer.succeed(Supplier, {
		deliver: (sacks) =>
			sacks > MOST_SACKS ? Effect.fail(new SupplierShort({ message: `the supplier delivers at most ${MOST_SACKS} sacks` })) : Effect.void,
	});
}

export type BakeryTrait = TargetTrait<Bakery, Supplier, "kitchen" | "pantry">;

const kit = effectStoryKit<Bakery, Supplier>()("kitchen", "pantry");

export const { traits } = kit;

export function hasBowls(count: number) {
	return kit.trait("kitchen", `the bakery has ${count} bowls`, (bakery) =>
		Effect.sync(() => {
			bakery.bowls = count;
		}),
	);
}

export function ovenIsLit() {
	return kit.trait("kitchen", "the oven is lit", (bakery) =>
		Effect.sync(() => {
			bakery.ovenLit = true;
		}),
	);
}

export function bakerIsCalledAway() {
	return kit.trait("kitchen", "the baker is called away", () => Effect.interrupt);
}

export function hasNoBowls() {
	return kit.trait("kitchen", "the bakery has no bowls", (bakery) =>
		Effect.sync(() => {
			bakery.bowls = 0;
		}),
	);
}

export function hasFlourDelivered(sacks: number) {
	return kit.trait("pantry", `the supplier has delivered ${sacks} sacks of flour`, (bakery) =>
		Effect.gen(function* () {
			const supplier = yield* Supplier;
			yield* supplier.deliver(sacks);
			bakery.flour = sacks;
		}),
	);
}

export function hasFlourFromTheMill() {
	return kit.trait("pantry", "the mill has sent flour", () => Effect.fail("the mill is closed"));
}

export function hasDough(count: number) {
	return kit.trait("pantry", `the baker has ${count} balls of dough`, (bakery) =>
		count > bakery.capacity
			? Effect.die(new Error(`the bowls hold only ${bakery.capacity}`))
			: Effect.sync(() => {
					bakery.dough = count;
				}),
	);
}

function bakeOneLoaf(bakery: Bakery, tell: (line: string) => void): Effect.Effect<void, OutOfFlour> {
	return Effect.suspend(() => {
		bakery.minute += 1;
		if (bakery.flour === 0) {
			return Effect.fail(new OutOfFlour({ minute: bakery.minute }));
		}
		bakery.flour -= 1;
		bakery.dough -= 1;
		bakery.loaves += 1;
		tell(`${bakery.minute}m a loaf comes out of the oven`);
		return Effect.void;
	});
}

export const newBakery = Effect.fnUntraced(function* (...given: readonly BakeryTrait[]) {
	const bakery = emptyBakery();
	const log = yield* kit.seed(bakery, given, {
		after: { kitchen: (target) => (target.bowls === 0 ? Effect.fail(new NoBowls()) : Effect.sync(() => fitBowls(target))) },
	});
	return {
		bakery,
		log,
		oven: {
			bakesEverything: (within = 60): Effect.Effect<BakeReport, OutOfFlour> =>
				settleEffect(log, {
					cap: within,
					diagnose: Effect.sync(() => stillWaiting(bakery)),
					failed: Effect.sync(() => ovenTrouble(bakery)),
					report: Effect.sync(() => ({ loaves: bakery.loaves, minutes: bakery.minute })),
					settled: Effect.sync(() => bakery.dough === 0),
					step: bakeOneLoaf(bakery, log.tell),
				}),
		},
	};
});

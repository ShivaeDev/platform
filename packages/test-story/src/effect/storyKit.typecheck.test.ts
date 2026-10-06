import { Context, Data, type Effect } from "effect";
import { expectTypeOf, it } from "vitest";
import { effectStoryKit } from "#effect/storyKit.ts";

class Library extends Context.Service<Library, { readonly lend: Effect.Effect<void, Overdue> }>()("@types/Library") {}

class Ledger extends Context.Service<Ledger, number>()("@types/Ledger") {}

class Clerk extends Context.Service<Clerk, string>()("@types/Clerk") {}

class Overdue extends Data.TaggedError("Overdue") {}

class Closed extends Data.TaggedError("Closed") {}

class Flooded extends Data.TaggedError("Flooded") {}

class Lost extends Data.TaggedError("Lost") {}

class Unlisted extends Data.TaggedError("Unlisted") {}

class Overflowing extends Data.TaggedError("Overflowing") {}

class Muddled extends Data.TaggedError("Muddled") {}

class Stuck extends Data.TaggedError("Stuck") {}

interface Shelf {
	books: number;
}

const shelf = effectStoryKit({
	after: {
		*built() {
			yield* new Closed();
		},
		*stocked() {
			yield* new Flooded();
		},
	},
	*create() {
		const books = yield* Ledger;
		if (books < 0) {
			return yield* new Unlisted();
		}
		const shelfOf: Shelf = { books };
		return shelfOf;
	},
	name: "shelf",
	run: {
		*diagnose() {
			yield* new Muddled();
			return "the clerk lost count";
		},
		*failed(state) {
			if (state.books > 9) {
				return yield* new Overflowing();
			}
			return undefined;
		},
		maxSteps: 1,
		*step() {
			yield* new Lost();
		},
	},
	stages: ["built", "stocked"],
	verbs: (_state, story) => ({
		clerk: {
			waits: () =>
				story.runUntil(function* (state) {
					yield* Clerk;
					if (state.books < 0) {
						return yield* new Stuck();
					}
					return state.books > 0;
				}),
		},
	}),
});

it("keeps the failures and services of create and every after hook", () => {
	const started = shelf.start();

	expectTypeOf<Effect.Error<typeof started>>().toEqualTypeOf<Closed | Flooded | Unlisted>();
	expectTypeOf<Effect.Services<typeof started>>().toEqualTypeOf<Ledger>();
});

it("needs the services of the traits a story starts with, and never their failures", () => {
	const lent = shelf.trait("stocked", "a book is lent out", function* () {
		const library = yield* Library;
		yield* library.lend;
	});
	const counted = shelf.trait("built", "the ledger is counted", function* (state) {
		state.books = yield* Ledger;
	});

	const started = shelf.start(lent, shelf.traits(counted));

	expectTypeOf<Effect.Error<typeof started>>().toEqualTypeOf<Closed | Flooded | Unlisted>();
	expectTypeOf<Effect.Services<typeof started>>().toEqualTypeOf<Ledger | Library>();
});

it("runs until a condition with the failures and services of every run hook and the condition", () => {
	type Waits = ReturnType<Effect.Success<ReturnType<typeof shelf.start>>["clerk"]["waits"]>;

	expectTypeOf<Effect.Error<Waits>>().toEqualTypeOf<Lost | Muddled | Overflowing | Stuck>();
	expectTypeOf<Effect.Services<Waits>>().toEqualTypeOf<Clerk>();
});

it("takes only the stages the kit declares", () => {
	// @ts-expect-error A trait names one of the kit's stages.
	shelf.trait("sold", "the shelf is sold", () => undefined);
	effectStoryKit({
		// @ts-expect-error An after hook names one of the kit's stages.
		after: { sold: () => undefined },
		create: (): Shelf => ({ books: 0 }),
		name: "shelf",
		stages: ["built"],
		verbs: () => ({}),
	});
});

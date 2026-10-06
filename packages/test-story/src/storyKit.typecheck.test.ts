import { Context, Data, type Effect, Layer } from "effect";
import { expectTypeOf, it } from "vitest";
import { type Story, type StoryKit, type StoryTest, storyKit, type Trait } from "#storyKit.ts";

class Library extends Context.Service<Library, { readonly lend: Effect.Effect<void, Overdue> }>()("@types/Library") {}

class Ledger extends Context.Service<Ledger, number>()("@types/Ledger") {}

class Clerk extends Context.Service<Clerk, string>()("@types/Clerk") {}

class Overdue extends Data.TaggedError("Overdue") {}

class Lost extends Data.TaggedError("Lost") {}

class Overflowing extends Data.TaggedError("Overflowing") {}

class Muddled extends Data.TaggedError("Muddled") {}

class Stuck extends Data.TaggedError("Stuck") {}

interface Shelf {
	books: number;
}

const shelf = storyKit({
	*create() {
		const shelfOf: Shelf = { books: yield* Ledger };
		return shelfOf;
	},
	layer: Layer.mergeAll(Layer.succeed(Ledger, 0), Layer.succeed(Clerk, "Ada")),
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
	verbs: (state, story) => ({
		clerk: {
			counts: () => state.books,
			waits: () =>
				story.runUntil(function* (current) {
					yield* Clerk;
					if (current.books < 0) {
						return yield* new Stuck();
					}
					return current.books > 0;
				}),
		},
	}),
});

type Waits = Effect.Effect<void, Lost | Muddled | Overflowing | Stuck, Clerk>;

type Run = Effect.Effect<never, Lost, never> | Effect.Effect<never, Muddled, never> | Effect.Effect<never, Overflowing, never>;

it("infers the engine, the stages, the verbs and what the layer provides from the definition", () => {
	expectTypeOf(shelf).toEqualTypeOf<
		StoryKit<Shelf, "built" | "stocked", { clerk: { counts: () => number; waits: () => Waits } }, Run, Clerk | Ledger>
	>();
});

it("hands the test body the verbs and the story", () => {
	shelf.it("counts the books", [], function* ({ clerk, story }) {
		expectTypeOf(clerk.counts()).toEqualTypeOf<number>();
		expectTypeOf(story).toEqualTypeOf<Story<Shelf, Run>>();
		expectTypeOf(clerk.waits()).toEqualTypeOf<Waits>();
		yield* clerk.waits();
	});
});

it("offers Vitest's test modifiers with the same story signature", () => {
	type Test = StoryTest<Shelf, "built" | "stocked", { clerk: { counts: () => number; waits: () => Waits } }, Run, Clerk | Ledger>;

	expectTypeOf(shelf.it.fails).toEqualTypeOf<Test>();
	expectTypeOf(shelf.it.only).toEqualTypeOf<Test>();
	expectTypeOf(shelf.it.skip).toEqualTypeOf<Test>();
	expectTypeOf(shelf.it.runIf(true)).toEqualTypeOf<Test>();
	expectTypeOf(shelf.it.skipIf(true)).toEqualTypeOf<Test>();
});

it("takes traits and body effects whose services the layer provides", () => {
	const counted = shelf.trait("built", "the ledger is counted", function* (state) {
		state.books = yield* Ledger;
	});
	expectTypeOf(counted).toEqualTypeOf<Trait<Shelf, "built" | "stocked", Ledger>>();

	shelf.it("counts the ledger", [shelf.traits(counted)], function* () {
		yield* Ledger;
	});
});

it("refuses traits and body effects that need a service the layer does not provide", () => {
	const lent = shelf.trait("stocked", "a book is lent out", function* () {
		const library = yield* Library;
		yield* library.lend;
	});

	// @ts-expect-error The kit's layer does not provide the Library a trait needs.
	shelf.it("lends a book", [lent]);
	// @ts-expect-error The kit's layer does not provide the Library the body needs.
	shelf.it("lends a book", [], function* () {
		yield* Library;
	});
});

it("refuses a hook that needs a service the layer does not provide", () => {
	// @ts-expect-error The kit has no layer to provide the Ledger that create needs.
	storyKit({
		*create() {
			const shelfOf: Shelf = { books: yield* Ledger };
			return shelfOf;
		},
		name: "shelf",
		stages: ["built"],
		verbs: () => ({}),
	});
});

it("needs no layer for hooks that are plain functions", () => {
	const plain = storyKit({
		after: { built: () => undefined },
		create: (): Shelf => ({ books: 0 }),
		name: "shelf",
		stages: ["built"],
		verbs: () => ({}),
	});

	expectTypeOf(plain).toEqualTypeOf<StoryKit<Shelf, "built", {}, never, never>>();
});

it("takes only the stages the kit declares", () => {
	// @ts-expect-error A trait names one of the kit's stages.
	shelf.trait("sold", "the shelf is sold", () => undefined);
	storyKit({
		// @ts-expect-error An after hook names one of the kit's stages.
		after: { sold: () => undefined },
		create: (): Shelf => ({ books: 0 }),
		name: "shelf",
		stages: ["built"],
		verbs: () => ({}),
	});
});

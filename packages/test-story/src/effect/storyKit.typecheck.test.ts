import { Context, Data, Effect } from "effect";
import { expectTypeOf, it } from "vitest";
import { effectStoryKit } from "#effect/storyKit.ts";
import type { StoryLog } from "#storyLog.ts";

class Library extends Context.Service<Library, { readonly lend: Effect.Effect<void, Overdue> }>()("@types/Library") {}

class Overdue extends Data.TaggedError("Overdue") {}

class Closed extends Data.TaggedError("Closed") {}

class Flooded extends Data.TaggedError("Flooded") {}

interface Shelf {
	books: number;
}

const kit = effectStoryKit<Shelf, Library>()("built", "stocked");

it("keeps a refused trait's failure out of the error channel", () => {
	const lent = kit.trait("stocked", "a book is lent out", () => Effect.flatMap(Library, (library) => library.lend));

	expectTypeOf(kit.seed({ books: 0 }, [lent])).toEqualTypeOf<Effect.Effect<StoryLog, never, Library>>();
});

it("keeps each after hook's failure in the error channel", () => {
	const seeded = kit.seed({ books: 0 }, [], { after: { built: () => Effect.fail(new Closed()), stocked: () => Effect.fail(new Flooded()) } });

	expectTypeOf(seeded).toEqualTypeOf<Effect.Effect<StoryLog, Closed | Flooded, Library>>();
});

it("adds nothing to the error channel without after hooks", () => {
	expectTypeOf(kit.seed({ books: 0 }, [])).toEqualTypeOf<Effect.Effect<StoryLog, never, Library>>();
});

it("takes only the stages the kit declares", () => {
	// @ts-expect-error A trait names one of the kit's stages.
	kit.trait("sold", "the shelf is sold", () => Effect.void);
	// @ts-expect-error An after hook names one of the kit's stages.
	kit.seed({ books: 0 }, [], { after: { sold: () => Effect.void } });
});

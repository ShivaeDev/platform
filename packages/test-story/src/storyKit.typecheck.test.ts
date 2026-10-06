import { expectTypeOf, it } from "vitest";
import { type Story, type StoryKit, storyKit, type Trait } from "#storyKit.ts";

interface Shelf {
	books: number;
}

const shelf = storyKit({
	create: (): Shelf => ({ books: 0 }),
	name: "shelf",
	stages: ["built", "stocked"],
	verbs: (state, story) => ({ clerk: { counts: () => state.books, shelve: () => story.tell("a book is shelved") } }),
});

it("infers the engine, the stages and the verbs from the definition", () => {
	expectTypeOf(shelf).toEqualTypeOf<StoryKit<Shelf, "built" | "stocked", { clerk: { counts: () => number; shelve: () => void } }>>();
	expectTypeOf(shelf.start().story).toEqualTypeOf<Story<Shelf>>();
	expectTypeOf(shelf.trait("built", "the shelf is built", () => undefined)).toEqualTypeOf<Trait<Shelf, "built" | "stocked">>();
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

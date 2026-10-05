import { expectTypeOf, it } from "vitest";
import { type StoryKit, storyKit } from "#storyKit.ts";

interface Shelf {
	books: number;
}

const kit = storyKit<Shelf>()("built", "stocked");

it("names its stages from the arguments", () => {
	expectTypeOf(kit).toEqualTypeOf<StoryKit<Shelf, "built" | "stocked">>();
});

it("takes only the stages the kit declares", () => {
	// @ts-expect-error A trait names one of the kit's stages.
	kit.trait("sold", "the shelf is sold", () => undefined);
	// @ts-expect-error An after hook names one of the kit's stages.
	kit.seed({ books: 0 }, [], { after: { sold: () => undefined } });
});

import { expectTypeOf } from "vitest";
import { storyKit } from "#storyKit.ts";
import { bakery } from "#test/bakery.ts";
import { market, village } from "#test/market.ts";
import { OrderLabel } from "#test/orders.ts";
import { StockLabel } from "#test/stock.ts";

market.it("infers both features and their provided services", [], function* ({ stock, orders, story }) {
	expectTypeOf(yield* stock.read()).toEqualTypeOf<string>();
	expectTypeOf(yield* orders.read()).toEqualTypeOf<string>();
	expectTypeOf(story.engine.stock.service.url).toEqualTypeOf<string>();
	expectTypeOf(story.engine.orders.service.url).toEqualTypeOf<string>();
	yield* StockLabel;
	yield* OrderLabel;
});

const duplicateVerb = storyKit({ create: () => ({}), name: "duplicate verb", stages: [], verbs: () => ({ oven: () => undefined }) });
const duplicateTraitStage = storyKit({ create: () => ({}), name: "duplicate trait stage", stages: ["pantry"], verbs: () => ({}) });
const duplicateEngine = storyKit({ create: () => ({ sacks: 0 }), name: "duplicate engine", stages: [], verbs: () => ({}) });

// @ts-expect-error Cannot compose story kits: duplicate verb names: oven.
storyKit({ extends: [bakery, duplicateVerb], name: "clashing verbs" });
// @ts-expect-error Cannot compose story kits: duplicate trait stage names: pantry.
storyKit({ extends: [bakery, duplicateTraitStage], name: "clashing traits" });
// @ts-expect-error Nested composition also rejects duplicate verb names: oven.
storyKit({ extends: [village, duplicateVerb], name: "nested clashing verbs" });
// @ts-expect-error Cannot compose story kits: duplicate engine fields: sacks.
storyKit({ extends: [village, duplicateEngine], name: "clashing engines" });

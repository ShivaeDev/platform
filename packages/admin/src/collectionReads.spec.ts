import { expect } from "vitest";
import { collectionStory, livePage, signedInAs } from "#test/collectionStory.ts";

collectionStory.it(
	"an admin's live collection page loads and refreshes after writes commit in different tenants",
	[signedInAs("admin", "admin"), livePage],
	function* ({ insert, shown, untilRefreshed }) {
		expect(yield* shown()).toEqual([]);

		yield* insert("tenant one", "One");
		yield* untilRefreshed();

		expect(yield* shown()).toEqual(["tenant one: One"]);

		yield* insert("tenant two", "Two");
		yield* untilRefreshed();

		expect(yield* shown()).toEqual(["tenant one: One", "tenant two: Two"]);
	},
);

for (const [caller, role, refusal] of [
	["member", "user", "forbidden"],
	["restricted", "admin", "read denied"],
] as const) {
	collectionStory.it(`${caller}'s live collection page is refused as ${refusal}`, [signedInAs(caller, role)], function* ({ load }) {
		expect(yield* load()).toBe(refusal);
	});
}

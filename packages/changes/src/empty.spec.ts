import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { changes } from "#test/kit.ts";

for (const place of ["outside any transaction", "in a batch", "in a transaction"] as const) {
	changes.it(
		`recording no changes ${place} tells neither the observer nor the sink`,
		[],
		function* ({ observing, inPlace, record, observed, published }) {
			yield* observing(inPlace(place, record()));

			yield* outcomes({
				"observed changes": [observed(), []],
				"published changes": [published(), []],
			});
		},
	);
}

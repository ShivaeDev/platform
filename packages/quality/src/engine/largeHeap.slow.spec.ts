import { largeHeapLint, largeRepository } from "#test/largeHeapLint.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

largeHeapLint.it(
	"quality lint passes a 4,415-file repository with 20,000 baseline entries within a 2 GB Node heap",
	[largeRepository()],
	function* ({ lintWithinHeap, outcome }) {
		yield* lintWithinHeap();

		yield* assertThat(yield* outcome(), (actual) => actual.toBe("passed"));
	},
	300_000,
);

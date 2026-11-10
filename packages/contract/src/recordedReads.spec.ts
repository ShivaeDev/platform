import { expect } from "vitest";
import { reconnecting, recordedReadsStory, watchingShelf } from "#test/recordedReadsStory.ts";

for (const { run, traits } of [
	{ run: "a first run", traits: [] },
	{ run: "the fresh subscription after a reconnect", traits: [reconnecting] },
]) {
	recordedReadsStory.it(
		`a commit to a key recorded before the second statement of ${run} is heard, so the shelf reruns after showing it`,
		traits,
		function* ({ edit, holdNextShelfRun, openShelf, release, untilHostHeard, untilShelfDeliveries, untilShelfPaused }) {
			yield* holdNextShelfRun();
			yield* openShelf();
			yield* untilShelfPaused();

			yield* edit(1, "Dune Messiah");
			yield* untilHostHeard("Dune Messiah");
			yield* release();

			expect(yield* untilShelfDeliveries(2)).toEqual(["Dune Messiah, Emma", "unchanged"]);
		},
	);
}

recordedReadsStory.it(
	"a move heard through the declared reader key reruns the shelf, and a commit to the shelf key that rerun records before its second statement is heard",
	[watchingShelf],
	function* ({ deliveries, edit, holdNextShelfRun, move, release, untilHostHeard, untilShelfDeliveries, untilShelfPaused }) {
		expect(yield* deliveries()).toEqual(["Dune, Emma"]);
		yield* holdNextShelfRun();

		yield* move(2);
		yield* untilShelfPaused();
		yield* edit(3, "Ulysses, annotated");
		yield* untilHostHeard("Ulysses, annotated");
		yield* release();

		expect(yield* untilShelfDeliveries(3)).toEqual(["Dune, Emma", "Ulysses, annotated", "unchanged"]);
	},
);

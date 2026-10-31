import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { Note, notes } from "#test/rerun/fixture.ts";
import { mixedSubscription, pageOpen, rerunStory } from "#test/rerun/story.ts";

rerunStory.it("a change excluded by alice's filter sends no result or hint about that change", [], function* ({ arrivals, rename, untilChanged }) {
	const initial = [{ _tag: "Result", query: "compare", queryIndex: 0, value: [new Note({ id: 1n, owner: "alice", title: "One" })] }];
	expect(yield* arrivals()).toEqual(initial);

	yield* rename(3n, "Still excluded");
	yield* untilChanged();

	expect(yield* arrivals()).toEqual(initial);
});

rerunStory.it(
	"a visible change pushes alice's typed result into her bound query without a client read",
	[pageOpen],
	function* ({ clientReads, rename, shown, untilShown }) {
		expect((yield* shown()).map((note) => note.title)).toEqual(["One"]);

		yield* rename(3n, "One more");
		yield* untilShown("One more");

		yield* outcomes({
			"alice's notes": [shown(), [new Note({ id: 1n, owner: "alice", title: "One" }), new Note({ id: 3n, owner: "alice", title: "One more" })]],
			"client reads": [clientReads(), []],
		});
	},
);

rerunStory.it("a denied rerun ends alice's subscription with read denied", [], function* ({ denyAlice, rename, subscriptionEnd }) {
	yield* denyAlice();

	yield* rename(3n, "One more");

	expect(yield* subscriptionEnd()).toBe("read denied");
});

rerunStory.it(
	"a policy outage ends alice's compared subscription with its declared failure",
	[],
	function* ({ failReadPolicy, rename, subscriptionEnd }) {
		yield* failReadPolicy();

		yield* rename(3n, "One more");

		expect(yield* subscriptionEnd()).toBe("policy unavailable");
	},
);

rerunStory.it("a Resync reruns the subscription without sending an unchanged result", [], function* ({ arrivals, resync, untilChanged }) {
	const before = yield* arrivals();

	yield* resync();
	yield* untilChanged();

	expect(yield* arrivals()).toEqual(before);
});

rerunStory.it("a query without the option refetches after a matching change", [], function* ({ clientReads, openHinted, rename, untilHinted }) {
	yield* openHinted();
	expect(yield* clientReads()).toEqual(["rerun.hinted"]);

	yield* rename(3n, "One more");
	yield* untilHinted("One more");

	expect(yield* clientReads()).toEqual(["rerun.hinted", "rerun.hinted"]);
});

rerunStory.it(
	"a denied pushed query exposes read denied instead of its retained result",
	[pageOpen],
	function* ({ denyAlice, rename, pageEnd, subscriptionEnd }) {
		yield* denyAlice();

		yield* rename(3n, "One more");
		yield* subscriptionEnd();

		expect(yield* pageEnd()).toBe("read denied");
	},
);

rerunStory.it(
	"a mixed subscription hints only the query that uses hint-and-refetch",
	[mixedSubscription],
	function* ({ mixedArrivals, rename, untilMixedHint }) {
		const initial = [
			{ _tag: "Result", query: "compare", queryIndex: 0, value: [new Note({ id: 1n, owner: "alice", title: "One" })] },
			{ _tag: "Resync" },
		];
		expect(yield* mixedArrivals()).toEqual(initial);

		yield* rename(3n, "Still excluded");
		yield* untilMixedHint();

		expect(yield* mixedArrivals()).toEqual([...initial, { _tag: "Changed", keys: [notes.bucket.owner("alice")], queryIndexes: [1] }]);
	},
);

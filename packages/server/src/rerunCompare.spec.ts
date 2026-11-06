import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { Note } from "#test/rerun/fixture.ts";
import { batchedSubscription, pageOpen, rerunStory } from "#test/rerun/story.ts";

rerunStory.it(
	"a change excluded by alice's filter acknowledges completion without a result or change hint",
	[],
	function* ({ arrivals, rename, untilChanged }) {
		const initial = [{ _tag: "Result", query: "compare", queryIndex: 0, value: [new Note({ id: 1n, owner: "alice", title: "One" })] }];
		expect(yield* arrivals()).toEqual(initial);

		yield* rename(3n, "Still excluded");
		yield* untilChanged();

		expect(yield* arrivals()).toEqual([...initial, { _tag: "Unchanged", queryIndex: 0 }]);
	},
);

rerunStory.it(
	"a rerun reads its handler's services and pushes alice's changed notes without a client read",
	[pageOpen],
	function* ({ clientReads, rename, shown, untilShown }) {
		expect((yield* shown()).map((note) => note.title)).toEqual(["One"]);

		yield* rename(3n, "One more");
		yield* untilShown("One more");

		yield* outcomes([
			["alice's notes", () => shown(), [new Note({ id: 1n, owner: "alice", title: "One" }), new Note({ id: 3n, owner: "alice", title: "One more" })]],
			["client reads", () => clientReads(), []],
		]);
	},
);

rerunStory.it("a denied rerun delivers read denied to alice's subscription", [], function* ({ denyAlice, rename, subscriptionDenial }) {
	yield* denyAlice();

	yield* rename(3n, "One more");

	expect(yield* subscriptionDenial()).toBe("read denied");
});

rerunStory.it(
	"a policy outage ends alice's compared subscription with its declared failure",
	[],
	function* ({ failReadPolicy, rename, subscriptionEnd }) {
		yield* failReadPolicy();

		yield* rename(3n, "One more");

		expect(yield* subscriptionEnd()).toBe("failed with policy unavailable");
	},
);

rerunStory.it("a Resync acknowledges its completed rerun without sending an unchanged result", [], function* ({ arrivals, resync, untilChanged }) {
	const before = yield* arrivals();

	yield* resync();
	yield* untilChanged();

	expect(yield* arrivals()).toEqual([...before, { _tag: "Unchanged", queryIndex: 0 }]);
});

rerunStory.it("a query pushes after a matching change", [], function* ({ clientReads, openSecondary, rename, untilSecondary }) {
	yield* openSecondary();
	expect(yield* clientReads()).toEqual([]);

	yield* rename(3n, "One more");
	yield* untilSecondary("One more");

	expect(yield* clientReads()).toEqual([]);
});

rerunStory.it(
	"a denied pushed query exposes read denied instead of its retained result",
	[pageOpen],
	function* ({ denyAlice, rename, pageEnd, subscriptionDenial }) {
		yield* denyAlice();

		yield* rename(3n, "One more");
		yield* subscriptionDenial();

		expect(yield* pageEnd()).toBe("read denied");
	},
);

rerunStory.it(
	"a batched subscription acknowledges both unchanged queries",
	[batchedSubscription],
	function* ({ batchArrivals, rename, batchCompleted }) {
		const initial = [
			{ _tag: "Result", query: "compare", queryIndex: 0, value: [new Note({ id: 1n, owner: "alice", title: "One" })] },
			{ _tag: "Result", query: "secondary", queryIndex: 1, value: [new Note({ id: 1n, owner: "alice", title: "One" })] },
		];
		expect(yield* batchArrivals()).toEqual(initial);

		yield* rename(3n, "Still excluded");
		yield* batchCompleted();

		expect(yield* batchArrivals()).toEqual([...initial, { _tag: "Unchanged", queryIndex: 0 }, { _tag: "Unchanged", queryIndex: 1 }]);
	},
);

rerunStory.it(
	"a query handler failure ends alice's rerun subscription with its declared error",
	[],
	function* ({ arrivals, failQuery, rename, subscriptionEnd }) {
		expect(yield* arrivals()).toEqual([
			{ _tag: "Result", query: "compare", queryIndex: 0, value: [new Note({ id: 1n, owner: "alice", title: "One" })] },
		]);
		yield* failQuery();

		yield* rename(3n, "One more");

		expect(yield* subscriptionEnd()).toBe("failed with query unavailable");
	},
);

import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { evolvingReadsStory, watchingTimeline, watchingTimelineAndRecords } from "#test/evolvingReadsStory.ts";

for (const delivery of ["timeline", "pushed"] as const) {
	evolvingReadsStory.it(
		`an open ${delivery} timeline refreshes on the next write to a list created after subscribing`,
		[watchingTimeline(delivery)],
		function* ({ create, edit, shown, untilShown }) {
			expect(yield* shown()).toEqual(["First", "Second"]);

			yield* create(4, "New list");

			yield* untilShown("New list");
			expect(yield* shown()).toEqual(["First", "Second", "New list"]);

			yield* edit(4, "Changed new list");

			yield* untilShown("Changed new list");
			expect(yield* shown()).toEqual(["First", "Second", "Changed new list"]);
		},
	);
}

evolvingReadsStory.it(
	"leaving a list releases its registrations and its next write sends no timeline refresh over the open socket",
	[],
	function* ({ delivered, edit, leave, registered, untilBarrier, untilTimeline }) {
		expect(yield* registered(1)).toBe(true);

		yield* leave(1);

		yield* untilTimeline(["Second"]);
		expect(yield* registered(1)).toBe(false);
		const before = yield* delivered();

		yield* edit(1, "Changed departed list");

		yield* untilBarrier("Changed departed list");
		yield* outcomes([
			["departed list registration", () => registered(1), false],
			["remaining list registration", () => registered(2), true],
			["timeline deliveries", () => delivered(), before],
		]);
	},
);

evolvingReadsStory.it(
	"an unavailable list relation ends the open socket subscription with its declared rejection",
	[],
	function* ({ edit, failDiscovery, subscriptionEnd }) {
		yield* failDiscovery();

		yield* edit(1, "Changed");

		expect(yield* subscriptionEnd()).toBe("failed with unavailable");
	},
);

evolvingReadsStory.it(
	"a failed timeline rerun reaches the timeline as its declared rejection while the record list on the same client keeps updating",
	[watchingTimelineAndRecords],
	function* ({ edit, listsUnavailable, recordsShow, refreshed, timelineShows, untilRecordsShow }) {
		expect(yield* timelineShows()).toBe("First, Second");
		yield* listsUnavailable();

		yield* edit(1, "Changed");

		yield* untilRecordsShow("Changed");
		yield* refreshed();
		yield* outcomes([
			["timeline", () => timelineShows(), "failed with unavailable"],
			["record list", () => recordsShow(), "Changed, Second, Private"],
		]);
	},
);

evolvingReadsStory.it(
	"an explicit refresh replaces a failed timeline rerun with current data once the lists are readable again",
	[watchingTimelineAndRecords],
	function* ({ edit, listsReturn, listsUnavailable, refresh, refreshed, timelineShows }) {
		yield* listsUnavailable();
		yield* edit(1, "Changed");
		yield* refreshed();
		expect(yield* timelineShows()).toBe("failed with unavailable");
		yield* listsReturn();

		refresh();

		yield* refreshed();
		expect(yield* timelineShows()).toBe("Changed, Second");
	},
);

evolvingReadsStory.it(
	"a pushed timeline registers a newly joined empty list even when its result is unchanged",
	[watchingTimeline("pushed")],
	function* ({ addRecord, joinEmptyList, refreshed, shown, untilShown }) {
		expect(yield* shown()).toEqual(["First", "Second"]);

		yield* joinEmptyList(4);

		yield* refreshed();
		expect(yield* shown()).toEqual(["First", "Second"]);

		yield* addRecord(4, 4, "First in joined list");

		yield* untilShown("First in joined list");
		expect(yield* shown()).toEqual(["First", "Second", "First in joined list"]);
	},
);

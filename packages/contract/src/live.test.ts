import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	coalescingWindow,
	connected,
	denied,
	firstHintNamesOnlyNoteOne,
	liveNotesStory,
	noteOneEditedWhilePaused,
	paused,
	watching,
	withoutResumeSignal,
} from "#test/liveNotesStory.ts";

liveNotesStory.it(
	"when each new live stream starts with a hint naming only note 1, connecting still re-reads note 2 from the client's read scope",
	[firstHintNamesOnlyNoteOne(), watching("note 2")],
	function* ({ connect, timesRead }) {
		expect(yield* timesRead("note 2")).toBe("read once");

		yield* connect();

		expect(yield* timesRead("note 2")).toBe("read twice");
	},
);

liveNotesStory.it(
	"when each new live stream starts with a hint naming only note 1, reconnecting after the stream drops re-reads note 2 again",
	[firstHintNamesOnlyNoteOne(), watching("note 2"), connected()],
	function* ({ streamDropsAndReconnects, timesRead }) {
		expect(yield* timesRead("note 2")).toBe("read twice");

		yield* streamDropsAndReconnects();

		expect(yield* timesRead("note 2")).toBe("read 3 times");
	},
);

liveNotesStory.it("connecting re-reads the loaded note 1 exactly once", [watching("note 1")], function* ({ connect, timesRead }) {
	expect(yield* timesRead("note 1")).toBe("read once");

	yield* connect();

	expect(yield* timesRead("note 1")).toBe("read twice");
});

liveNotesStory.it(
	"resuming while paused re-reads nothing and keeps note 1's edit pending",
	[watching("note 1"), connected(), paused(), noteOneEditedWhilePaused()],
	function* ({ resume, shown, status, timesRead }) {
		expect(yield* status()).toEqual({ connection: "live", failure: "none", needsResync: true, pending: 1 });

		resume();

		yield* outcomes({
			"note 1": [shown("note 1"), "First"],
			"note 1's reads": [timesRead("note 1"), "read twice"],
			status: [status(), { connection: "live", failure: "none", needsResync: true, pending: 1 }],
		});
	},
);

liveNotesStory.it(
	"unpausing re-reads note 1's edit made while paused and clears the pending count",
	[watching("note 1"), connected(), paused(), noteOneEditedWhilePaused()],
	function* ({ shown, status, unpause }) {
		yield* outcomes({
			"note 1": [shown("note 1"), "First"],
			status: [status(), { connection: "live", failure: "none", needsResync: true, pending: 1 }],
		});

		unpause();

		yield* outcomes({
			"note 1": [shown("note 1"), "Changed while paused"],
			status: [status(), { connection: "live", failure: "none", needsResync: false, pending: 0 }],
		});
	},
);

liveNotesStory.it(
	"without a resume signal, the live connection still refreshes note 1 when its edit is announced",
	[withoutResumeSignal(), coalescingWindow(0), watching("note 1"), connected()],
	function* ({ edit, shown }) {
		expect(yield* shown("note 1")).toBe("First");

		yield* edit(1, "Changed");

		expect(yield* shown("note 1")).toBe("Changed");
	},
);

liveNotesStory.it(
	"a denied session's live subscription fails with denied before the server opens a stream",
	[denied()],
	function* ({ serverStreamsOpened, subscribe, subscriptionEnding }) {
		yield* subscribe();

		yield* outcomes({
			"server streams opened": [serverStreamsOpened(), "no streams opened"],
			subscription: [subscriptionEnding(), "failed with denied"],
		});
	},
);

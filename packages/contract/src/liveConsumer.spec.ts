import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { coalescingWindow, connected, liveNotesStory, paused, streamDroppedAndRefused, watching } from "#test/liveNotesStory.ts";

liveNotesStory.it(
	"an announced edit to note 1 refreshes note 1 and the list and leaves note 2 unread",
	[coalescingWindow(0), watching("note 1", "note 2", "the list"), connected()],
	function* ({ edit, shown, timesRead }) {
		expect(yield* shown("note 1")).toBe("First");

		yield* edit(1, "Changed");

		yield* outcomes({
			"note 1": [shown("note 1"), "Changed"],
			"note 2's reads": [timesRead("note 2"), "read twice"],
			"the list": [shown("the list"), ["Changed", "Second"]],
		});
	},
);

liveNotesStory.it(
	"while paused, 257 hints leave note 1 unread and count as at most 256 pending",
	[watching("note 1"), connected(), paused()],
	function* ({ serverSendsResyncs, status, timesRead }) {
		yield* serverSendsResyncs(257);

		yield* outcomes({
			"note 1's reads": [timesRead("note 1"), "read twice"],
			status: [status(), { connection: "live", failure: "none", needsResync: true, pending: 256 }],
		});
	},
);

liveNotesStory.it(
	"resuming re-reads note 1's unannounced change",
	[watching("note 1"), connected()],
	function* ({ changeUnannounced, resume, shown }) {
		yield* changeUnannounced(1, "Quietly changed");
		expect(yield* shown("note 1")).toBe("First");

		resume();

		expect(yield* shown("note 1")).toBe("Quietly changed");
	},
);

liveNotesStory.it(
	"when the stream drops and the server refuses the reconnection as unavailable, the status reports the failure and needs a resync",
	[watching("note 1"), connected()],
	function* ({ status, streamDropsWhileRefused }) {
		expect(yield* status()).toEqual({ connection: "live", failure: "none", needsResync: false, pending: 0 });

		yield* streamDropsWhileRefused();

		expect(yield* status()).toEqual({ connection: "reconnecting", failure: "failed with unavailable", needsResync: true, pending: 0 });
	},
);

liveNotesStory.it(
	"when the server accepts streams again, the client re-reads note 1's change missed while refused, clears the failure and holds one server stream",
	[watching("note 1"), connected(), streamDroppedAndRefused()],
	function* ({ changeUnannounced, openServerStreams, serverAcceptsStreamsAgain, shown, status }) {
		yield* changeUnannounced(1, "Missed while refused");
		expect(yield* shown("note 1")).toBe("First");

		yield* serverAcceptsStreamsAgain();

		yield* outcomes({
			"note 1": [shown("note 1"), "Missed while refused"],
			"open server streams": [openServerStreams(), "one stream open"],
			status: [status(), { connection: "live", failure: "none", needsResync: false, pending: 0 }],
		});
	},
);

liveNotesStory.it(
	"disposing the client's registry closes its server stream",
	[watching("note 1"), connected()],
	function* ({ dispose, openServerStreams }) {
		expect(yield* openServerStreams()).toBe("one stream open");

		yield* dispose();

		expect(yield* openServerStreams()).toBe("no streams open");
	},
);

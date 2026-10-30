import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { coalescingWindow, connected, heldNextReReadOfNoteOne, heldReReadOfNoteOne, postgresLive, watching } from "#test/postgresLive.ts";

postgresLive.it(
	"twenty committed edits inside a 1 second window re-read note 1 and the list once, with the newest body",
	[coalescingWindow("1 second"), watching("note 1", "note 2", "the list"), connected()],
	function* ({ editRepeatedly, shown, timesRead, windowCloses }) {
		yield* editRepeatedly(1, "Edit", 20);

		yield* windowCloses("note 1", "the list");

		yield* outcomes({
			"note 1": [shown("note 1"), "Edit 20"],
			"note 1's reads": [timesRead("note 1"), "read 3 times"],
			"note 2's reads": [timesRead("note 2"), "read twice"],
			"the list": [shown("the list"), ["Edit 20", "Second"]],
			"the list's reads": [timesRead("the list"), "read 3 times"],
		});
	},
);

postgresLive.it(
	"committed edits during a held re-read of note 1 wait for it, then re-read note 1 once with the newest body",
	[watching("note 1", "the list"), connected(), heldReReadOfNoteOne()],
	function* ({ editRepeatedly, readsBegun, releaseHeldReads, shown, timesRead, windowCloses }) {
		yield* editRepeatedly(1, "Newest", 10);
		yield* windowCloses("the list");
		yield* outcomes({
			"note 1's reads while held": [readsBegun("note 1"), "read 3 times"],
			"the list, which the server does not hold": [shown("the list"), ["Newest 10", "Second"]],
		});

		yield* releaseHeldReads();

		yield* outcomes({
			"note 1": [shown("note 1"), "Newest 10"],
			"note 1's reads": [timesRead("note 1"), "read 4 times"],
		});
	},
);

postgresLive.it(
	"with a zero window, a committed edit during a held re-read of note 1 starts a fresh read at once and shows the newest body",
	[coalescingWindow(0), watching("note 1"), connected(), heldNextReReadOfNoteOne()],
	function* ({ edit, shown, timesRead }) {
		yield* edit(1, "Newest");

		yield* outcomes({
			"note 1": [shown("note 1"), "Newest"],
			"note 1's reads": [timesRead("note 1"), "read 4 times"],
		});
	},
);

postgresLive.it(
	"reconnecting inside a 1 second window re-reads note 1's committed edit and note 2 without waiting for the window",
	[coalescingWindow("1 second"), watching("note 1", "note 2"), connected()],
	function* ({ edit, shown, streamDropsAndReconnects, timesRead }) {
		yield* edit(1, "Before reconnect");

		yield* streamDropsAndReconnects();

		yield* outcomes({
			"note 1": [shown("note 1"), "Before reconnect"],
			"note 2's reads": [timesRead("note 2"), "read 3 times"],
		});
	},
);

postgresLive.it(
	"pausing before a held re-read of note 1 finishes drops the re-read queued behind it",
	[watching("note 1", "the list"), connected(), heldReReadOfNoteOne()],
	function* ({ edit, pause, releaseHeldReads, shown, timesRead, windowCloses }) {
		yield* edit(1, "Queued");
		yield* windowCloses("the list");
		pause();

		yield* releaseHeldReads();

		yield* outcomes({
			"note 1": [shown("note 1"), "In flight"],
			"note 1's reads": [timesRead("note 1"), "read 3 times"],
		});
	},
);

postgresLive.it(
	"note 1 queried with a serialization key keeps its refreshed body through a dehydrate and hydrate",
	[coalescingWindow(0), watching("the saved note 1"), connected()],
	function* ({ edit, reload, shown, shownWithoutReading }) {
		yield* edit(1, "Saved for reload");
		yield* outcomes({ "the saved note 1": [shown("the saved note 1"), "Saved for reload"] });

		reload();

		yield* outcomes({ "the saved note 1": [shownWithoutReading("the saved note 1"), "Saved for reload"] });
	},
);

postgresLive.it(
	"note 1 queried with a 1 second lifetime stays cached after its release, so mounting it again within that second reads nothing",
	[watching("the short-lived note 1")],
	function* ({ changeUnannounced, mount, shown, timesRead, unmount }) {
		unmount("the short-lived note 1");
		yield* changeUnannounced(1, "Committed after release");

		mount("the short-lived note 1");

		yield* outcomes({
			"the short-lived note 1": [shown("the short-lived note 1"), "First"],
			"the short-lived note 1's reads": [timesRead("the short-lived note 1"), "read once"],
		});
	},
);

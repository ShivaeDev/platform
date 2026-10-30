import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { pausedWithChangeHeld, sessionStory, watching } from "#test/sessionStory.ts";

sessionStory.it(
	"pausing live reads through another binding of alice's client holds her announced change pending and unread",
	[watching("alice", "preferences")],
	function* ({ announce, changeQuietly, pauseThroughOtherBinding, shown, status, timesRead, untilPending }) {
		changeQuietly("alice", "Written while paused");
		pauseThroughOtherBinding("alice");

		yield* announce("alice");
		yield* untilPending("alice");

		yield* outcomes({
			"alice's preferences": [shown("alice", "preferences"), "Alice"],
			"alice's reads": [timesRead("alice", "preferences"), "read once"],
			"alice's status": [status("alice"), { needsResync: true, pending: 1 }],
		});
	},
);

sessionStory.it(
	"unpausing through the other binding re-reads alice's change held while paused",
	[watching("alice", "preferences"), pausedWithChangeHeld()],
	function* ({ shown, unpauseThroughOtherBinding, untilReRead }) {
		expect(yield* shown("alice", "preferences")).toBe("Alice");

		unpauseThroughOtherBinding("alice");
		yield* untilReRead("alice", "preferences");

		expect(yield* shown("alice", "preferences")).toBe("Written while paused");
	},
);

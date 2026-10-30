import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { keptSave, sessionStory, watching } from "#test/sessionStory.ts";

for (const runtime of ["alice", "bob"] as const) {
	sessionStory.it(
		`alice's save run through ${runtime}'s runtime refreshes her preferences and list and leaves her preference 1 and bob's preferences unread`,
		[watching("alice", "preferences", "list", "preference 1"), watching("bob", "preferences")],
		function* ({ save, shown, timesRead, untilReRead }) {
			expect(yield* shown("alice", "preferences")).toBe("Alice");

			yield* save("alice", "Changed", runtime);
			yield* untilReRead("alice", "preferences");
			yield* untilReRead("alice", "list");

			yield* outcomes({
				"alice's list": [shown("alice", "list"), ["Changed"]],
				"alice's preference 1": [timesRead("alice", "preference 1"), "read once"],
				"alice's preferences": [shown("alice", "preferences"), "Changed"],
				"bob's preferences": [timesRead("bob", "preferences"), "read once"],
			});
		},
	);
}

sessionStory.it(
	"alice's blank save is rejected and re-reads neither her preferences nor her list",
	[watching("alice", "preferences", "list")],
	function* ({ save, timesRead }) {
		expect(yield* save("alice", "")).toBe("failed with rejected");

		yield* outcomes({
			"alice's list": [timesRead("alice", "list"), "read once"],
			"alice's preferences": [timesRead("alice", "preferences"), "read once"],
		});
	},
);

sessionStory.it(
	"an announced change to alice's preferences re-reads hers and leaves bob's unread",
	[watching("alice", "preferences"), watching("bob", "preferences")],
	function* ({ announce, changeQuietly, shown, timesRead, untilReRead }) {
		changeQuietly("alice", "Hinted");
		expect(yield* shown("alice", "preferences")).toBe("Alice");

		yield* announce("alice");
		yield* untilReRead("alice", "preferences");

		yield* outcomes({
			"alice's preferences": [shown("alice", "preferences"), "Hinted"],
			"bob's preferences": [timesRead("bob", "preferences"), "read once"],
		});
	},
);

sessionStory.it(
	"a server resync re-reads alice's and bob's preferences",
	[watching("alice", "preferences"), watching("bob", "preferences")],
	function* ({ changeQuietly, resync, shown, untilReRead }) {
		changeQuietly("alice", "Reconciled");
		changeQuietly("bob", "Reconciled too");

		yield* resync();
		yield* untilReRead("alice", "preferences");
		yield* untilReRead("bob", "preferences");

		yield* outcomes({
			"alice's preferences": [shown("alice", "preferences"), "Reconciled"],
			"bob's preferences": [shown("bob", "preferences"), "Reconciled too"],
		});
	},
);

sessionStory.it(
	"unmounting alice's preferences closes their live subscription and keeps the one for her preference 1",
	[watching("alice", "preferences", "preference 1")],
	function* ({ subscriptions, unmount }) {
		expect(yield* subscriptions("alice")).toEqual(["preferences", "preference 1"]);

		yield* unmount("alice", "preferences");

		expect(yield* subscriptions("alice")).toEqual(["preference 1"]);
	},
);

sessionStory.it(
	"disposing alice's registry closes her live subscriptions",
	[watching("alice", "preferences")],
	function* ({ dispose, subscriptions }) {
		expect(yield* subscriptions("alice")).toEqual(["preferences"]);

		yield* dispose("alice");

		expect(yield* subscriptions("alice")).toEqual([]);
	},
);

sessionStory.it("binding a session contract without an owning registry throws", [], ({ bindWithoutOwner }) => {
	expect(bindWithoutOwner()).toBe("A session-scoped contract requires its owning registry");
});

sessionStory.it(
	"running alice's kept save effect again writes her title again",
	[watching("alice", "preferences"), keptSave("Saved")],
	function* ({ changeQuietly, runKeptSaveAgain, stored, timesRead }) {
		changeQuietly("alice", "Changed elsewhere");

		yield* runKeptSaveAgain();

		yield* outcomes({
			"alice's preferences": [timesRead("alice", "preferences"), "read 3 times"],
			"alice's stored title": [stored("alice"), "Saved"],
		});
	},
);

for (const [use, act] of [
	["reading alice's preferences", "readInBobsRegistry"],
	["mounting alice's live connection", "connectInBobsRegistry"],
] as const) {
	sessionStory.it(`${use} in bob's registry throws because it belongs to alice's`, [], (verbs) => {
		expect(verbs[act]()).toBe("A session-scoped query belongs to its binding registry");
	});
}

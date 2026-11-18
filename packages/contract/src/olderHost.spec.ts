import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { olderHostStory, overCustomProtocol, overTheSharedSocket } from "#test/olderHostStory.ts";

olderHostStory.it(
	"a command is reflected as soon as it is accepted when the host's streams never confirm sync tokens",
	[overTheSharedSocket()],
	function* ({ add, hostAnswers, openView, signals, syncIdsOnCommands }) {
		yield* openView();
		yield* hostAnswers();

		expect(yield* add(2)).toBe("reflected");

		yield* outcomes([
			["signals", () => signals(), ["sent", "accepted", "reflected"]],
			["sync ids on commands", () => syncIdsOnCommands(), []],
		]);
	},
);

olderHostStory.it(
	"a command accepted before the host's first frame stops waiting when that frame shows the host confirms nothing",
	[overTheSharedSocket()],
	function* ({ beginAdd, finished, hostAnswers, openView, shown, signals, untilAccepted }) {
		yield* openView();
		yield* beginAdd(2);
		yield* untilAccepted();

		expect(yield* signals()).toEqual(["sent", "accepted"]);

		yield* hostAnswers();

		yield* outcomes([
			["command", () => finished(), "reflected"],
			["shown", () => shown(), "counter: 2"],
		]);
	},
);

olderHostStory.it(
	"over a custom protocol a command stops waiting when the host that took its sync request cannot answer it",
	[overCustomProtocol()],
	function* ({ add, hostAnswers, hostStartsSyncing, openView, signals, syncIdsOnCommands }) {
		yield* openView();
		yield* hostStartsSyncing();
		yield* hostAnswers();

		expect(yield* add(2)).toBe("reflected");

		yield* outcomes([
			["signals", () => signals(), ["sent", "accepted", "reflected"]],
			["sync ids on commands", () => syncIdsOnCommands(), []],
		]);
	},
);

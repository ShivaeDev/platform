import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { alongside, reflectionStory, watching } from "#test/reflectionStory.ts";

reflectionStory.it(
	"a command is reflected only once its change is on the screen",
	[watching()],
	function* ({ activity, beginWrite, finished, holdReads, releaseReads, shown, signals, untilAccepted, untilReadBegins }) {
		yield* holdReads();
		yield* beginWrite("Second");
		yield* untilAccepted();
		yield* untilReadBegins();

		yield* outcomes([
			["signals", () => signals(), ["sent", "accepted"]],
			["shown", () => shown(), "First"],
			["activity", () => activity(), "1 not yet reflected"],
		]);

		yield* releaseReads();

		yield* outcomes([
			["command", () => finished(), "reflected"],
			["signals", () => signals(), ["sent", "accepted", "reflected"]],
			["shown", () => shown(), "Second"],
			["activity", () => activity(), "settled"],
		]);
	},
);

reflectionStory.it("a command that changes nothing is reflected without waiting for an update", [watching()], function* ({ signals, touch }) {
	yield* outcomes([
		["command", () => touch(), "reflected"],
		["signals", () => signals(), ["sent", "accepted", "reflected"]],
	]);
});

reflectionStory.it("a refused command leaves nothing to wait for", [watching()], function* ({ activity, refuseWrites, shown, signals, write }) {
	refuseWrites();

	expect(yield* write("Second")).toBe("failed with conflict: The board refuses writes");

	yield* outcomes([
		["signals", () => signals(), ["sent"]],
		["shown", () => shown(), "First"],
		["activity", () => activity(), "settled"],
	]);
});

reflectionStory.it(
	"a query opened while a command is in flight shows the command's change before the command is reflected",
	[],
	function* ({
		beginWrite,
		finished,
		holdReads,
		holdWrites,
		openView,
		releaseReads,
		releaseWrites,
		shown,
		signals,
		untilAccepted,
		untilReadBegins,
		untilWriteArrives,
	}) {
		yield* holdWrites();
		yield* holdReads();
		yield* beginWrite("Second");
		yield* untilWriteArrives();
		openView();
		yield* untilReadBegins();
		yield* releaseWrites();
		yield* untilAccepted();

		expect(yield* signals()).toEqual(["sent", "accepted"]);

		yield* releaseReads();

		yield* outcomes([
			["command", () => finished(), "reflected"],
			["shown", () => shown(), "Second"],
		]);
	},
);

reflectionStory.it(
	"after a reconnect a waiting command is reflected once the reopened query has its first result",
	[watching()],
	function* ({ beginWrite, dropSocket, finished, holdReads, releaseReads, shown, signals, untilAccepted, untilReadBegins }) {
		yield* holdReads();
		yield* beginWrite("Second");
		yield* untilAccepted();
		yield* untilReadBegins();
		yield* dropSocket();

		expect(yield* signals()).toEqual(["sent", "accepted"]);

		yield* releaseReads();

		yield* outcomes([
			["command", () => finished(), "reflected"],
			["shown", () => shown(), "Second"],
		]);
	},
);

reflectionStory.it(
	"while live queries are paused a command waits, and it is reflected when they resume",
	[watching(), alongside("an older client")],
	function* ({ anotherViewerWrites, beginWrite, finished, pause, shown, signals, unpause, untilAccepted, untilHeldBack }) {
		pause();
		yield* beginWrite("Second");
		yield* untilAccepted();
		yield* untilHeldBack(1);
		yield* anotherViewerWrites("Third");
		yield* untilHeldBack(2);

		yield* outcomes([
			["signals", () => signals(), ["sent", "accepted"]],
			["shown", () => shown(), "First"],
		]);

		unpause();

		yield* outcomes([
			["command", () => finished(), "reflected"],
			["shown", () => shown(), "Third"],
		]);
	},
);

reflectionStory.it(
	"a command whose sync token was lost while the host's listener was down is reflected when the listener's recovery resyncs",
	[watching()],
	function* ({ beginWrite, finished, loseListener, recoverListener, shown, signals, untilAccepted }) {
		loseListener();
		yield* beginWrite("Second");
		yield* untilAccepted();

		yield* outcomes([
			["signals", () => signals(), ["sent", "accepted"]],
			["shown", () => shown(), "First"],
		]);

		yield* recoverListener();

		yield* outcomes([
			["command", () => finished(), "reflected"],
			["shown", () => shown(), "Second"],
		]);
	},
);

reflectionStory.it(
	"a sync returns once another client's write is on the screen",
	[watching(), alongside("an older client")],
	function* ({ anotherViewerWrites, beginSync, finished, holdReads, releaseReads, shown, signals, untilAccepted, untilReadBegins }) {
		yield* holdReads();
		yield* anotherViewerWrites("Second");
		yield* untilReadBegins();
		yield* beginSync();
		yield* untilAccepted();

		yield* outcomes([
			["signals", () => signals(), ["sent", "accepted"]],
			["shown", () => shown(), "First"],
		]);

		yield* releaseReads();

		yield* outcomes([
			["command", () => finished(), "reflected"],
			["shown", () => shown(), "Second"],
		]);
	},
);

reflectionStory.it(
	"a client that names no sync id receives only results",
	[watching(), alongside("an older client")],
	function* ({ framesOf, write }) {
		yield* write("Second");
		yield* write("Third");

		expect(yield* framesOf("an older client", 3)).toEqual(["First", "Second", "Third"]);
	},
);

reflectionStory.it(
	"another client's stream confirms only its own tokens",
	[watching(), alongside("another tab")],
	function* ({ framesOf, nameClient, write }) {
		yield* write("Second");
		yield* nameClient("another tab", "another-tab", 7);

		expect(yield* framesOf("another tab", 4)).toEqual(["syncing", "First", "Second", "synced 7"]);
	},
);

reflectionStory.it(
	"a token naming a client the host holds no stream for confirms nothing",
	[alongside("an older client"), alongside("another tab")],
	function* ({ framesOf, nameClient }) {
		yield* nameClient("an older client", "a-stranger", 3);
		yield* nameClient("an older client", "another-tab", 9);

		expect(yield* framesOf("another tab", 3)).toEqual(["syncing", "First", "synced 9"]);
	},
);

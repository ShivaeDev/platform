import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { groupWritableProject, stagingObserved } from "#test/liveTraits.ts";
import { longSocketProject } from "#test/servingTraits.ts";

const project = [projectFiles({ "note.md": "# Notes\n" }), deferredServing];

boardStory.it(
	"a board in a deeply nested folder stages its socket at an address no longer than the public one and answers on the owner-only socket",
	[longSocketProject, stagingObserved],
	function* ({ serverAnswer, socketFile, socketRead, stagingFits }) {
		yield* outcomes({
			"an Inbox read": [socketRead("work-board.inbox"), "answered"],
			"the server answer": [serverAnswer("socket"), { directory: "the project folder", url: "the board" }],
			"the socket": [socketFile(), "owner read-write socket"],
			"the staged address": [stagingFits(), "no longer than the public socket"],
		});
	},
);

boardStory.it("stopping the nested board leaves only the project's files", [longSocketProject], function* ({ boardStops, projectEntries }) {
	expect(yield* projectEntries()).toEqual(["board.sock", "note.md"]);

	yield* boardStops();

	expect(yield* projectEntries()).toEqual(["note.md"]);
});

boardStory.it(
	"a board starting in a group-writable folder binds its socket inside an owner-only staging folder and publishes nothing before chmod",
	[...project, groupWritableProject],
	function* ({ socketFile, stagingSocket, workerReports, workerStarts }) {
		yield* workerStarts("the board", "permissions");

		yield* outcomes({
			"the board": [workerReports("the board"), "paused at permissions"],
			"the public socket": [socketFile(), "missing"],
			"the staged socket": [stagingSocket("the board"), { folder: "700", socket: "775" }],
		});
	},
);

boardStory.it(
	"once the paused board in a group-writable folder continues, its public socket is owner-only and answers",
	[...project, groupWritableProject],
	function* ({ serverAnswer, socketFile, workerContinues, workerReports, workerStarts }) {
		yield* workerStarts("the board", "permissions");
		expect(yield* workerReports("the board")).toBe("paused at permissions");

		yield* workerContinues("the board");

		yield* outcomes({
			"the board": [workerReports("the board"), "ready"],
			"the public socket": [socketFile(), "owner read-write socket"],
			"the server answer": [serverAnswer("socket"), { directory: "the project folder", url: "the board" }],
		});
	},
);

boardStory.it(
	"while one board reclaims a stale socket, a second board starting in another process is refused",
	project,
	function* ({ leaveStaleSocket, workerReports, workerStarts }) {
		yield* leaveStaleSocket();
		yield* workerStarts("the winner", "reclaim");
		expect(yield* workerReports("the winner")).toBe("paused at reclaim");

		yield* workerStarts("the loser");

		expect(yield* workerReports("the loser")).toBe(
			"rejected: Another board is already running at the project folder/board.sock. Stop it before starting this board. A startup lock exists at the project folder/.board.sock.starting; remove it only if its startup was forcibly killed.",
		);
	},
);

boardStory.it(
	"the refused board's cleanup leaves the winner's socket answering",
	project,
	function* ({ leaveStaleSocket, serverAnswer, workerCloses, workerContinues, workerReports, workerStarts }) {
		yield* leaveStaleSocket();
		yield* workerStarts("the winner", "reclaim");
		expect(yield* workerReports("the winner")).toBe("paused at reclaim");
		yield* workerStarts("the loser");
		expect(yield* workerReports("the loser")).toBe(
			"rejected: Another board is already running at the project folder/board.sock. Stop it before starting this board. A startup lock exists at the project folder/.board.sock.starting; remove it only if its startup was forcibly killed.",
		);
		yield* workerContinues("the winner");
		expect(yield* workerReports("the winner")).toBe("ready");

		yield* workerCloses("the loser");

		yield* outcomes({
			"the loser": [workerReports("the loser"), "closed"],
			"the server answer": [serverAnswer("socket"), { directory: "the project folder", url: "the winner" }],
		});
	},
);

boardStory.it(
	"when the board that reclaimed a stale socket closes, neither its socket nor the startup lock remains",
	project,
	function* ({ leaveStaleSocket, projectEntries, workerCloses, workerContinues, workerReports, workerStarts }) {
		yield* leaveStaleSocket();
		yield* workerStarts("the winner", "reclaim");
		expect(yield* workerReports("the winner")).toBe("paused at reclaim");
		yield* workerContinues("the winner");
		expect(yield* workerReports("the winner")).toBe("ready");

		yield* workerCloses("the winner");

		yield* outcomes({
			"the project's files": [projectEntries(), ["note.md"]],
			"the winner": [workerReports("the winner"), "closed"],
		});
	},
);

boardStory.it(
	"a startup whose preparation fails releases the startup lock, so the next start succeeds",
	project,
	function* ({ projectEntries, startAttempt }) {
		expect(yield* startAttempt("failing chmod")).toEqual(expect.stringMatching(/^refused: /u));

		yield* outcomes({
			"the next start": [startAttempt(), "started"],
			"the project's files": [projectEntries(), ["note.md"]],
		});
	},
);

boardStory.it(
	"a startup lock left by a killed process refuses the next start with recovery advice and stays in place",
	project,
	function* ({ abandonStartup, projectEntries, startAttempt }) {
		abandonStartup();

		yield* outcomes({
			"the project's files": [projectEntries(), [".board.sock.starting", "note.md"]],
			"the start": [
				startAttempt(),
				"refused: Another board is already running at the project folder/board.sock. Stop it before starting this board. A startup lock exists at the project folder/.board.sock.starting; remove it only if its startup was forcibly killed.",
			],
		});
	},
);

boardStory.it("once the abandoned startup lock is removed, the board starts", project, function* ({ abandonStartup, removeFile, startAttempt }) {
	abandonStartup();
	expect(yield* startAttempt()).toEqual(
		"refused: Another board is already running at the project folder/board.sock. Stop it before starting this board. A startup lock exists at the project folder/.board.sock.starting; remove it only if its startup was forcibly killed.",
	);

	removeFile(".board.sock.starting");

	expect(yield* startAttempt()).toBe("started");
});

import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { inboxAudienceFixture } from "#test/inboxAudienceFixture.ts";
import { boardWithoutFleet } from "#test/liveTraits.ts";

const project = projectFiles(inboxAudienceFixture());
const serving = [project, boardWithoutFleet];
const ownBoard = { directory: "the project folder", url: "the board" };

boardStory.it("a started board publishes an owner-only socket in the project folder", serving, function* ({ socketFile }) {
	expect(yield* socketFile()).toBe("owner read-write socket");
});

for (const over of ["socket", "TCP"] as const) {
	boardStory.it(`a local client over ${over} learns the folder the board serves and its URL`, serving, function* ({ serverAnswer }) {
		expect(yield* serverAnswer(over)).toEqual(ownBoard);
	});
}

for (const tag of ["work-board.inbox", "work-board.fleetItems", "work-board.goals"]) {
	boardStory.it(`a local socket client reading ${tag} gets the same answer as a TCP client`, serving, function* ({ readOverBoth }) {
		expect(yield* readOverBoth(tag)).toBe("the same answer over socket and TCP");
	});
}

boardStory.it("stopping the board removes its socket", serving, function* ({ boardStops, socketFile }) {
	expect(yield* socketFile()).toBe("owner read-write socket");

	yield* boardStops();

	expect(yield* socketFile()).toBe("missing");
});

boardStory.it(
	"a board starting beside a stale socket that nobody answers takes the socket over",
	[project, deferredServing],
	function* ({ leaveStaleSocket, serverAnswer, start }) {
		yield* leaveStaleSocket();
		expect(yield* serverAnswer("socket")).toBe("unreachable: ECONNREFUSED");

		yield* start();

		expect(yield* serverAnswer("socket")).toEqual(ownBoard);
	},
);

boardStory.it("a second board on the same folder is refused and the first keeps answering", [project], function* ({ serverAnswer, startAttempt }) {
	yield* outcomes({
		"the first board": [serverAnswer("socket"), ownBoard],
		"the second board": [
			startAttempt(),
			"refused: Another board is already running at the project folder/board.sock. Stop it before starting this board.",
		],
	});
});

boardStory.it("boards in two folders answer on their own sockets with their own URLs", [project], function* ({ otherBoardStarts, serverAnswer }) {
	yield* otherBoardStarts(inboxAudienceFixture());

	yield* outcomes({
		"the other folder's socket": [serverAnswer("socket", "the other folder"), { directory: "the other folder", url: "the other board" }],
		"the project's socket": [serverAnswer("socket"), ownBoard],
	});
});

boardStory.it(
	"stopping one of two boards leaves the other folder's socket in place",
	[project],
	function* ({ boardStops, otherBoardStarts, socketFile }) {
		yield* otherBoardStarts(inboxAudienceFixture());

		yield* boardStops();

		yield* outcomes({
			"the other folder's socket": [socketFile("the other folder"), "owner read-write socket"],
			"the project's socket": [socketFile(), "missing"],
		});
	},
);

boardStory.it(
	"of two boards that start together on a fresh folder, exactly one starts and it answers",
	[project, deferredServing],
	function* ({ bothBoardsStart, serverAnswer }) {
		const starts = yield* bothBoardsStart();

		expect(starts).toEqual([expect.stringMatching(/^refused: Another board is already running at the project folder\/board\.sock\./u), "started"]);
		expect(yield* serverAnswer("socket")).toEqual(ownBoard);
	},
);

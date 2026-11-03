import { expect } from "@effect/vitest";
import { boardReadStory, hasBoardItems } from "#test/boardReadStory.ts";

boardReadStory.it(
	"Fleet's generated status file is not listed as approved work",
	[hasBoardItems(1)],
	function* ({ approvedIds, duringOnePass, writeGeneratedStatus }) {
		yield* writeGeneratedStatus();

		expect(yield* duringOnePass(approvedIds())).toEqual(["item.0"]);
	},
);

boardReadStory.it(
	"an authored task at fleet/status.md is listed as Board work",
	[hasBoardItems(1)],
	function* ({ approvedIds, duringOnePass, writeGeneratedStatus, write }) {
		yield* writeGeneratedStatus();

		yield* write("fleet/status.md", "authored.status");

		expect(yield* duringOnePass(approvedIds())).toEqual(["item.0", "authored.status"]);
	},
);

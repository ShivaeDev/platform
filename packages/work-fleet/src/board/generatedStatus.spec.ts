import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardReadStory, countedParses, hasBoardItems } from "#test/boardReadStory.ts";

boardReadStory.it(
	"Fleet's generated status file is neither parsed nor listed as Board work",
	[hasBoardItems(1), countedParses],
	function* ({ approvedIds, duringOnePass, parses, writeGeneratedStatus }) {
		yield* writeGeneratedStatus();

		yield* outcomes([
			["approved work", () => duringOnePass(approvedIds()), ["item.0"]],
			["parsed files", () => parses(), 1],
		]);
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

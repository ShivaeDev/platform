import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { crashableTracedBoard } from "#test/liveTraits.ts";

const note = projectFiles({ "note.md": "# Note" });

boardStory.it("a responses read for an unregistered question answers not found over HTTP RPC", [note], function* ({ responsesRead }) {
	expect(yield* responsesRead("missing")).toBe("not found: The registered question is missing.");
});

boardStory.it(
	"registering a question while responses are disabled answers forbidden with how to enable them",
	[note],
	function* ({ questionRegistration }) {
		expect(yield* questionRegistration()).toBe("forbidden: Start with --responses to explicitly enable local question/response writes.");
	},
);

boardStory.it(
	"a storage defect reaches the client as a bare internal server error while the server span keeps the original defect",
	[note, crashableTracedBoard],
	function* ({ documentRejection, serverSpanCause, storageCrashes }) {
		expect(yield* documentRejection("note.md")).toBe("answered");

		storageCrashes();

		yield* outcomes({
			"the client": [documentRejection("note.md"), { answer: "internal server error", cause: "none", secret: "withheld" }],
			"the server span": [serverSpanCause("work-board.document"), ["internal server error carrying the original defect"]],
		});
	},
);

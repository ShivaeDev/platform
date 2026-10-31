import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardFolderStory, folderContains } from "#test/boardFolderStory.ts";

const APPROVAL = {
	code: "approval-required" as const,
	id: "approval",
	links: [],
	reason: "Work is no longer approved",
	recommendation: "Approve the task and continue.",
};
const NOTE = "The task is approved again. Keep the scoped checks.";

boardFolderStory.it(
	"an approval answer with only text is refused and the Fleet question stays pending",
	[folderContains("withDependency")],
	function* ({ decisionState, publishDecision, respond }) {
		const approval = yield* publishDecision(APPROVAL);

		const answer = yield* respond(approval, { id: "response.approval", selected: [], text: NOTE, type: "answer" });

		expect(answer).toMatch(/^conflict: .*Choose an option/u);
		expect(yield* decisionState(approval)).toBe("pending");
	},
);

boardFolderStory.it(
	"an approval answer that selects retry is recorded with its note",
	[folderContains("withDependency")],
	function* ({ answerBody, decisionState, publishDecision, respond }) {
		const approval = yield* publishDecision(APPROVAL);
		expect(yield* decisionState(approval)).toBe("pending");

		yield* respond(approval, { id: "response.approval", selected: ["retry"], text: NOTE, type: "answer" });

		yield* outcomes([
			["decision", () => decisionState(approval), "answered by response.approval"],
			["answer body", () => answerBody(approval), expect.stringContaining("Keep the scoped checks.")],
		]);
	},
);

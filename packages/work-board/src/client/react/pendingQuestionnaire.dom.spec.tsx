import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { answerContext } from "#test/answerDraft.tsx";
import { screenStory } from "#test/screenStory.ts";
import { answerScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const prompts = [
	{
		id: "direction",
		mode: "one" as const,
		options: [
			{ id: "local", source: "Local" },
			{ id: "export", source: "Export" },
		],
		source: "Which?",
	},
];
const context = answerContext(prompts);

screenStory.it(
	"a choice and note changed while an answer is saving are still on screen after the save completes",
	[answerScreen(context.preview, 0, prompts, context.source)],
	function* ({ answerBoxState, answerStatusLine, chooseAnswer, chosenOptions, holdWorkspace, recordAnswer, releaseWorkspace, writeAnswer }) {
		yield* chooseAnswer("local");
		yield* holdWorkspace();
		yield* recordAnswer();
		expect(yield* answerStatusLine()).toContain("Saving your answer…");
		yield* chooseAnswer("export");
		yield* writeAnswer("A newer rationale", "direction");

		yield* releaseWorkspace();

		yield* outcomes([
			["chosen", () => chosenOptions(), ["export"]],
			["note", () => answerBoxState("direction"), expect.objectContaining({ text: "A newer rationale" })],
			["status", () => answerStatusLine(), expect.stringContaining("Answer saved")],
		]);
	},
);

import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/adapters/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { liveForm } from "#test/answerTraits.ts";
import { screenStory } from "#test/screenStory.ts";
import { answerScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"previewing an empty answer reveals its error without showing Markdown or recording an answer",
	[answerScreen()],
	function* ({ answerPreviewText, fieldProblems, previewAnswer, recordedAnswers }) {
		expect((yield* fieldProblems()).shown).toEqual([]);

		yield* previewAnswer();

		yield* outcomes([
			["field feedback", () => fieldProblems(), { shown: ["Required"] }],
			["preview", () => answerPreviewText(), ""],
			["recorded answers", () => recordedAnswers("item.fixture", "direction"), []],
		]);
	},
);

screenStory.it(
	"previewing a valid answer shows its Markdown without recording it",
	[answerScreen()],
	function* ({ answerPreviewText, previewAnswer, recordedAnswers, writeAnswer }) {
		yield* writeAnswer("Keep the context.");

		yield* previewAnswer();

		yield* outcomes([
			["preview", () => answerPreviewText(), expect.stringContaining("Keep the context.")],
			["recorded answers", () => recordedAnswers("item.fixture", "direction"), []],
		]);
	},
);

screenStory.it(
	"previewing an incomplete handoff reveals the untouched recipient's error without showing or saving a file",
	[liveForm("handoff")],
	function* ({ handoffField, handoffPreview, previewLiveForm, readSessionFiles }) {
		expect((yield* handoffField("Agent name")).feedback).toBe("");

		yield* previewLiveForm("handoff");

		yield* outcomes([
			["recipient feedback", () => handoffField("Agent name"), { feedback: expect.stringContaining("Expected") }],
			["preview", () => handoffPreview(), ""],
			["saved files", () => readSessionFiles("handoffs"), []],
		]);
	},
);

screenStory.it(
	"previewing a valid handoff shows its file without preparing it",
	[liveForm("handoff")],
	function* ({ fillHandoff, handoffPreview, previewLiveForm, readSessionFiles }) {
		yield* fillHandoff("Agent name", "local-reviewer");

		yield* previewLiveForm("handoff");

		yield* outcomes([
			["preview", () => handoffPreview(), expect.stringContaining('"recipient": "local-reviewer"')],
			["saved files", () => readSessionFiles("handoffs"), []],
		]);
	},
);

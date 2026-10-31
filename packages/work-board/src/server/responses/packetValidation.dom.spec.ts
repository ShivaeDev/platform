import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { questionnaireSource } from "#test/questionnaire.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const packet = routedScreen({ "proposal.md": questionnaireSource }, "/_board/item/investigation.choices/", { home: undefined, writable: true });
const WARNING = "Choose an option or answer in your own words.";
const UNANSWERED = `Unanswered: “Which checks matter?”. ${WARNING}`;

screenStory.it(
	"sending with the checks prompt unanswered marks that prompt alone with an error and a field warning and moves focus to it",
	[packet],
	function* ({ check, focusedPrompt, promptError, promptWarnings, sendPacket }) {
		yield* check("history");
		yield* outcomes([
			["checks error", () => promptError("checks"), "none"],
			["warnings", () => promptWarnings(), { checks: "", display: "" }],
		]);

		yield* sendPacket();

		yield* outcomes([
			["checks error", () => promptError("checks"), UNANSWERED],
			["display error", () => promptError("display"), "none"],
			["focus", () => focusedPrompt(), "checks"],
			["warnings", () => promptWarnings(), { checks: WARNING, display: "" }],
		]);
	},
);

screenStory.it(
	"typing an answer into the marked prompt clears its error and warning",
	[packet],
	function* ({ answerPrompt, check, promptError, promptWarnings, sendPacket }) {
		yield* check("history");
		yield* sendPacket();
		expect(yield* promptError("checks")).toBe(UNANSWERED);

		yield* answerPrompt("checks", "Test keyboard use");

		yield* outcomes([
			["checks error", () => promptError("checks"), "none"],
			["warnings", () => promptWarnings(), { checks: "", display: "" }],
		]);
	},
);

screenStory.it(
	"emptying a corrected prompt after a failed send marks it unanswered again",
	[packet],
	function* ({ answerPrompt, check, promptError, sendPacket }) {
		yield* check("history");
		yield* sendPacket();
		yield* answerPrompt("checks", "Test keyboard use");
		expect(yield* promptError("checks")).toBe("none");

		yield* answerPrompt("checks", "");

		expect(yield* promptError("checks")).toBe(UNANSWERED);
	},
);

screenStory.it(
	"sending again after correcting the marked prompt records the answer",
	[packet],
	function* ({ answerPrompt, check, recordedPacketAnswers, sendPacket }) {
		yield* check("history");
		yield* sendPacket();
		yield* answerPrompt("checks", "Test keyboard use");
		expect(yield* recordedPacketAnswers("investigation.choices", "direction")).toBe("question not registered");

		yield* sendPacket();

		expect(yield* recordedPacketAnswers("investigation.choices", "direction")).toEqual([
			[
				{ prompt: "display", selected: ["history"], text: "" },
				{ prompt: "checks", selected: [], text: "Test keyboard use" },
			],
		]);
	},
);

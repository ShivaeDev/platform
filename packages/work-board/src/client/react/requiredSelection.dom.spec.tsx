import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { questionnaireSource } from "#test/questionnaire.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const REQUIRED = routedScreen(
	{ "proposal.md": questionnaireSource.replace('select="one"', 'select="one" required="selection"') },
	"/_board/item/investigation.choices/",
	{ writable: true },
);
const NOTE = "Keep the context with the answer.";

screenStory.it("a question that needs an option asks for one and offers the note as optional", [REQUIRED], function* ({ questionReading }) {
	expect(yield* questionReading("display")).toEqual(
		expect.objectContaining({ block: expect.stringMatching(/Choose an option to continue\..*Add a note \(optional\)/su) }),
	);
});

screenStory.it(
	"recording only a note on a question that needs an option asks the reader to choose one and records nothing",
	[REQUIRED],
	function* ({ answeredNote, questionReading, recordAnswer, recordedAnswers, writeAnswer }) {
		yield* writeAnswer(NOTE, "display");
		yield* writeAnswer("Verify navigation.", "checks");

		yield* recordAnswer();

		yield* outcomes({
			"answered note": [answeredNote(), "none"],
			question: [
				questionReading("display"),
				expect.objectContaining({ block: expect.stringContaining("Choose an option before recording this answer.") }),
			],
			recorded: [recordedAnswers("investigation.choices", "direction"), []],
		});
	},
);

screenStory.it(
	"choosing an option after being asked records it with the note the reader already wrote",
	[REQUIRED],
	function* ({ chooseAnswer, questionReading, recordAnswer, recordedAnswers, writeAnswer }) {
		yield* writeAnswer(NOTE, "display");
		yield* writeAnswer("Verify navigation.", "checks");
		yield* recordAnswer();
		expect(yield* questionReading("display")).toEqual(
			expect.objectContaining({ block: expect.stringContaining("Choose an option before recording") }),
		);

		yield* chooseAnswer("latest");
		yield* recordAnswer();

		expect(yield* recordedAnswers("investigation.choices", "direction")).toEqual([
			expect.objectContaining({ answers: expect.arrayContaining([{ prompt: "display", selected: ["latest"], text: NOTE }]) }),
		]);
	},
);

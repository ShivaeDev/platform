import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { liveForm } from "#test/answerTraits.ts";
import { questionnaireSource } from "#test/questionnaire.ts";
import { screenStory } from "#test/screenStory.ts";
import { screenFiles, screenRoute } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"after the browser restores a questionnaire from its page cache, previewing it shows each field's problem once and drops the earlier Unanswered warning",
	[
		screenFiles({ "home.md": "# Home", "proposal.md": questionnaireSource }, { home: "home.md" }),
		screenRoute("/_board/item/investigation.choices/"),
		liveForm("response"),
	],
	function* ({ answerStatusLine, fieldProblems, previewAnswer, recordAnswer, restoreSession, writeAnswer }) {
		yield* writeAnswer("Keep history.", "display");
		yield* recordAnswer();
		expect(yield* answerStatusLine()).toContain("Unanswered");
		yield* restoreSession();
		yield* writeAnswer("Keyboard checks.", "checks");

		yield* previewAnswer();

		yield* outcomes([
			["problems", () => fieldProblems(), { ids: "each its own", shown: [] }],
			["status", () => answerStatusLine(), expect.not.stringContaining("Unanswered")],
		]);
	},
);

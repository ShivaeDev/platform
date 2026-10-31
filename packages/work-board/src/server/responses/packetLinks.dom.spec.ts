import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { capturedQuestionnaire, questionnaireSource } from "#test/questionnaire.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const managed = questionnaireSource.replace("kind: decision", "kind: decision\n    managed: true");
const waiting = questionnaireSource.replace("kind: task", "kind: task\nstatus: ready");

for (const { files, packet } of [
	{ files: { "decision.md": managed }, packet: "a managed packet" },
	{ files: { "decision.md": questionnaireSource, "responses/question.md": capturedQuestionnaire() }, packet: "a registered packet" },
	{ files: { "decision.md": waiting, "responses/question.md": capturedQuestionnaire(waiting) }, packet: "a registered packet on ready work" },
]) {
	screenStory.it(
		`Today links ${packet} straight to its answer card`,
		[routedScreen({ ...files, "home.md": "# Home" }, "/", { home: "home.md" })],
		function* ({ todayAnswerLinks }) {
			expect(yield* todayAnswerLinks()).toEqual(["/_board/item/investigation.choices/#answer-card-direction"]);
		},
	);
}

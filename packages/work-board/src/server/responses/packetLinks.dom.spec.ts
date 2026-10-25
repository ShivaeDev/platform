import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { capturedQuestionnaire, questionnaireSource } from "#test/questionnaire.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

const OPEN_PACKET = 1;

expectNoReactWarnings();
for (const mode of ["managed", "registered", "waiting"]) {
	let source = questionnaireSource;
	if (mode === "managed") {
		source = source.replace("kind: decision", "kind: decision\n    managed: true");
	}
	if (mode === "waiting") {
		source = source.replace("kind: task", "kind: task\nstatus: ready");
	}
	screenStory.it(
		`links a ${mode} packet from Today directly to its answer card`,
		[
			routedScreen(
				{ "decision.md": source, "home.md": "# Home", ...(mode === "managed" ? {} : { "responses/question.md": capturedQuestionnaire(source) }) },
				"/",
				{ home: "home.md" },
			),
		],
		function* ({ findElements }) {
			yield* eventually(() => expect(findElements("[data-attention-row] a[title]")).toHaveLength(OPEN_PACKET));
			expect(findElements("[data-attention-row] a[title]")[0]?.getAttribute("href")).toBe(
				"/_board/item/investigation.choices/#answer-card-direction",
			);
		},
	);
}

import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { deniedClipboard } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"opens and selects the goal template for the reader to copy when the clipboard refuses it",
	[deniedClipboard(), routedScreen({ "home.md": "# Home" }, "/_board/start")],
	function* ({ copyTemplate, focusedField, templateCard, templateSource }) {
		const source = (yield* templateSource("goal.md")) ?? "";
		expect(yield* templateCard("goal.md")).toEqual({ source: "closed", status: "" });

		yield* copyTemplate("goal.md");

		yield* outcomes({
			"the card": [
				templateCard("goal.md"),
				{ source: "open", status: "Couldn't copy automatically. The template is selected, so copy it yourself." },
			],
			"the focused field": [focusedField(), { selection: [0, source.length, "none"], value: source }],
		});
	},
);

import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const emptyWorkspace = routedScreen({}, "/_board/start");

screenStory.it(
	"starts an empty workspace with four steps and Goal, Investigation and Report templates",
	[emptyWorkspace],
	function* ({ mainHeading, startSteps, templateCards }) {
		yield* outcomes([
			["the heading", () => mainHeading(), "Start your workspace"],
			[
				"the steps",
				() => startSteps(),
				[
					"Copy a template below.",
					"Save it in this folder under the suggested name.",
					"Change the example IDs to your own, and update the links that use them.",
					"Fill in the real details. Start with the goal, then the investigation and the report.",
				],
			],
			[
				"the templates",
				() => templateCards(),
				[
					{ saveAs: "Save as goal.md", title: "Goal" },
					{ saveAs: "Save as investigation.md", title: "Investigation" },
					{ saveAs: "Save as report.md", title: "Report" },
				],
			],
		]);
	},
);

screenStory.it(
	"copies the goal template to the clipboard and says to save it as goal.md",
	[emptyWorkspace],
	function* ({ copiedText, copyTemplate, templateCard, templateSource }) {
		const source = yield* templateSource("goal.md");

		yield* copyTemplate("goal.md");

		yield* outcomes([
			["the card", () => templateCard("goal.md"), { source: "closed", status: "Copied. Save it as goal.md." }],
			["the clipboard", () => copiedText(), source],
		]);
	},
);

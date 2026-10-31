import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { archivedSources } from "#test/attentionLaneTraits.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { questionSource, settledFixture } from "#test/settledFixture.ts";

boardStory.it(
	"an archived question keeps its item link and answer when a new open question reuses its source filename",
	[
		archivedSources(settledFixture().files),
		projectFiles({ "decisions/settled.md": questionSource("replacement", "ready", "open") }, "a new open question is saved as decisions/settled.md"),
	],
	function* ({ answersOf, briefStatus }) {
		yield* outcomes({
			"archived answers": [answersOf("settled"), [{ body: "Keep the reviewed option.\n", id: "answer.settled" }]],
			"archived question": [briefStatus("settled"), "done"],
			"new open question": [briefStatus("replacement"), "ready"],
		});
	},
);

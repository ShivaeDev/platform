import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { reviewedDecisionId, reviewedWorkFixture } from "#test/reviewedWorkFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
const decision = `/_board/item/${reviewedDecisionId}/`;

screenStory.it(
	"a Fleet decision shows the work it reviewed as title, criteria and description instead of raw front matter",
	[routedScreen(reviewedWorkFixture(), decision, { home: "tasks/upload.md" })],
	function* ({ sectionBlocks }) {
		expect(yield* sectionBlocks("Reviewed Board work")).toEqual([
			"p: Fix the flaky upload test · task.upload",
			"p: Criteria:",
			"ul: The upload test passes 50 runs in a row. | The pull request names the race.",
			"blockquote: The upload test fails about once in twenty runs.",
		]);
	},
);

screenStory.it(
	"reviewed work without readable front matter stays as the agent wrote it",
	[routedScreen(reviewedWorkFixture("Plain notes from the reviewer."), decision, { home: "tasks/upload.md" })],
	function* ({ sectionBlocks }) {
		expect(yield* sectionBlocks("Reviewed Board work")).toEqual(["pre: Plain notes from the reviewer."]);
	},
);

screenStory.it(
	"untitled reviewed work is named by its id and lists no criteria",
	[routedScreen(reviewedWorkFixture("---\nid: task.untitled\nkind: task\n---\nOnly a description."), decision, { home: "tasks/upload.md" })],
	function* ({ sectionBlocks }) {
		expect(yield* sectionBlocks("Reviewed Board work")).toEqual(["p: task.untitled · task.untitled", "blockquote: Only a description."]);
	},
);

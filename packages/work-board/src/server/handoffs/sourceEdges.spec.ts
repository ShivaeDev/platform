import { expect } from "vitest";
import { aQuestionnaire, boardStory } from "#test/boardStory.ts";
import { silentWatch } from "#test/faults.ts";

boardStory.it("a registered question cannot be reviewed as a handoff source", [aQuestionnaire()], function* ({ handoffSourceFor, register }) {
	const question = yield* register();

	expect(yield* handoffSourceFor(question.id)).toBe("precondition failed: Choose a current project item for this handoff.");
});

boardStory.it(
	"a handoff source that loses read permission before the watcher notices is reported unavailable",
	[aQuestionnaire(undefined, silentWatch)],
	function* ({ handoffSourceFor, permissions }) {
		expect(yield* handoffSourceFor("investigation.choices")).toBe("investigation.choices from proposal.md");

		permissions("proposal.md", 0o000);

		expect(yield* handoffSourceFor("investigation.choices")).toBe("unavailable: The handoff source could not be read.");
	},
);

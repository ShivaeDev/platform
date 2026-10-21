import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { statusVocabularyFixture } from "#test/statusVocabularyFixture.ts";

expectNoReactWarnings();
for (const single of [false, true]) {
	const files = statusVocabularyFixture();
	if (single) {
		delete files["tasks/ready.md"];
	}
	screenStory.it(
		`shows ready briefs in Queued and counts the ${single ? "single task" : "tasks"} in navigation`,
		[routedScreen(files, "/_board/work")],
		function* ({ findElement, readAttribute, readText }) {
			yield* Effect.promise(() => eventually(() => expect(findElement('[aria-label="Queued"] [data-item="task.merge"]')).not.toBeNull()));
			expect(readText('[data-item="task.merge"] [data-status-token]')).toBe("Ready");
			expect(findElement('[data-item="task.odd"]')).toBeNull();
			yield* Effect.promise(() =>
				eventually(() => expect(readAttribute("a[href='/_board/work']", "aria-label")).toBe(single ? "Now, 1 open task" : "Now, 2 open tasks")),
			);
		},
	);
}
screenStory.it(
	"names an invalid authored state and the migration command on System",
	[routedScreen(statusVocabularyFixture(), "/_board/system")],
	function* ({ findElement, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement('[data-source-problem="tasks/odd.md"]')).not.toBeNull()));
		expect(readText('[data-source-problem="tasks/odd.md"]')).toContain("Invalid status; run work-board migrate <board dir>.");
	},
);

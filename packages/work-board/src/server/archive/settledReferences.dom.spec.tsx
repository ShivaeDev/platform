import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { settledReferencesFixture } from "#test/settledReferencesFixture.ts";

expectNoReactWarnings();

for (const unknown of [false, true]) {
	boardStory.it(
		unknown
			? "Files with problems renders only the unknown reference after settling"
			: "Files with problems renders its empty state after settling referenced work",
		[
			projectFiles({
				...settledReferencesFixture,
				...(unknown ? { "unknown.md": "---\nitems: [missing.id]\n---\n# Unknown reference\n" } : {}),
			}),
			deferredServing,
		],
		function* (board) {
			yield* board.start({ fleetPort: null });

			const screen = yield* board.openSourceProblems();

			expect(board.fileExists("decisions/settled.md")).toBe(false);
			const problems = [...screen.container.querySelectorAll("[data-source-problem]")];
			if (unknown) {
				expect(problems.map((row) => [row.querySelector("a")?.textContent, row.lastElementChild?.textContent])).toEqual([
					["unknown.md", "Unresolved reference missing.id."],
				]);
			} else {
				expect(problems).toEqual([]);
				expect(screen.container.querySelector('[data-slot="empty-title"]')?.textContent).toBe("No files with problems");
			}
		},
	);
}

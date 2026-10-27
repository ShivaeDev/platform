import { expect } from "vitest";
import { areaRepository } from "#test/areaRepository.ts";
import { boardStory } from "#test/boardStory.ts";

boardStory.it("the brief's source diagnostics show its invalid area and suggested folder", [areaRepository(["effect-react"])], function* (board) {
	const view = yield* board.openMetadata("task.md");
	expect(view.container.querySelector('[role="status"]')?.textContent).toContain("Source diagnostics");
	expect(view.container.querySelector("li")?.textContent).toBe(
		'task.md:4 — Area "effect-react" does not name an existing repository folder. Did you mean "react"?',
	);
});

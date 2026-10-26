import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { expect } from "vitest";
import { eventually } from "@shivaedev/react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
import { boardRouter } from "./boardRouter.ts";

const files = {
	"decision.md": "---\nid: decision\nkind: question\nscope: task\nurgency: whenever\n---\n# Decision record",
	"question.md": "---\nid: question\nkind: question\nscope: task\nurgency: whenever\n---\n# Question record",
	"receipt.md": `---\nid: receipt\nkind: task\nrequest_receipt:\n  disposition: superseded\n  question: question\n  recordedAt: 0\n  reviewedRevision: "${"a".repeat(64)}"\n---\n# Receipt record`,
	"response.md": "---\nid: response\n---\n# Response record",
	"result.md": "---\nid: result\nkind: report\n---\n# Result record",
	"task.md": "---\nid: task\nkind: task\nstatus: ready\n---\n# Work task",
};

for (const query of ["", "?view=table", "?view=board"]) {
	screenStory.it(
		`excludes records from Work${query} through the projection query`,
		[
			boardScreen(files, (api, registry) => {
				const router = boardRouter({ api, registry });
				router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: [`/_board/work${query}`] }) });
				return <RouterProvider router={router} />;
			}),
		],
		function* ({ findElement, findElements, readText }) {
			yield* eventually(() => expect(findElement('[data-item="task"]')).not.toBeNull());
			expect(findElements("[data-item]").map((item) => item.getAttribute("data-item"))).toEqual(["task"]);
			if (query) {
				expect(readText(".work-total")).toContain("1 shown · 1 items");
			} else {
				expect(findElement(".work-total")).toBeNull();
			}
			expect(readText('[aria-label="Work layout"]')).toContain("NowAll workTable");
		},
	);
}

import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
import { boardRouter } from "./boardRouter.ts";

const files = {
	"decision.md": "---\nid: decision\nkind: decision\n---\n# Decision record",
	"question.md": "---\nid: question\nkind: question\n---\n# Question record",
	"receipt.md": `---\nid: receipt\nkind: task\nrequest_receipt:\n  disposition: superseded\n  question: question\n  recordedAt: 0\n  reviewedRevision: "${"a".repeat(64)}"\n---\n# Receipt record`,
	"response.md": "---\nid: response\nkind: response\n---\n# Response record",
	"result.md": "---\nid: result\nkind: result\n---\n# Result record",
	"task.md": "---\nid: task\nkind: task\nstatus: active\n---\n# Work task",
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
		function* ({ boardView }) {
			const view = boardView();

			yield* Effect.promise(() => eventually(() => expect(view.container.querySelector('[data-item="task"]')).not.toBeNull()));
			expect(view.container.querySelectorAll("[data-item]")).toHaveLength(1);
			if (query) {
				expect(view.container.querySelector(".work-total")?.textContent).toContain("1 shown · 1 items");
			} else {
				expect(view.container.querySelector(".work-total")).toBeNull();
			}
			expect(view.container.querySelector('[aria-label="Work layout"]')?.textContent).toContain("NowAll workTable");
		},
	);
}

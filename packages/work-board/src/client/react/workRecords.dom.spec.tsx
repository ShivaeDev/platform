import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { expect, it } from "vitest";
import { eventually } from "@shivaedev/effect-react/testing.ts";
import { renderBoard } from "#test/react.tsx";
import { boardRouter } from "./boardRouter.ts";

const files = {
	"decision.md": "---\nid: decision\nkind: decision\n---\n# Decision record",
	"question.md": "---\nid: question\nkind: question\n---\n# Question record",
	"receipt.md": `---\nid: receipt\nkind: task\nrequest_receipt:\n  disposition: superseded\n  question: question\n  recordedAt: 0\n  reviewedRevision: "${"a".repeat(64)}"\n---\n# Receipt record`,
	"response.md": "---\nid: response\nkind: response\n---\n# Response record",
	"result.md": "---\nid: result\nkind: result\n---\n# Result record",
	"task.md": "---\nid: task\nkind: task\nstatus: active\n---\n# Work task",
};

it.each(["", "?view=table", "?view=board"])("excludes records from Work%s through the projection query", async (query) => {
	const view = await renderBoard(files, (api, registry) => {
		const router = boardRouter({ api, initial: "", registry });
		router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: [`/_board/work${query}`] }) });
		return <RouterProvider router={router} />;
	});
	try {
		await eventually(() => expect(view.container.querySelector('[data-item="task"]')).not.toBeNull());
		expect(view.container.querySelectorAll("[data-item]")).toHaveLength(1);
		if (query) {
			expect(view.container.querySelector(".work-total")?.textContent).toContain("1 shown · 1 items");
		} else {
			expect(view.container.querySelector(".work-total")).toBeNull();
		}
		expect(view.container.querySelector('[aria-label="Work layout"]')?.textContent).toContain("NowAll workTable");
	} finally {
		await view.unmount();
	}
});

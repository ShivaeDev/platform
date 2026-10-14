import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { expect, it } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { attentionLanesFixture } from "#test/attentionLanesFixture.ts";
import { renderBoard } from "#test/react.tsx";
import { boardRouter } from "./boardRouter.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

it.each(["/_board/inbox", "/_board/overview"])("shows four asks for you on %s and both navigation badges", async (url) => {
	const view = await renderBoard(attentionLanesFixture(), (api, registry) => {
		const router = boardRouter({ api, initial: "", registry });
		router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: [url] }) });
		return <RouterProvider router={router} />;
	});
	try {
		await eventually(() => expect(view.container.querySelector("main")?.textContent).toContain("4 waiting"));
		for (const id of ["inbox-count", "inbox-topbar-count"]) {
			expect(view.container.querySelector(`#${id}`)?.textContent).toBe("4");
		}
		if (url === "/_board/inbox") {
			const list = view.container.querySelector(".inbox-list");
			expect(list?.querySelectorAll(".inbox-row")).toHaveLength(4);
			expect(list?.textContent).not.toMatch(/Question for (?:orchestrator|automation)|Unknown metadata|Missing reference/u);
			const groups = [...view.container.querySelectorAll<HTMLDetailsElement>(".inbox-group")];
			expect(groups.map((group) => group.querySelector("summary")?.textContent)).toEqual([
				"Waiting on agents (2)",
				"Resolved elsewhere (4)",
				"Parked (1)",
			]);
			expect(groups[0]?.textContent).toContain("Response needed from: orchestrator");
			expect(groups[0]?.textContent).toContain("Response needed from: automation");
			expect(groups.map((group) => group.open)).toEqual([false, false, false]);
		} else {
			expect(view.container.querySelector(".view-issues summary")?.textContent).toContain("(2)");
		}
	} finally {
		await view.unmount();
	}
});

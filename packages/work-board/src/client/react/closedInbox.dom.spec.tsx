import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { expect, it } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { closedInboxFixture } from "#test/closedInboxFixture.ts";
import { renderBoard } from "#test/react.tsx";
import { boardRouter } from "./boardRouter.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

it("renders two waiting rows and excludes collapsed resolved and parked asks from the badges", async () => {
	const files = closedInboxFixture();
	const original = { ...files };
	const view = await renderBoard(files, (api, registry) => {
		const router = boardRouter({ api, initial: "", registry });
		router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: ["/_board/inbox"] }) });
		return <RouterProvider router={router} />;
	});
	try {
		await eventually(() => expect(view.container.querySelectorAll(".inbox-list .inbox-row")).toHaveLength(2));
		const list = view.container.querySelector(".inbox-list");
		expect(list?.textContent).toContain("planned task");
		expect(list?.textContent).toContain("planned ask 2");
		expect(list?.textContent).toContain("1 earlier ask");
		expect(list?.textContent).not.toContain("planned ask 1");
		expect(list?.textContent).toContain("Where should the project documents live?");
		for (const id of ["inbox-count", "inbox-topbar-count"]) {
			expect(view.container.querySelector(`#${id}`)?.textContent).toBe("2");
		}
		const groups = [...view.container.querySelectorAll<HTMLDetailsElement>(".inbox-group")];
		expect(groups.map((group) => group.querySelector("summary")?.textContent)).toEqual(["Resolved elsewhere (4)", "Parked (1)"]);
		expect(groups.map((group) => group.open)).toEqual([false, false]);
		expect(groups.map((group) => group.querySelectorAll(".inbox-row").length)).toEqual([4, 1]);
		expect(files).toEqual(original);
	} finally {
		await view.unmount();
	}
});

import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { loadQuery } from "@shivaedev/effect-react/router.ts";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { routeQueryOptions } from "#client/page/routeQuery.ts";
import { browserStorage } from "#test/browserStorage.ts";
import { type BoardTestApi, renderBoard } from "#test/react.tsx";
import { todayFixture } from "#test/todayFixture.ts";
import { todayFleetFixture } from "#test/todayFleetFixture.ts";
import { boardRouter } from "./boardRouter.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
beforeEach(() => browserStorage());
afterEach(() => {
	window.dispatchEvent(new Event("pagehide"));
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it("opens Today with the exact human lane and one honest card per goal, retaining Workspace notes", async () => {
	let api: BoardTestApi | undefined;
	const view = await renderBoard(
		todayFixture(),
		(client, registry) => {
			api = client;
			vi.spyOn(client.fleetItems, "query").mockReturnValue(Atom.make(AsyncResult.success(todayFleetFixture())));
			const router = boardRouter({ api: client, initial: "", registry });
			router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: ["/"] }) });
			return <RouterProvider router={router} />;
		},
		{ home: "home.md" },
	);
	try {
		await eventually(() => expect(view.container.querySelector("#doc h1")?.textContent).toBe("Today"));
		expect(view.container.querySelector('#primary-navigation [aria-current="page"]')?.getAttribute("href")).toBe("/");
		if (!api) {
			throw new Error("Missing fixture API");
		}
		const inbox = await loadQuery(view.registry, api.inbox.query(undefined, routeQueryOptions), { abortController: new AbortController() });
		const goals = await loadQuery(view.registry, api.goals.query(undefined, routeQueryOptions), { abortController: new AbortController() });
		expect([...view.container.querySelectorAll("[data-attention-id]")].map((row) => row.getAttribute("data-attention-id"))).toEqual(
			inbox.you.map((item) => item.id),
		);
		expect([...view.container.querySelectorAll("[data-goal-id]")].map((card) => card.getAttribute("data-goal-id"))).toEqual(
			goals.goals.map((goal) => goal.id),
		);
		expect(view.container.querySelectorAll("[data-goal-next-action]")).toHaveLength(3);
		for (const goal of goals.goals) {
			const next = view.container.querySelector(`[data-goal-id='${goal.id}'] [data-goal-next-action]`);
			if (goal.nextAction) {
				expect(next?.textContent).toBe(goal.nextAction);
				expect(next?.getAttribute("title")).toBe(goal.nextAction);
				expect(next?.classList.contains("line-clamp-2")).toBe(true);
			} else {
				expect(next).toBeNull();
			}
		}
		expect(view.container.querySelector(".today-strip")?.textContent).toBe(
			`${inbox.you.length} need you·9 in progress·${goals.goals.length} active goals`,
		);
		expect([...view.container.querySelectorAll(".today-strip a")].map((link) => link.getAttribute("href"))).toEqual([
			"#needs-you",
			"#in-progress",
			"#today-goals",
		]);
		expect(view.container.querySelector("[data-goal-id='project.example']")?.textContent).toContain("51 linked · 1 with evidence");
		expect(view.container.querySelector("[data-goal-id='project.empty']")?.textContent).toContain("0 of 0 done");
		expect(view.container.querySelector("#today-goals")?.textContent).not.toContain("not linked");
		expect(view.container.querySelector("#today-goals")?.textContent).not.toContain("%");
		expect(view.container.querySelector("#doc")?.textContent).not.toContain("Resolved elsewhere");
		expect(view.container.querySelector("#doc")?.textContent).not.toContain("Parked");
		expect(view.container.querySelectorAll("[data-progress-id]")).toHaveLength(8);
		expect(view.container.querySelector("#in-progress a[href='/_board/work']")?.textContent).toBe("All in Now →");
		const criteria = [...view.container.querySelectorAll<HTMLDetailsElement>(".today-goal details")];
		expect(criteria).toHaveLength(goals.goals.length);
		expect(criteria.every((entry) => !entry.open)).toBe(true);
		act(() => {
			if (criteria[0]) {
				criteria[0].open = true;
			}
		});
		expect(criteria[0]?.open).toBe(true);
		expect([...view.container.querySelectorAll(".today-grid h2")].map((node) => node.textContent)).toEqual(["Needs you", "In progress", "Goals"]);
		expect(view.container.querySelector("#needs-you")?.nextElementSibling?.id).toBe("in-progress");
		expect(view.container.querySelector("#needs-you")?.parentElement).not.toBe(view.container.querySelector("#today-goals")?.parentElement);
		expect(view.container.querySelector(".today-page a[href='/home.md']")?.textContent).toBe("Workspace notes");
	} finally {
		await view.unmount();
	}
});

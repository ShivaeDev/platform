import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { loadQuery } from "@shivaedev/effect-react/router.ts";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { routeQueryOptions } from "#client/page/routeQuery.ts";
import { session } from "#client/session.ts";
import { questionId, questionMarkdown, responseMarkdown, revisionOf } from "#server/responses/records.ts";
import { browserStorage } from "#test/browserStorage.ts";
import { type BoardTestApi, renderBoard } from "#test/react.tsx";
import { renderRouter } from "#test/renderRouter.tsx";
import { todayFixture } from "#test/todayFixture.ts";
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
			const router = boardRouter({ api: client, initial: "", registry });
			router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: ["/"] }) });
			return <RouterProvider router={router} />;
		},
		{ home: "home.md" },
	);
	try {
		await eventually(() => expect(view.container.querySelector("#doc h1")?.textContent).toBe("Today"));
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
		expect(view.container.querySelector(".today-strip")?.textContent).toBe(
			`${inbox.you.length} need you·${inbox.agents.length} waiting on agents·${goals.goals.length} active goals`,
		);
		expect([...view.container.querySelectorAll(".today-strip a")].map((link) => link.getAttribute("href"))).toEqual([
			"#needs-you",
			"#waiting-agents",
			"#today-goals",
		]);
		expect(view.container.querySelector("[data-goal-id='project.example']")?.textContent).toContain("51 linked · 1 with evidence");
		expect(view.container.querySelector("[data-goal-id='project.empty']")?.textContent).toContain("not linked");
		expect(view.container.querySelector("#today-goals")?.textContent).not.toContain("%");
		expect([...view.container.querySelectorAll<HTMLDetailsElement>(".today-group")].map((group) => group.open)).toEqual([false, false, false]);
		expect(view.container.querySelector("#waiting-agents")?.textContent).toContain("Response needed from: orchestrator");
		expect(view.container.querySelector("#waiting-agents")?.textContent).toContain("Response needed from: automation");
		expect(view.container.querySelector(".today-page a[href='/home.md']")?.textContent).toBe("Workspace notes");
	} finally {
		await view.unmount();
	}
});

it("records an inline option with the response command and removes its ask on query refresh", async () => {
	const files = todayFixture();
	const source = files["unaddressed.md"] ?? "";
	const revision = revisionOf(source);
	const id = questionId("question.storage", "answer", revision, "unaddressed.md");
	const native = session(window);
	vi.spyOn(native, "mutate").mockResolvedValue({ id });
	const register = native.responses.registerQuestion.run;
	vi.spyOn(native.responses.registerQuestion, "run").mockImplementation((input) => {
		files["responses/question.md"] = questionMarkdown({
			context: source,
			id,
			question: {
				deadline: 10_000,
				item: input.item,
				reason: "Choose storage",
				registeredAt: 1,
				request: input.request,
				reviewedRevision: input.revision,
				source: "unaddressed.md",
			},
		});
		return register(input);
	});
	const record = native.responses.recordResponse.run;
	const command = vi.spyOn(native.responses.recordResponse, "run").mockImplementation((input) => {
		files["responses/answer.md"] = responseMarkdown({
			body: input.body,
			id: input.id,
			response: {
				answers: input.answers,
				author: input.author,
				question: input.question,
				recordedAt: 2,
				reviewedRevision: revision,
				type: input.type,
			},
		});
		return record(input);
	});
	const view = await renderRouter(files, "/", { home: "home.md", writable: true });
	try {
		await eventually(() =>
			expect(view.container.querySelector("[aria-label='Options for question.storage'] button")?.textContent).toBe("Keep local files · Recommended"),
		);
		expect(view.container.querySelectorAll("[data-attention-id='question.storage']")).toHaveLength(1);
		await act(async () => view.container.querySelector<HTMLButtonElement>("[aria-label='Options for question.storage'] button")?.click());
		await eventually(() =>
			expect(command).toHaveBeenCalledWith(
				expect.objectContaining({ answers: [{ prompt: "answer", selected: ["option-1"], text: "" }], question: id, type: "answer" }),
			),
		);
		await eventually(() => expect(view.container.querySelector("[data-attention-id='question.storage']")).toBeNull());
	} finally {
		await view.unmount();
	}
});

it("opens Today without a configured home and preserves empty-workspace guidance", async () => {
	const view = await renderRouter({}, "/", { home: undefined });
	try {
		await eventually(() => expect(view.container.querySelector("#doc h1")?.textContent).toBe("Today"));
		expect(view.container.querySelector(".today-strip")?.textContent).toBe("0 need you·0 waiting on agents·0 active goals");
		expect(view.container.querySelector(".today-page a[href='/_board/start']")?.textContent).toBe("Getting started");
	} finally {
		await view.unmount();
	}
});

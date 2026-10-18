import { Effect } from "effect";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { questionId, questionMarkdown, responseMarkdown, revisionOf } from "#server/responses/records.ts";
import { browserStorage } from "#test/browserStorage.ts";
import { renderRouter } from "#test/renderRouter.tsx";
import { todayFixture } from "#test/todayFixture.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
beforeEach(() => browserStorage());
afterEach(() => {
	window.dispatchEvent(new Event("pagehide"));
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it("opens compact answer controls, records an option and removes its ask on query refresh", async () => {
	const files = todayFixture();
	const source = files["unaddressed.md"] ?? "";
	const revision = revisionOf(source);
	const id = questionId("question.storage", "answer", revision, "unaddressed.md");
	const view = await renderRouter(files, "/", { home: "home.md", writable: true });
	const native = view.forms;
	vi.spyOn(native.responses.registerQuestion, "run").mockImplementation((input) =>
		Effect.sync(() => {
			const question = {
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
			};
			files["responses/question.md"] = questionMarkdown(question);
			return question;
		}),
	);
	const command = vi.spyOn(native.responses.recordResponse, "run").mockImplementation((input) =>
		Effect.sync(() => {
			const response = {
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
			};
			files["responses/answer.md"] = responseMarkdown(response);
			return response;
		}),
	);
	try {
		await eventually(() =>
			expect(view.container.querySelector("[aria-label='Options for question.storage'] button")?.textContent).toContain(
				"Keep local files · Recommended",
			),
		);
		const entry = view.container.querySelector("[data-attention-id='question.storage']");
		const trigger = entry?.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]');
		const dialog = entry?.querySelector<HTMLElement>('[role="dialog"]');
		expect(dialog?.hidden).toBe(true);
		expect(trigger?.getAttribute("aria-expanded")).toBe("false");
		act(() => trigger?.click());
		await eventually(() => expect(dialog?.hidden).toBe(false));
		expect(document.activeElement?.textContent).toContain("Keep local files · Recommended");
		act(() => document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })));
		expect(dialog?.hidden).toBe(true);
		expect(document.activeElement).toBe(trigger);
		act(() => trigger?.click());
		expect(dialog?.hidden).toBe(false);
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
		expect(view.container.querySelector(".today-strip")?.textContent).toBe("0 need you·Fleet unavailable·0 active goals");
		expect(view.container.querySelector(".today-page a[href='/_board/start']")?.textContent).toBe("Getting started");
	} finally {
		await view.unmount();
	}
});

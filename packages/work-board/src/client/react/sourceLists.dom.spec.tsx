import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { answerCardFixture, decisionFile } from "#test/answerCardFixture.ts";
import { browserStorage } from "#test/browserStorage.ts";
import { renderRouter } from "#test/renderRouter.tsx";
import { sourceListsFixture } from "#test/sourceListsFixture.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
beforeEach(browserStorage);
afterEach(() => vi.unstubAllGlobals());

it.each(["/task.md", "/goal.md", "/_board/work", "/_board/work?view=table", "/_board/work?view=board", "/_board/library", "/_board/inbox", "/"])(
	"keeps absent values quiet at %s",
	async (url) => {
		const view = await renderRouter(sourceListsFixture(), url);
		try {
			await eventually(() => expect(view.container.querySelector("main h1")).not.toBeNull());
			expect(view.container.textContent).not.toMatch(/not recorded/iu);
			expect(view.container.textContent).not.toContain("These are explicit source links");
			expect(view.container.textContent).not.toContain("Open/closed is source state");
			expect(view.container.textContent).not.toContain("Acceptance is not established");
		} finally {
			await view.unmount();
		}
	},
);

it("collapses repeated titles in backlinks and relationships, retaining each source in its most specific group", async () => {
	const view = await renderRouter(sourceListsFixture(), "/task.md");
	try {
		await eventually(() => expect(view.container.querySelector('[aria-label="Source backlinks"]')).not.toBeNull());
		const backlinks = view.container.querySelector('[aria-label="Source backlinks"]');
		expect(backlinks?.querySelector("h3")?.textContent).toBe("Referenced by (4)");
		expect(backlinks?.querySelector('[aria-label="Related to backlinks"]')).toBeNull();
		for (const section of [backlinks, view.container.querySelector('[aria-label="Relationships"]')]) {
			const group = [...(section?.querySelectorAll("details") ?? [])].find(
				(entry) => entry.querySelector("summary")?.textContent === "Fleet decisions (4)",
			);
			expect(group).toHaveProperty("open", false);
			expect(group?.querySelectorAll("a")).toHaveLength(0);
			act(() => {
				if (group) {
					group.open = true;
					group.dispatchEvent(new Event("toggle"));
				}
			});
			expect(group?.querySelectorAll("a")).toHaveLength(4);
		}
		expect(backlinks?.querySelectorAll("a")).toHaveLength(4);
		expect(view.container.textContent).not.toMatch(/not recorded/iu);
	} finally {
		await view.unmount();
	}
});

it.each(["done", "completed", "deferred"])("hides open managed asks from cards and Inbox for %s work", async (status) => {
	const files = { ...answerCardFixture, "guide.md": answerCardFixture["guide.md"].replace("status: blocked", `status: ${status}`) };
	for (const url of ["/guide.md", `/${decisionFile}`, "/_board/inbox", "/"]) {
		const view = await renderRouter(files, url);
		try {
			await eventually(() => expect(view.container.querySelector("main h1")).not.toBeNull());
			expect(view.container.querySelector(".answer-cards")).toBeNull();
			expect(view.container.querySelector("#response-form")).toBeNull();
			const main = view.container.querySelector("main")?.cloneNode(true);
			if (!(main instanceof HTMLElement)) {
				throw new Error("Missing page");
			}
			for (const details of main.querySelectorAll("details:not([open])")) {
				details.remove();
			}
			const defaultText = main.textContent;
			if (!url.includes(decisionFile)) {
				expect(defaultText).not.toContain("Which publishing path should we take?");
			}
		} finally {
			await view.unmount();
		}
	}
});

it("omits the answer card when an authored question is closed", async () => {
	const view = await renderRouter(
		{ "question.md": "---\nid: question.finished\nkind: question\nstatus: closed\n---\n# Previous question" },
		"/question.md",
	);
	try {
		await eventually(() => expect(view.container.querySelector("main h1")?.textContent).toBe("Previous question"));
		expect(view.container.querySelector(".answer-cards")).toBeNull();
	} finally {
		await view.unmount();
	}
});

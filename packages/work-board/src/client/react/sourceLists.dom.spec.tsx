import { Effect } from "effect";
import { act } from "react";
import { afterEach, expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { answerCardFixture, decisionFile } from "#test/answerCardFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { sourceListsFixture } from "#test/sourceListsFixture.ts";

expectNoReactWarnings();
afterEach(() => vi.unstubAllGlobals());

for (const url of [
	"/task.md",
	"/goal.md",
	"/_board/work",
	"/_board/work?view=table",
	"/_board/work?view=board",
	"/_board/library",
	"/_board/inbox",
	"/",
]) {
	screenStory.it(`keeps absent values quiet at ${url}`, [routedScreen(sourceListsFixture(), url)], function* ({ routed }) {
		const view = routed();

		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("main h1")).not.toBeNull()));
		expect(view.container.textContent).not.toMatch(/not recorded/iu);
		expect(view.container.textContent).not.toContain("These are explicit source links");
		expect(view.container.textContent).not.toContain("Open/closed is source state");
		expect(view.container.textContent).not.toContain("Acceptance is not established");
	});
}

screenStory.it(
	"collapses repeated titles in backlinks and relationships, retaining each source in its most specific group",
	[routedScreen(sourceListsFixture(), "/task.md")],
	function* ({ routed }) {
		const view = routed();

		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector('[aria-label="Source backlinks"]')).not.toBeNull()));
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
	},
);

for (const status of ["done", "completed", "deferred"]) {
	screenStory.it(`hides open managed asks from cards and Inbox for ${status} work`, [], function* ({ renderRouter }) {
		const files = { ...answerCardFixture, "guide.md": answerCardFixture["guide.md"].replace("status: blocked", `status: ${status}`) };
		for (const url of ["/guide.md", `/${decisionFile}`, "/_board/inbox", "/"]) {
			const view = yield* Effect.promise(() => renderRouter(files, url));

			yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("main h1")).not.toBeNull()));
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
		}
	});
}

screenStory.it(
	"omits the answer card when an authored question is closed",
	[routedScreen({ "question.md": "---\nid: question.finished\nkind: question\nstatus: closed\n---\n# Previous question" }, "/question.md")],
	function* ({ routed }) {
		const view = routed();

		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("main h1")?.textContent).toBe("Previous question")));
		expect(view.container.querySelector(".answer-cards")).toBeNull();
	},
);

import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { answerCardFixture, decisionFile } from "#test/answerCardFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { sourceListsFixture } from "#test/sourceListsFixture.ts";

expectNoReactWarnings();

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
	screenStory.it(`keeps absent values quiet at ${url}`, [routedScreen(sourceListsFixture(), url)], function* ({ findElement, readText }) {
		yield* eventually(() => expect(findElement("main h1")).not.toBeNull());
		expect(readText()).not.toMatch(/not recorded/iu);
		expect(readText()).not.toContain("These are explicit source links");
		expect(readText()).not.toContain("Open/closed is source state");
		expect(readText()).not.toContain("Acceptance is not established");
	});
}

screenStory.it(
	"collapses repeated titles in backlinks and relationships, retaining each source in its most specific group",
	[routedScreen(sourceListsFixture(), "/task.md")],
	function* ({ openDetails, findElement, readText, findElements }) {
		yield* eventually(() => expect(findElement('[data-context-group="linked-from"]')).not.toBeNull());
		const backlinks = findElement('[data-context-group="linked-from"]');
		expect(readText("h3", backlinks)).toBe("Linked from");
		expect(findElement('[data-source-group="Related to"]', backlinks)).toBeNull();
		for (const section of [backlinks, findElement('[data-context-group="links-to"]')]) {
			const group = [...(findElements("details", section) ?? [])].find((entry) => readText("summary", entry) === "Fleet decisions (4)");
			expect(group).toHaveProperty("open", false);
			expect(findElements("a", group)).toHaveLength(0);
			openDetails(group);
			expect(
				findElements("a", group)
					.map((link) => link.getAttribute("href"))
					.sort(),
			).toEqual(Array.from({ length: 4 }, (_, index) => `/_board/item/decision.guide.${index}/`));
		}
		expect(
			findElements("a", backlinks)
				.map((link) => link.getAttribute("href"))
				.sort(),
		).toEqual(Array.from({ length: 4 }, (_, index) => `/_board/item/decision.guide.${index}/`));
		expect(readText()).not.toMatch(/not recorded/iu);
	},
);

for (const status of ["done", "done", "deferred"]) {
	const files = { ...answerCardFixture, "guide.md": answerCardFixture["guide.md"].replace("status: ready", `status: ${status}`) };
	for (const url of ["/guide.md", `/${decisionFile}`, "/_board/inbox", "/"]) {
		screenStory.it(
			`hides open managed asks from cards and Inbox for ${status} work at ${url}`,
			[routedScreen(files, url)],
			function* ({ findElement, readDefaultText }) {
				yield* eventually(() => expect(findElement("main h1")).not.toBeNull());
				expect(findElement(".answer-cards")).toBeNull();
				expect(findElement("#response-form")).toBeNull();
				if (!url.includes(decisionFile)) {
					expect(readDefaultText("main")).not.toContain("Which publishing path should we take?");
				}
			},
		);
	}
}

screenStory.it(
	"omits the answer card when an authored question is closed",
	[
		routedScreen(
			{ "question.md": "---\nid: question.finished\nkind: question\nscope: task\nurgency: whenever\nstatus: done\n---\n# Previous question" },
			"/question.md",
		),
	],
	function* ({ readText, findElement }) {
		yield* eventually(() => expect(readText("main h1")).toBe("Previous question"));
		expect(findElement(".answer-cards")).toBeNull();
	},
);

import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/react/client/testing.ts";
import { criteriaTask, mergedTask, pullRequestFleet } from "#test/readingAidsFixture.ts";
import { screenHeaderLayout } from "#test/screenHeaderLayout.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen, routedScreen } from "#test/screenTraits.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { ItemSummary } from "./ItemSummary.tsx";

expectNoReactWarnings();

const REPORT = `---
id: report.long
kind: report
---
# Long report

Opening summary.

## Findings

Body.

### First finding

Body.

## Next steps

Body.
`;

screenStory.it(
	"keeps the report outline beside the text and behind an outline button near the top",
	[routedScreen({ "home.md": "# Home", "report.md": REPORT }, "/report.md")],
	function* ({ click, findElement, findElements }) {
		yield* eventually(() => expect(findElement(".document-outline")).not.toBeNull());
		const outline = findElement(".document-outline");
		expect(outline?.closest("details")).toBeNull();
		expect(outline?.closest('[role="tabpanel"]')).toBeNull();
		expect(outline?.closest(".item-context")).not.toBeNull();
		expect([...findElements(".document-outline a")].map((link) => link.getAttribute("href"))).toEqual([
			"#heading-long-report",
			"#heading-findings",
			"#heading-first-finding",
			"#heading-next-steps",
		]);
		const menu = findElement("[data-page-actions] [data-outline-menu]");
		expect(menu?.textContent).toBe("On this page");
		click(menu);
		yield* eventually(() => expect(findElement('[data-slot="popover-content"] a[href="#heading-next-steps"]', document)).not.toBeNull());
		click(findElement('[data-slot="popover-content"] a[href="#heading-next-steps"]', document));
		yield* eventually(() => expect(findElement('[data-slot="popover-content"]', document)).toBeNull());
	},
);

screenStory.it(
	"offers no outline for a document without sections",
	[routedScreen({ "home.md": "# Home", "note.md": "---\nid: note.short\nkind: report\n---\n# Short note\n\nOne paragraph.\n" }, "/note.md")],
	function* ({ findElement }) {
		yield* eventually(() => expect(findElement(".item-context")).not.toBeNull());
		expect(findElement(".document-outline")).toBeNull();
		expect(findElement("[data-outline-menu]")).toBeNull();
	},
);

screenStory.it(
	"shrinks the pinned item header to its title while the reader scrolls, without moving the text below",
	[screenHeaderLayout(145, 53), routedScreen({ "home.md": "# Home", "report.md": REPORT }, "/report.md")],
	function* ({ findElement, scrollDocument, readHeaderFootprints, readScrollPosition }) {
		yield* eventually(() => expect(findElement("[data-page-header] [data-page-summary]")).not.toBeNull());
		expect(findElement("[data-page-header]")?.hasAttribute("data-compact")).toBe(false);
		const furtherScroll = 400;
		scrollDocument(furtherScroll);
		expect(readScrollPosition()).toBe(furtherScroll);
		expect(findElement("[data-page-header]")?.hasAttribute("data-compact")).toBe(true);
		expect(findElement("[data-page-header] h1")?.textContent).toContain("Long report");
		expect(new Set(readHeaderFootprints())).toEqual(new Set([145]));
		scrollDocument(0);
		expect(readScrollPosition()).toBe(0);
		expect(findElement("[data-page-header]")?.hasAttribute("data-compact")).toBe(false);
		expect(new Set(readHeaderFootprints())).toEqual(new Set([145]));
	},
);

screenStory.it(
	"keeps the header of an unidentified note in place while the reader scrolls",
	[routedScreen({ "home.md": "# Home", "note.md": "# Plain note\n\n## Section\n\nBody.\n" }, "/note.md")],
	function* ({ findElement, scrollDocument }) {
		yield* eventually(() => expect(findElement("[data-page-header]")).not.toBeNull());
		const furtherScroll = 400;
		scrollDocument(furtherScroll);
		expect(findElement("[data-page-header]")?.hasAttribute("data-compact")).toBe(false);
	},
);

screenStory.it(
	"keeps a header written in the document body inside the text",
	[routedScreen({ "home.md": "# Home", "note.md": "# Signed note\n\n## Sign-off\n\n<header>Reviewed by the team</header>\n" }, "/note.md")],
	function* ({ findElement, findElements }) {
		yield* eventually(() => expect(findElement("article.doc header")).not.toBeNull());
		expect(findElement("article.doc header")?.textContent).toBe("Reviewed by the team");
		expect(findElement("article.doc header")?.hasAttribute("data-page-header")).toBe(false);
		expect([...findElements("[data-page-header]")].map((header) => header.querySelector("h1")?.id)).toEqual(["heading-signed-note"]);
	},
);

screenStory.it(
	"renders inline Markdown in criteria and keeps a short list in the details panel",
	[routedScreen({ "home.md": "# Home", "task.md": criteriaTask(["Run `pnpm lint` and **pass**", "See [the guide](guide.md)"]) }, "/task.md")],
	function* ({ findElement, readText }) {
		yield* eventually(() => expect(findElement("#criterion-c1")).not.toBeNull());
		expect(findElement("#criterion-c1")?.closest(".item-context")).not.toBeNull();
		expect(readText("#criterion-c1")).toBe("c1: Run pnpm lint and pass");
		expect(findElement("#criterion-c1 code:not(:first-child)")?.textContent).toBe("pnpm lint");
		expect(findElement("#criterion-c1 strong")?.textContent).toBe("pass");
		expect(findElement('#criterion-c2 a[href="/guide.md"]')?.textContent).toBe("the guide");
		expect(findElement("article.doc .document-criteria")).toBeNull();
	},
);

screenStory.it(
	"moves a long criteria list into the main column after the body",
	[routedScreen({ "home.md": "# Home", "task.md": criteriaTask(["One", "Two", "Three", "Four with `code`"]) }, "/task.md")],
	function* ({ findElement, findElements, readText }) {
		yield* eventually(() => expect(findElement("article.doc .document-criteria")).not.toBeNull());
		const section = findElement("article.doc .document-criteria");
		expect(section?.previousElementSibling?.textContent).toBe("Body.");
		expect(readText("h2", section)).toBe("Criteria and recorded evidence");
		expect([...findElements("li[id^='criterion-']", section)].map((item) => item.id)).toEqual([
			"criterion-c1",
			"criterion-c2",
			"criterion-c3",
			"criterion-c4",
		]);
		expect(findElement("#criterion-c4 code:not(:first-child)")?.textContent).toBe("code");
		expect(findElement(".item-context [id^='criterion-']")).toBeNull();
		expect(findElement('.document-outline a[href="#criteria"]')?.textContent).toBe("Criteria and recorded evidence");
	},
);

screenStory.it(
	"links pull request numbers in the next action to the repository Fleet works in",
	[
		componentScreen(
			<FleetItemsContext.Provider value={pullRequestFleet("https://github.com/example/project/pull/1")}>
				<ItemSummary document={mergedTask} />
			</FleetItemsContext.Provider>,
		),
	],
	({ findElements, readText }) => {
		expect(readText(".item-summary p")).toBe("Owner: marvin · Next action: Done; PR #764 merged after PR 12.");
		expect([...findElements(".item-summary p a")].map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
			["PR #764", "https://github.com/example/project/pull/764"],
			["PR 12", "https://github.com/example/project/pull/12"],
		]);
	},
);

for (const [name, value] of [
	["Fleet is unavailable", { reason: "Not configured", state: "unavailable" } as const],
	["Fleet works in two repositories", pullRequestFleet("https://github.com/example/project/pull/1", "https://github.com/example/other/pull/2")],
] as const) {
	screenStory.it(
		`keeps pull request numbers as text when ${name}`,
		[
			componentScreen(
				<FleetItemsContext.Provider value={value}>
					<ItemSummary document={mergedTask} />
				</FleetItemsContext.Provider>,
			),
		],
		({ findElement, readText }) => {
			expect(readText(".item-summary p")).toBe("Owner: marvin · Next action: Done; PR #764 merged after PR 12.");
			expect(findElement(".item-summary p a")).toBeNull();
		},
	);
}

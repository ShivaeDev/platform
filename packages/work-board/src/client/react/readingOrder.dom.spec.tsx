import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { goalPageFixture } from "#test/goalPageFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const goal = { ...goalPageFixture(), "home.md": "# Home" };
const LANDMARKS: ReadonlySet<string> = new Set(["complementary", "navigation", "region"]);
const LINKED_WORK = '[data-goal-section="work"] [data-goal-item]';

screenStory.it(
	"reads and tabs through a goal's content before its context",
	[routedScreen(goal, "/goal.md")],
	function* ({ findElement, findElements, readAttribute, readTabStops }) {
		yield* Effect.promise(() => eventually(() => expect(findElement(LINKED_WORK)).not.toBeNull()));
		yield* Effect.promise(() => eventually(() => expect(readAttribute("#doc", "data-route")).toBe("/goal.md")));
		const article = findElement("#doc article.doc");
		const context = findElement("#doc .item-context");
		expect(article && context && article.compareDocumentPosition(context)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		const stops = readTabStops("#doc");
		const lastContent = stops.findLastIndex((stop) => stop.closest("article.doc") !== null);
		const firstContext = stops.findIndex((stop) => stop.closest(".item-context") !== null);
		expect(findElements<HTMLElement>(`#doc article.doc ${LINKED_WORK} a`).every((link) => stops.includes(link))).toBe(true);
		expect(lastContent).toBeGreaterThan(-1);
		expect(firstContext).toBeGreaterThan(lastContent);
	},
);

screenStory.it(
	"names only the goal's main sections and its context as landmarks",
	[routedScreen(goal, "/goal.md")],
	function* ({ findElement, findElements, roles }) {
		yield* Effect.promise(() => eventually(() => expect(findElement(LINKED_WORK)).not.toBeNull()));
		yield* Effect.promise(() => eventually(() => expect(findElement('#doc .item-context [data-context-group="linked-from"]')).not.toBeNull()));
		const landmarks = findElements("#doc :is(section, aside, nav, [role])")
			.filter((element) => element.closest(".item-introduction, .answer-cards") === null)
			.map((element) => roles.accessible(element))
			.filter(({ name, role }) => name !== "" && role !== null && LANDMARKS.has(role));
		expect(landmarks).toEqual([
			{ name: "Progress", role: "region" },
			{ name: "Criteria and recorded evidence", role: "region" },
			{ name: "Linked work", role: "region" },
			{ name: "Item context", role: "complementary" },
			{ name: "Document outline", role: "navigation" },
		]);
		expect(findElements("#doc .item-context [data-source-group] > :is(h4, ul)").length).toBeGreaterThan(0);
	},
);

screenStory.it(
	"links the outline to stable goal section anchors and lands a shared link on Linked work",
	[routedScreen(goal, "/goal.md#linked-work")],
	function* ({ findElements, readFocus, readText }) {
		yield* Effect.promise(() => eventually(() => expect(readFocus()?.id).toBe("linked-work")));
		expect(readText("#navigation-status")).not.toContain("no longer in the document");
		expect(findElements(".document-outline a").map((link) => link.getAttribute("href"))).toEqual(
			expect.arrayContaining(["#progress", "#criteria", "#linked-work"]),
		);
	},
);

screenStory.it(
	"returns focus to the link that opened a page when the reader goes back",
	[
		routedScreen(
			{ "home.md": "# Home", "notes/first.md": "# First\n\n[Earlier](earlier.md) and [Next](next.md)\n", "notes/next.md": "# Next\n" },
			"/notes/first.md",
		),
	],
	function* ({ back, click, findElement, findElements, focus, readFocus, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement<HTMLElement>("#doc")?.dataset.route).toBe("/notes/first.md")));
		const next = findElements<HTMLAnchorElement>("#doc article.doc a").find((link) => link.textContent === "Next");
		focus(next);
		click(next);
		yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe("Next")));
		yield* Effect.promise(back);
		yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe("First")));
		yield* Effect.promise(() => eventually(() => expect(readFocus()?.textContent).toBe("Next")));
		expect(readFocus()?.closest("article.doc")).not.toBeNull();
	},
);

screenStory.it(
	"shows no context card for a plain document and keeps an empty Details panel out of the Tab order",
	[
		routedScreen(
			{
				"home.md": "# Home",
				"notes/plain.md": "# Plain\n\n## Section\n\nText.\n",
				"notes/record.md": "---\nid: report.record\nkind: report\n---\n# Record\n",
			},
			"/notes/plain.md",
		),
	],
	function* ({ findElement, navigate, readAttribute, readTabStops }) {
		yield* Effect.promise(() => eventually(() => expect(readAttribute("#doc", "data-route")).toBe("/notes/plain.md")));
		expect(findElement("#doc .item-context")).not.toBeNull();
		expect(findElement('#doc .item-context [role="tablist"]')).toBeNull();
		yield* Effect.promise(() => navigate("/notes/record.md"));
		yield* Effect.promise(() => eventually(() => expect(readAttribute("#doc", "data-route")).toBe("/notes/record.md")));
		expect(findElement('#doc .item-context [role="tab"][aria-selected="true"]')?.textContent).toBe("Details");
		expect(readTabStops("#doc .item-context").filter((stop) => stop.getAttribute("role") === "tabpanel")).toEqual([]);
	},
);

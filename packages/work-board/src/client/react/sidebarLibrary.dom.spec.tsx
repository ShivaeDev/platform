import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { goalsFixture } from "#test/goalsFixture.ts";
import { inboxFixture } from "#test/inboxFixture.ts";
import { screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";
import { storedScreenState } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();
const files = Object.fromEntries(Array.from({ length: 1490 }, (_, index) => [`notes/slug-${index}.md`, `# Document title ${index}\n`]));
const saved = Array.from({ length: 10 }, (_, index) => ({ file: `notes/slug-${index}.md`, title: `Document title ${index}` }));
screenStory.it(
	"bounds document shell links with 1,500 files and shows titled pinned, goal and recent sections",
	[
		screenWorkspace("library-fixture"),
		storedScreenState({ "work-board:library:library-fixture": JSON.stringify({ favorites: saved.slice(0, 2), recents: saved }) }),
		chromeScreen({ ...files, ...goalsFixture() }, "/notes/slug-0.md"),
	],
	function* ({ click, findElements, findElement, readText, readAttribute, readNavigation }) {
		expect([...findElements("#primary-navigation a > span:first-child")].map((node) => node.textContent)).toEqual([
			"Today",
			"Goals",
			"Now",
			"Library",
			"System",
		]);
		for (const name of ["Pinned", "Active goals", "Recent"]) {
			expect(findElement(`section[aria-label="${name}"]`)).not.toBeNull();
		}
		expect(findElements('section[aria-label="Recent"] a')).toHaveLength(5);
		expect(readText('section[aria-label="Pinned"] a')).toBe("Document title 0");
		yield* Effect.promise(() =>
			eventually(() =>
				expect(readAttribute('section[aria-label="Active goals"] [role="img"][aria-label^="Example goal"]', "aria-label")).toBe(
					"Example goal: 2 of 5 done",
				),
			),
		);
		expect(readText('section[aria-label="Active goals"]')).toContain("2/5");
		expect(findElements('section[aria-label="Active goals"] [data-status-token]')).toHaveLength(0);
		for (const id of ["#documents-open", "#diagnostics-open", "#goals-open"]) {
			expect(readText(id)).not.toMatch(/[0-9?]/u);
		}
		expect(findElement("#files")).toBeNull();
		expect(findElements("a").length).toBeLessThan(100);
		const navigation = yield* Effect.promise(readNavigation);
		expect(navigation.counts.library).toBe(1500);
		expect(navigation).not.toHaveProperty("tree");
		expect(navigation).not.toHaveProperty("records");
		click("#work-open");
		yield* Effect.promise(() => eventually(() => expect(readText(".work-head h1")).toBe("Now")));
	},
);
screenStory.it(
	"browses titles, filters kinds and statuses, hides records and requests folders only as expanded",
	[
		screenWorkspace("library-fixture"),
		chromeScreen(
			{ ...inboxFixture(), "notes/deep/other.md": "# Nested title\n", "notes/slug.md": "---\nkind: task\nstatus: active\n---\n# A readable title\n" },
			"/notes/slug.md",
		),
	],
	function* ({ openDetails, click, choose, navigate, readText, findElement, findElements }) {
		yield* Effect.promise(() => navigate("/_board/library"));
		yield* Effect.promise(() => eventually(() => expect(readText('#doc a[href="/notes/slug.md"]')).toBe("A readable title")));
		expect(findElement('#doc a[href="/responses/decision.md"]')).toBeNull();
		expect(readText("#doc")).toContain("Show Fleet records (1)");
		choose("#doc label:has(select) select", "task");
		yield* Effect.promise(() => eventually(() => expect(findElement('#doc a[href="/question.md"]')).toBeNull()));
		const selects = findElements<HTMLSelectElement>("#doc select");
		choose(selects[1], "active");
		yield* Effect.promise(() => eventually(() => expect(findElements("#doc li a")).toHaveLength(1)));
		choose(selects[0], "");
		choose(selects[1], "");
		click('#doc input[type="checkbox"]');
		yield* Effect.promise(() => eventually(() => expect(readText('#doc a[href="/responses/decision.md"]')).toBe("Fleet delivery decision")));
		choose(selects[2], "folders");
		yield* Effect.promise(() => eventually(() => expect(readText("#doc summary")).toContain("notes")));
		expect(findElement('#doc a[href="/notes/slug.md"]')).toBeNull();
		openDetails("#doc details");
		yield* Effect.promise(() => eventually(() => expect(readText('#doc a[href="/notes/slug.md"]')).toBe("A readable title")));
		expect(findElement('#doc a[href="/notes/deep/other.md"]')).toBeNull();
	},
);

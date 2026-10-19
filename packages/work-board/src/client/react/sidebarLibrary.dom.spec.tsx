import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
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
				expect(readAttribute('section[aria-label="Active goals"] [role="progressbar"][aria-label^="Example goal"]', "aria-label")).toBe(
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
	"leaves Active goals out of the sidebar while Today lists them in its main column",
	[chromeScreen(goalsFixture(), "/")],
	function* ({ click, findElement, readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText("#doc")).toContain("Example goal")));
		expect(findElement('section[aria-label="Active goals"]')).toBeNull();
		expect(findElement('section[aria-label="Pinned"]')).not.toBeNull();
		click("#goals-open");
		yield* Effect.promise(() => eventually(() => expect(readText('section[aria-label="Active goals"]')).toContain("Example goal")));
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
	function* ({ openDetails, click, chooseOption, navigate, readText, findElement, findElements }) {
		yield* Effect.promise(() => navigate("/_board/library"));
		yield* Effect.promise(() => eventually(() => expect(readText('#doc a[href="/notes/slug.md"]')).toBe("A readable title")));
		expect(findElement('#doc a[href="/responses/decision.md"]')).toBeNull();
		expect(readText("#doc")).toContain("Include files Fleet writes (1)");
		const [kind, status] = findElements('#doc [role="combobox"]');
		yield* Effect.promise(() => chooseOption(kind, "Task"));
		yield* Effect.promise(() => eventually(() => expect(findElement('#doc a[href="/question.md"]')).toBeNull()));
		yield* Effect.promise(() => chooseOption(status, "Active"));
		yield* Effect.promise(() => eventually(() => expect(findElements("#doc li a")).toHaveLength(1)));
		yield* Effect.promise(() => chooseOption(kind, "All"));
		yield* Effect.promise(() => chooseOption(status, "All"));
		yield* Effect.promise(() => eventually(() => expect(findElement('#doc a[href="/question.md"]')).not.toBeNull()));
		click('#doc [role="checkbox"]');
		yield* Effect.promise(() => eventually(() => expect(readText('#doc a[href="/responses/decision.md"]')).toBe("Fleet delivery decision")));
		click([...findElements('#doc [role="group"] button')].find((button) => button.textContent === "By folder"));
		yield* Effect.promise(() => eventually(() => expect(readText("#doc summary")).toContain("notes")));
		expect(findElement('#doc a[href="/notes/slug.md"]')).toBeNull();
		openDetails("#doc details");
		yield* Effect.promise(() => eventually(() => expect(readText('#doc a[href="/notes/slug.md"]')).toBe("A readable title")));
		expect(findElement('#doc a[href="/notes/deep/other.md"]')).toBeNull();
	},
);

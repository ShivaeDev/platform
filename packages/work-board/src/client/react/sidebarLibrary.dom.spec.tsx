import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/react/client/testing.ts";
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
			"Pull requests",
			"Library",
			"System",
		]);
		for (const name of ["Pinned", "Active goals", "Recent"]) {
			expect(findElement(`section[aria-label="${name}"]`)).not.toBeNull();
		}
		expect(findElements('section[aria-label="Recent"] a').map((link) => link.textContent)).toEqual(saved.slice(2, 7).map((entry) => entry.title));
		expect(readText('section[aria-label="Pinned"] a')).toBe("Document title 0");
		yield* eventually(() =>
			expect(readAttribute('section[aria-label="Active goals"] [role="progressbar"][aria-label^="Example goal"]', "aria-label")).toBe(
				"Example goal: 2 of 5 done",
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
		expect(navigation.counts.library).toBe(Object.keys(files).length + Object.keys(goalsFixture()).length);
		expect(navigation).not.toHaveProperty("tree");
		expect(navigation).not.toHaveProperty("records");
		click("#work-open");
		yield* eventually(() => expect(readText(".work-head h1")).toBe("Now"));
	},
);
screenStory.it(
	"leaves Ready goals out of the sidebar while Today lists them in its main column",
	[chromeScreen(goalsFixture(), "/")],
	function* ({ click, findElement, readText }) {
		yield* eventually(() => expect(readText("#doc")).toContain("Example goal"));
		expect(findElement('section[aria-label="Active goals"]')).toBeNull();
		expect(findElement('section[aria-label="Pinned"]')).not.toBeNull();
		click("#goals-open");
		yield* eventually(() => expect(readText('section[aria-label="Active goals"]')).toContain("Example goal"));
	},
);
screenStory.it(
	"browses titles, filters kinds and statuses, hides records and requests folders only as expanded",
	[
		screenWorkspace("library-fixture"),
		chromeScreen(
			{ ...inboxFixture(), "notes/deep/other.md": "# Nested title\n", "notes/slug.md": "---\nkind: task\nstatus: ready\n---\n# A readable title\n" },
			"/notes/slug.md",
		),
	],
	function* ({ openDetails, navigate, readText, findElement, findElements, roles }) {
		yield* Effect.promise(() => navigate("/_board/library"));
		yield* eventually(() => expect(readText('#doc a[href="/notes/slug.md"]')).toBe("A readable title"));
		expect(findElement('#doc a[href="/responses/decision.md"]')).toBeNull();
		expect(readText("#doc")).toContain("Include files Fleet writes (1)");
		yield* roles.click({ name: "Kind", role: "combobox" });
		yield* roles.click({ name: "Task", role: "option" });
		yield* eventually(() => expect(findElement('#doc a[href="/question.md"]')).toBeNull());
		yield* roles.click({ name: "Status", role: "combobox" });
		yield* roles.click({ name: "Ready", role: "option" });
		yield* eventually(() =>
			expect(
				findElements("#doc li a")
					.map((link) => link.getAttribute("href"))
					.sort(),
			).toEqual(["/fleet.md", "/notes/slug.md"]),
		);
		yield* roles.click({ name: "Reset", role: "link" });
		yield* eventually(() => expect(findElement('#doc a[href="/question.md"]')).not.toBeNull());
		yield* roles.click({ name: "Include files Fleet writes (1)", role: "checkbox" });
		yield* eventually(() => expect(readText('#doc a[href="/responses/decision.md"]')).toBe("Fleet decision: Deployment is blocked"));
		yield* roles.click({ name: "By folder", role: "button" });
		yield* eventually(() => expect(readText("#doc summary")).toContain("notes"));
		expect(findElement('#doc a[href="/notes/slug.md"]')).toBeNull();
		openDetails("#doc details");
		yield* eventually(() => expect(readText('#doc a[href="/notes/slug.md"]')).toBe("A readable title"));
		expect(findElement('#doc a[href="/notes/deep/other.md"]')).toBeNull();
	},
);

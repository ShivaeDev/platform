import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { chromeFixture } from "#test/chromeFixture.ts";
import { screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
{
	const files = chromeFixture();
	screenStory.it(
		"searches native query results, chooses a passage, refreshes and searches again after reload",
		[screenWorkspace("reading-fixture"), chromeScreen(files)],
		function* ({ chrome, click, input, control, keyboard, refreshQuery, editFile, closeScreen, location, findElement }) {
			click("#search-open");
			input('#search-dialog [role="combobox"]', "Second phrase");
			yield* Effect.promise(() =>
				eventually(() =>
					expect(control('#search-dialog [role="option"] a', HTMLAnchorElement).getAttribute("href")).toBe("/notes/deep/proof.md"),
				),
			);
			editFile("notes/deep/proof.md", "# Proof\n\nSecond phrase changed.\n");
			yield* Effect.promise(() => refreshQuery("search", { query: "Second phrase" }));
			yield* Effect.promise(() =>
				eventually(() => expect(control('#search-dialog [role="option"] p', HTMLElement).textContent).toBe("Second phrase changed.")),
			);
			keyboard("Enter", {}, control('#search-dialog [role="combobox"]', HTMLInputElement));
			yield* Effect.promise(() => eventually(() => expect(location()?.pathname).toBe("/notes/deep/proof.md")));
			yield* Effect.promise(() => eventually(() => expect(findElement("#search-dialog", document)).toBeNull()));
			yield* Effect.promise(() => closeScreen());
			yield* Effect.promise(() => chrome());
			click("#search-open");
			input('#search-dialog [role="combobox"]', "Second phrase");
			yield* Effect.promise(() =>
				eventually(() => expect(control('#search-dialog [role="option"] p', HTMLElement).textContent).toBe("Second phrase changed.")),
			);
		},
	);
}
{
	const files = chromeFixture();
	screenStory.it(
		"saves appearance and sidebar choices through a document refresh and reload",
		[screenWorkspace("reading-fixture"), chromeScreen(files)],
		function* ({ chrome, click, choose, control, refreshDocument, editFile, readRootAttribute, closeScreen }) {
			click("#settings-open");
			choose("#theme", "dark");
			choose("#density", "compact");
			click("#sidebar-toggle");
			editFile("notes/plan.md", `${files["notes/plan.md"]}\nRefreshed source.\n`);
			yield* Effect.promise(() => refreshDocument("/notes/plan.md"));
			yield* Effect.promise(() => eventually(() => expect(control("#doc", HTMLElement).textContent).toContain("Refreshed source.")));
			expect(readRootAttribute("data-scheme")).toBe("dark");
			expect(control("#sidebar", HTMLElement).hidden).toBe(true);
			yield* Effect.promise(() => closeScreen());
			yield* Effect.promise(() => chrome());
			click("#settings-open");
			expect(control("#theme", HTMLSelectElement).value).toBe("dark");
			expect(control("#density", HTMLSelectElement).value).toBe("compact");
			expect(control("#sidebar-toggle", HTMLButtonElement).getAttribute("aria-expanded")).toBe("false");
		},
	);
}
{
	const files = chromeFixture();
	screenStory.it(
		"keeps favorites, recents and per-entry reading details through refresh, back and reload",
		[screenWorkspace("reading-fixture"), chromeScreen(files)],
		function* ({
			chrome,
			click,
			control,
			navigate,
			findElements,
			findElement,
			refreshDocument,
			back,
			browserEvent,
			editFile,
			openDetails,
			rememberHistory,
			closeScreen,
			location,
		}) {
			click("#favorite-toggle");
			openDetails("article details");
			editFile("notes/plan.md", `${files["notes/plan.md"]}\nMore evidence.\n`);
			yield* Effect.promise(() => refreshDocument("/notes/plan.md"));
			yield* Effect.promise(() => eventually(() => expect(control("#doc", HTMLElement).textContent).toContain("More evidence.")));
			expect(control("article details", HTMLDetailsElement).open).toBe(true);
			yield* Effect.promise(() => navigate("/notes/deep/proof.md"));
			yield* Effect.promise(() => eventually(() => expect(control("#doc h1", HTMLElement).textContent).toBe("Proof")));
			yield* Effect.promise(() => back());
			yield* Effect.promise(() => eventually(() => expect(control("#doc h1", HTMLElement).textContent).toBe("Plan")));
			expect(control("article details", HTMLDetailsElement).open).toBe(true);
			browserEvent("pagehide", "window");
			const state = location()?.state;
			yield* Effect.promise(() => closeScreen());
			rememberHistory({ workBoard: { id: state?.key } });
			yield* Effect.promise(() => chrome());
			yield* Effect.promise(() => eventually(() => expect(control("article details", HTMLDetailsElement).open).toBe(true)));
			expect(control("#favorite-toggle", HTMLButtonElement).getAttribute("aria-pressed")).toBe("true");
			click("#library-open");
			expect([...findElements("#reading-library h2")].map((heading) => heading.textContent)).toEqual(["Favorites", "Recent documents"]);
			expect(findElement('#reading-library a[href="/notes/deep/proof.md"]')).not.toBeNull();
		},
	);
}

import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { attentionFixture } from "#test/attentionFixture.ts";
import { paletteFixture } from "#test/paletteFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";
import { searchScreen } from "#test/searchScreen.tsx";

expectNoReactWarnings();
const QUERY = '#search-dialog [role="combobox"]';

screenStory.it(
	"offers go-to views and open goals, ranks a matching command first and shows work metadata",
	[searchScreen(paletteFixture())],
	function* ({ readRootAttribute, input, click, findElements, readText }) {
		function rows() {
			return findElements<HTMLElement>('#search-dialog [role="option"]', document);
		}

		yield* Effect.promise(() => eventually(() => expect(rows().map((row) => readText("strong", row))).toContain("Go to A calmer workspace")));
		for (const [title, href] of [
			["Go to Today", "/"],
			["Go to Goals", "/_board/goals"],
			["Go to Now", "/_board/work?view=board"],
			["Go to System", "/_board/system"],
			["Go to Library", "/_board/library"],
			["Go to A calmer workspace", "/_board/item/project.workspace/"],
		]) {
			expect(
				rows()
					.find((row) => readText("strong", row) === title)
					?.querySelector("a")
					?.getAttribute("href"),
			).toBe(href);
		}
		expect(readText("#search-dialog", document)).not.toContain("Go to Finished workspace");
		input(QUERY, "inbox");
		yield* Effect.promise(() => eventually(() => expect(readText("strong", rows()[0])).toBe("Build the inbox")));
		expect(readText("code", rows()[0])).toBe("task.triage");
		expect(readText("small", rows()[0])).toContain("task");
		expect(readText("[data-status-token]", rows()[0])).toBe("Ready");
		expect(readText("#search-dialog", document)).not.toContain("Inbox decision");
		input(QUERY, "records: inbox");
		yield* Effect.promise(() => eventually(() => expect(rows().some((row) => readText("strong", row) === "Inbox decision 9")).toBe(true)));
		expect(readText("strong", rows()[0])).toBe("Build the inbox");
		expect(
			rows()
				.map((row) => readText("code", row))
				.filter((id) => id?.startsWith("decision.delivery."))
				.sort(),
		).toEqual(Array.from({ length: 10 }, (_, index) => `decision.delivery.${index}`));
		expect(readText("#search-dialog", document)).not.toContain("Not recorded");
		for (const row of rows()) {
			expect(readText("p", row) ?? "").not.toMatch(/^(?:\{|---)|(?:id|kind|next_action):/u);
		}
		input(QUERY, "workspace");
		yield* Effect.promise(() => eventually(() => expect(readText("strong", rows()[0])).toBe("Go to A calmer workspace")));
		expect(
			rows()
				.map((row) => readText("strong", row))
				.filter((title) => title?.endsWith("A calmer workspace")),
		).toEqual(["Go to A calmer workspace"]);
		for (const query of ["project.workspace", "calmer"]) {
			input(QUERY, query);
			yield* Effect.promise(() => eventually(() => expect(readText("strong", rows()[0])).toBe("Go to A calmer workspace")));
			const destinations = rows().map((row) => row.querySelector("a")?.getAttribute("href"));
			expect(new Set(destinations).size).toBe(destinations.length);
			expect(destinations.filter((href) => href === "/_board/item/project.workspace/")).toEqual(["/_board/item/project.workspace/"]);
		}
		input(QUERY, "Library");
		yield* Effect.promise(() => eventually(() => expect(rows()[0]?.querySelector("a")?.getAttribute("href")).toBe("/_board/library")));
		input(QUERY, "theme");
		yield* Effect.promise(() => eventually(() => expect(rows()[0]?.dataset.command).toBe("theme")));
		const address = window.location.href;
		click(rows()[0]?.querySelector("a"));
		expect(readRootAttribute("data-theme")).toBe("dark");
		expect(window.location.href).toBe(address);
	},
);

const DUPLICATED = {
	"questions/scale-tests.md":
		"---\nid: question.scale-tests\nkind: question\nscope: task\nurgency: whenever\nstatus: ready\n---\n# Your pooling design for Fleet's scale tests\n\nFleet's scale tests wait for your pooling design.\n",
	"tasks/scale-tests.md":
		"---\nid: fleet.scale-tests\nkind: task\nstatus: draft\n---\n# Bring back Work Fleet's scale tests with sane connection use\n\nBring the scale tests back once connection pooling is designed.\n",
};
screenStory.it(
	"lists each item once when its title and opening passage both match",
	[searchScreen(DUPLICATED)],
	function* ({ input, findElements, readText }) {
		function titles() {
			return [...findElements<HTMLElement>('#search-dialog [role="option"] strong', document)].map((title) => title.textContent);
		}
		for (const query of ["scale tests", "pooling"]) {
			input(QUERY, query);
			yield* Effect.promise(() => eventually(() => expect(readText('#search-dialog [role="status"]', document)).toBe("2 matches.")));
			expect(titles()).toEqual(["Your pooling design for Fleet's scale tests", "Bring back Work Fleet's scale tests with sane connection use"]);
		}
	},
);

screenStory.it(
	"shows the matching passage instead of repeating a row's title as its snippet",
	[searchScreen({ ...DUPLICATED, "notes/connection-budget.md": "# Connection budget\n\nShared limits live elsewhere.\n" })],
	function* ({ input, findElements, readText }) {
		function snippets() {
			return Object.fromEntries(
				[...findElements<HTMLElement>('#search-dialog [role="option"]', document)].map((row) => [
					readText("strong", row),
					row.querySelector("p")?.textContent,
				]),
			);
		}
		input(QUERY, "pooling design");
		yield* Effect.promise(() => eventually(() => expect(readText('#search-dialog [role="status"]', document)).toBe("2 matches.")));
		expect(snippets()).toEqual({
			"Bring back Work Fleet's scale tests with sane connection use": "Bring the scale tests back once connection pooling is designed.",
			"Your pooling design for Fleet's scale tests": "Fleet's scale tests wait for your pooling design.",
		});
		input(QUERY, "connection budget");
		yield* Effect.promise(() => eventually(() => expect(readText('#search-dialog [role="status"]', document)).toBe("1 matches.")));
		expect(snippets()).toEqual({ "Connection budget": undefined });
	},
);

screenStory.it(
	"shows commands without a kind subtitle and keeps a goal's ID",
	[searchScreen(paletteFixture())],
	function* ({ findElements, readText }) {
		function rows() {
			return [...findElements<HTMLElement>('#search-dialog [role="option"]', document)];
		}
		yield* Effect.promise(() => eventually(() => expect(rows().map((row) => readText("strong", row))).toContain("Go to A calmer workspace")));
		const subtitles = Object.fromEntries(rows().map((row) => [readText("strong", row), row.querySelector("small")?.textContent ?? ""]));
		expect(subtitles).toEqual({
			"Go to A calmer workspace": "project.workspace",
			"Go to Goals": "",
			"Go to Library": "",
			"Go to Now": "",
			"Go to System": "",
			"Go to Today": "",
			"Show or hide sidebar": "",
			"Toggle compact density": "",
			"Toggle light or dark theme": "",
		});
	},
);

screenStory.it(
	"groups views, appearance, work and documents under headings",
	[searchScreen(paletteFixture())],
	function* ({ input, findElements, roles }) {
		function groups() {
			return [...findElements<HTMLElement>('#search-dialog [role="listbox"] [role="group"]', document)].map((group) => ({
				name: roles.accessible(group).name,
				titles: [...group.querySelectorAll('[role="option"] strong')].map((title) => title.textContent),
			}));
		}
		yield* Effect.promise(() => eventually(() => expect(groups().map((group) => group.name)).toEqual(["Go to", "Appearance"])));
		yield* Effect.promise(() => eventually(() => expect(groups()[0]?.titles).toContain("Go to A calmer workspace")));
		expect(groups()[1]?.titles).toEqual(["Show or hide sidebar", "Toggle compact density", "Toggle light or dark theme"]);
		input(QUERY, "inbox");
		yield* Effect.promise(() => eventually(() => expect(groups().map((group) => group.name)).toEqual(["Work", "Documents"])));
		expect(groups()[0]?.titles).toEqual(["Build the inbox"]);
		expect(groups()[1]?.titles).toEqual(["Notes"]);
	},
);

screenStory.it(
	"includes files Fleet writes while the toggle is on",
	[searchScreen(paletteFixture())],
	function* ({ input, findElements, findElement, keyboard, readAttribute, roles }) {
		const recordsToggle = { name: "Include files Fleet writes", role: "checkbox" } as const;
		function titles() {
			return [...findElements<HTMLElement>('#search-dialog [role="option"] strong', document)].map((title) => title.textContent);
		}
		input(QUERY, "inbox");
		yield* Effect.promise(() => eventually(() => expect(titles()).toContain("Build the inbox")));
		expect(titles()).not.toContain("Inbox decision 9");
		yield* roles.click(recordsToggle);
		expect(readAttribute('#search-dialog [role="checkbox"]', "aria-checked", document)).toBe("true");
		yield* Effect.promise(() => eventually(() => expect(titles()).toContain("Inbox decision 9")));
		expect(titles()[0]).toBe("Build the inbox");
		yield* roles.click(recordsToggle);
		yield* Effect.promise(() => eventually(() => expect(titles()).not.toContain("Inbox decision 9")));
		keyboard("Enter", { cancelable: true }, '#search-dialog [role="checkbox"]');
		expect(findElement("#search-dialog", document)).not.toBeNull();
	},
);

const toggled: Readonly<Record<string, (value: string | undefined) => string>> = {
	"data-density": (value) => (value === "compact" ? "comfortable" : "compact"),
	"data-sidebar": (value) => (value === "closed" ? "open" : "closed"),
	"data-theme": (value) => (value === "dark" ? "light" : "dark"),
};
screenStory.it(
	"applies each appearance command from the palette without leaving the page",
	[chromeScreen({ "notes/plan.md": "# Plan\n\nShared phrase.\n" })],
	function* ({ keyboard, input, location, readRootAttribute, findElement, readAttribute }) {
		for (const [query, attribute] of [
			["density", "data-density"],
			["density", "data-density"],
			["theme", "data-theme"],
			["theme", "data-theme"],
			["sidebar", "data-sidebar"],
			["sidebar", "data-sidebar"],
		] as const) {
			const expected = toggled[attribute]?.(readRootAttribute(attribute) ?? undefined);
			keyboard("k", { cancelable: true, ctrlKey: true }, document);
			yield* Effect.promise(() => eventually(() => expect(findElement("#search-dialog", document)).not.toBeNull()));
			input(QUERY, query);
			yield* Effect.promise(() =>
				eventually(() =>
					expect(readAttribute('#search-dialog [role="option"][aria-selected="true"]', "data-command", document)).toBe(
						attribute.slice(5) === "sidebar" ? "sidebar-toggle" : attribute.slice(5),
					),
				),
			);
			keyboard("Enter", { cancelable: true }, QUERY);
			yield* Effect.promise(() => eventually(() => expect(readRootAttribute(attribute)).toBe(expected)));
			yield* Effect.promise(() => eventually(() => expect(findElement("#search-dialog", document)).toBeNull()));
			expect(location()?.pathname).toBe("/notes/plan.md");
		}
	},
);

screenStory.it("marks the searched words in each snippet", [searchScreen(DUPLICATED)], function* ({ input, findElements, readText }) {
	input(QUERY, "Pooling design");
	yield* Effect.promise(() => eventually(() => expect(readText('#search-dialog [role="status"]', document)).toBe("2 matches.")));
	const marks = [...findElements<HTMLElement>('#search-dialog [role="option"]', document)].map((row) =>
		[...row.querySelectorAll("p mark")].map((mark) => mark.textContent),
	);
	expect(marks).toEqual([
		["pooling", "design"],
		["pooling", "design"],
	]);
});

screenStory.it(
	"tells the reader how to narrow a result list that was cut short",
	[searchScreen(Object.fromEntries(Array.from({ length: 45 }, (_, index) => [`notes/${index}.md`, `# Note ${index}\n\nA shared needle.\n`])))],
	function* ({ input, readText }) {
		input(QUERY, "needle");
		yield* Effect.promise(() =>
			eventually(() =>
				expect(readText('#search-dialog [role="status"]', document)).toBe("Showing 40 of 45 matches. Add words or an ID to narrow the list."),
			),
		);
	},
);

screenStory.it(
	"lists what needs you first in the empty palette and opens it with Enter",
	[chromeScreen(attentionFixture())],
	function* ({ input, keyboard, findElement, findElements, location, readAttribute, roles }) {
		function groups() {
			return [...findElements<HTMLElement>('#search-dialog [role="listbox"] [role="group"]', document)].map((group) => ({
				name: roles.accessible(group).name,
				titles: [...group.querySelectorAll('[role="option"] strong')].map((title) => title.textContent),
			}));
		}
		keyboard("k", { cancelable: true, ctrlKey: true }, document);
		yield* Effect.promise(() => eventually(() => expect(groups()[0]?.name).toBe("Needs you")));
		expect(groups()[0]?.titles).toEqual(["Deterministic search", "Arbitrary source labels", "Search the workspace"]);
		expect(groups()[1]?.name).toBe("Go to");
		input(QUERY, "keyboard");
		yield* Effect.promise(() => eventually(() => expect(groups().map((group) => group.name)).not.toContain("Needs you")));
		input(QUERY, "");
		yield* Effect.promise(() => eventually(() => expect(groups()[0]?.name).toBe("Needs you")));
		const href = readAttribute('#search-dialog [role="option"][aria-selected="true"] a', "href", document);
		expect(href).toBe(findElement('#search-dialog [role="group"] [role="option"] a', document)?.getAttribute("href"));
		keyboard("Enter", { cancelable: true }, QUERY);
		yield* Effect.promise(() => eventually(() => expect(findElement("#search-dialog", document)).toBeNull()));
		expect(`${location()?.pathname}${location()?.hash ? `#${location()?.hash}` : ""}`).toBe(href);
	},
);

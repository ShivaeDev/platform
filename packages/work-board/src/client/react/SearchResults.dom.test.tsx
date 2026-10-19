import { Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { searchResultContent, searchResultScreen } from "#test/searchResultScreen.tsx";
import type { SearchItem } from "./searchCommands.ts";

expectNoReactWarnings();

function passage(snippet: string, line: number): SearchItem {
	return { file: "notes.md", href: "/notes.md#heading-shared", kind: "passage", line, snippet, title: "Shared" };
}
const alpha = passage("Alpha evidence", 3);
const beta = passage("Beta evidence", 5);
const gamma = passage("Gamma evidence", 7);
const other: SearchItem = { href: "/other.md", kind: "document", snippet: "Other evidence", title: "Other" };
screenStory.it(
	"removes and reorders passages sharing a heading URL without retaining rows",
	[searchResultScreen([alpha, beta, beta, gamma, other])],
	function* ({ findElements, readText, refreshScreen }) {
		function rows() {
			return [...findElements<HTMLElement>('[role="option"]')];
		}
		function expectRows(items: readonly SearchItem[]) {
			expect(rows().map((row) => readText("p", row))).toEqual(items.map((item) => item.snippet));
			expect(rows().map((row) => row.querySelector("a")?.getAttribute("href"))).toEqual(items.map((item) => item.href));
		}

		expectRows([alpha, beta, beta, gamma, other]);
		yield* Effect.promise(() => refreshScreen(searchResultContent([other, gamma, alpha])));
		expectRows([other, gamma, alpha]);
		yield* Effect.promise(() => refreshScreen(searchResultContent([alpha, other, gamma])));
		expectRows([alpha, other, gamma]);
	},
);

screenStory.it(
	"names a plain document's file and its line when the line is known",
	[
		searchResultScreen([
			{ file: "notes.md", href: "/notes.md#heading-shared", kind: "passage", line: 3, title: "Shared" },
			{ file: "other.md", href: "/other.md", kind: "document", title: "Other" },
		]),
	],
	function* ({ findElements, readText }) {
		expect([...findElements<HTMLElement>('[role="option"]')].map((row) => readText("small", row))).toEqual([
			"Passage · notes.md:3",
			"Document · other.md",
		]);
	},
);

const grouped: readonly SearchItem[] = [
	{ href: "/_board/item/task.one/", itemKind: "task", kind: "document", match: "text", title: "Mentions it" },
	{ href: "/plan.md", kind: "document", match: "title", title: "Named in the title" },
	{ href: "/_board/item/project.one/", itemKind: "project", kind: "document", match: "title", title: "Goal named in the title" },
	{ href: "/_board/item/task.two/", itemKind: "task", kind: "document", match: "prefix", title: "Starts with it" },
	{ href: "/needs.md", kind: "needs-you", title: "Waiting on you" },
];
screenStory.it(
	"orders groups by their best match while searching and keeps the fixed order for an empty query",
	[searchResultScreen(grouped)],
	function* ({ findElements, readText, refreshScreen, roles }) {
		function groups() {
			return [...findElements<HTMLElement>('[role="group"]')].map((group) => [
				roles.accessible(group).name,
				...[...group.querySelectorAll('[role="option"] strong')].map((title) => title.textContent),
			]);
		}
		expect(groups()).toEqual([
			["Needs you", "Waiting on you"],
			["Work", "Mentions it", "Goal named in the title", "Starts with it"],
			["Documents", "Named in the title"],
		]);
		yield* Effect.promise(() => refreshScreen(searchResultContent(grouped, "named")));
		expect(groups()).toEqual([
			["Work", "Starts with it", "Mentions it", "Goal named in the title"],
			["Needs you", "Waiting on you"],
			["Documents", "Named in the title"],
		]);
		yield* Effect.promise(() => refreshScreen(searchResultContent(grouped.toSpliced(3, 1), "named")));
		expect(groups().map(([name]) => name)).toEqual(["Needs you", "Work", "Documents"]);
		expect(readText('[role="option"]:has(a[href="/_board/item/project.one/"]) small')).toBe("Goal");
	},
);

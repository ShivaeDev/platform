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

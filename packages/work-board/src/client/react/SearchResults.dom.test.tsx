import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { screenStory } from "#test/screenStory.ts";
import { searchResultScreen } from "#test/searchResultScreen.tsx";
import type { SearchItem } from "./searchCommands.ts";

expectNoReactWarnings();

function passage(snippet: string, line: number): SearchItem {
	return { file: "notes.md", href: "/notes.md#heading-shared", kind: "passage", line, snippet, title: "Shared" };
}
const alpha = passage("Alpha evidence", 3);
const beta = passage("Beta evidence", 5);
const gamma = passage("Gamma evidence", 7);
const other: SearchItem = { href: "/other.md", kind: "document", snippet: "Other evidence", title: "Other" };

function shown(items: readonly SearchItem[]) {
	return items.map(({ href, snippet }) => ({ href, snippet }));
}

screenStory.it(
	"when passages sharing one heading link are dropped and reordered, each row shows its own passage",
	[searchResultScreen([alpha, beta, beta, gamma, other])],
	function* ({ results, resultsArrive }) {
		expect(yield* results("href", "snippet")).toEqual(shown([alpha, beta, beta, gamma, other]));

		yield* resultsArrive([other, gamma, alpha]);

		expect(yield* results("href", "snippet")).toEqual(shown([other, gamma, alpha]));
	},
);

screenStory.it(
	"a result names its kind and file, with the line when the line is known",
	[
		searchResultScreen([
			{ file: "notes.md", href: "/notes.md#heading-shared", kind: "passage", line: 3, title: "Shared" },
			{ file: "other.md", href: "/other.md", kind: "document", title: "Other" },
		]),
	],
	function* ({ results }) {
		expect(yield* results("source")).toEqual([{ source: "Passage · notes.md:3" }, { source: "Document · other.md" }]);
	},
);

const grouped: readonly SearchItem[] = [
	{ href: "/_board/item/task.one/", itemKind: "task", kind: "document", match: "text", title: "Mentions it" },
	{ href: "/plan.md", kind: "document", match: "title", title: "Named in the title" },
	{ href: "/_board/item/project.one/", itemKind: "goal", kind: "document", match: "title", title: "Goal named in the title" },
	{ href: "/_board/item/task.two/", itemKind: "task", kind: "document", match: "prefix", title: "Starts with it" },
	{ href: "/needs.md", kind: "needs-you", title: "Waiting on you" },
];

screenStory.it(
	"without a query, results keep the fixed group order Needs you, Work, Documents",
	[searchResultScreen(grouped)],
	function* ({ resultGroups }) {
		expect(yield* resultGroups()).toEqual([
			{ group: "Needs you", titles: ["Waiting on you"] },
			{ group: "Work", titles: ["Mentions it", "Goal named in the title", "Starts with it"] },
			{ group: "Documents", titles: ["Named in the title"] },
		]);
	},
);

screenStory.it(
	"while searching, the group with the best match comes first and lists its best match first",
	[searchResultScreen(grouped, "named")],
	function* ({ resultGroups }) {
		expect(yield* resultGroups()).toEqual([
			{ group: "Work", titles: ["Starts with it", "Mentions it", "Goal named in the title"] },
			{ group: "Needs you", titles: ["Waiting on you"] },
			{ group: "Documents", titles: ["Named in the title"] },
		]);
	},
);

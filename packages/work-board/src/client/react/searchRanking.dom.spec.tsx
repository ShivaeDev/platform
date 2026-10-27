import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/react/client/testing.ts";
import { paletteFixture } from "#test/paletteFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { crossGroupRankingFixture, identityRankingFixture, searchRankingFixture } from "#test/searchRankingFixture.ts";
import { searchScreen } from "#test/searchScreen.tsx";

expectNoReactWarnings();
const QUERY = '#search-dialog [role="combobox"]';

const STATUS_LABELS: Readonly<Record<string, string>> = { deferred: "Deferred", done: "Done", draft: "Draft", ready: "Ready" };

for (const { fixture, first, id, name, queries, status } of [
	{
		first: "A running watch sees reviews finish",
		fixture: searchRankingFixture(),
		id: "",
		name: "titles before passages",
		queries: ["watch"],
		status: "draft",
	},
	...["ready", "done", "deferred"].flatMap((titleStatus) =>
		["draft", titleStatus].map((passageStatus) => ({
			first: "Inbox triage",
			fixture: identityRankingFixture(titleStatus, passageStatus),
			id: "task.inbox",
			name: `a ${titleStatus} title/ID match above a newer ${passageStatus} passage match`,
			queries: ["inbox", "task.inbox"],
			status: titleStatus,
		})),
	),
]) {
	const { files, modified } = fixture;
	screenStory.it(
		`ranks ${name}`,
		[searchScreen(files, { home: undefined, modified })],
		function* ({ findElement, readText, findElements, typeText }) {
			const field = findElement<HTMLInputElement>('#search-dialog [role="combobox"]', document);
			if (!field) {
				throw new Error("Missing palette input");
			}
			for (const query of queries) {
				typeText(field, query);
				yield* eventually(() => expect(readText('#search-dialog [role="option"] strong', document)).toBe(first));
				const rows = [...findElements('#search-dialog [role="option"]', document)];
				expect(readText("[data-status-token]", rows[0])).toBe(STATUS_LABELS[status]);
				if (query === "watch") {
					const sources = [...new Set(rows.map((row) => readText("strong", row)))];
					expect(sources).toEqual([
						"A running watch sees reviews finish",
						"Watch needs you",
						"Active watch",
						"Held watch",
						"Done watch",
						"Deferred watch",
						"Superseded watch",
						"Keep reviews visible",
						"Finished",
					]);
				} else {
					expect(readText("code", rows[0])).toBe(id);
					expect(rows.some((row) => readText("strong", row) === "Inbox triage")).toBe(true);
					expect(rows.some((row) => readText("strong", row) === "Captured notes")).toBe(true);
				}
			}
		},
	);
}

screenStory.it(
	"lists a plain document whose title starts with the query first and orders the other groups by their best hit",
	[searchScreen(crossGroupRankingFixture())],
	function* ({ input, findElements, roles }) {
		function groups() {
			return [...findElements<HTMLElement>('#search-dialog [role="listbox"] [role="group"]', document)].map((group) => ({
				name: roles.accessible(group).name,
				titles: [...group.querySelectorAll('[role="option"] strong')].map((title) => title.textContent),
			}));
		}
		input(QUERY, "Work Board on client-rendered React");
		yield* eventually(() =>
			expect(groups()).toEqual([
				{ name: "Documents", titles: ["Work Board on client-rendered React: slice plan"] },
				{ name: "Work", titles: ["Platform work", "Queries keep their data while they refresh 0"] },
			]),
		);
		input(QUERY, "budget");
		yield* eventually(() => expect(groups().map((group) => group.titles[0])).toEqual(["Connection budget", "Platform work"]));
		expect(groups().map((group) => group.name)).toEqual(["Documents", "Work"]);
	},
);

screenStory.it(
	"lists a goal named exactly ahead of a document whose title only starts with that name",
	[searchScreen({ ...paletteFixture(), "notes/calmer.md": "# A calmer workspace review\n\nNotes from the review.\n" })],
	function* ({ input, findElements, readText }) {
		input(QUERY, "A calmer workspace");
		yield* eventually(() =>
			expect(findElements<HTMLElement>('#search-dialog [role="option"]', document).map((row) => readText("strong", row))).toEqual([
				"Go to A calmer workspace",
				"A calmer workspace review",
			]),
		);
	},
);

screenStory.it("labels goals as Goal in search results", [searchScreen(paletteFixture())], function* ({ input, findElements, readText }) {
	input(QUERY, "finished");
	yield* eventually(() =>
		expect(readText("strong", findElements<HTMLElement>('#search-dialog [role="option"]', document)[0])).toBe("Finished workspace"),
	);
	const row = findElements<HTMLElement>('#search-dialog [role="option"]', document)[0];
	expect(row?.querySelector("small")?.firstChild?.textContent).toBe("Goal");
	expect(readText("small", row)).not.toMatch(/^project/u);
});

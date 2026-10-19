import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { identityRankingFixture, searchRankingFixture } from "#test/searchRankingFixture.ts";
import { searchScreen } from "#test/searchScreen.tsx";

expectNoReactWarnings();

const STATUS_LABELS: Readonly<Record<string, string>> = { active: "Active", deferred: "Deferred", done: "Done", planned: "Planned" };

for (const { fixture, first, id, name, queries, status } of [
	{
		first: "A running watch sees reviews finish",
		fixture: searchRankingFixture(),
		id: "",
		name: "titles before passages",
		queries: ["watch"],
		status: "planned",
	},
	...["active", "done", "deferred"].flatMap((titleStatus) =>
		["planned", titleStatus].map((passageStatus) => ({
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
				yield* Effect.promise(() => eventually(() => expect(readText('#search-dialog [role="option"] strong', document)).toBe(first)));
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

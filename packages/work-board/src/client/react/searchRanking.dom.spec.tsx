import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { identityRankingFixture, searchRankingFixture } from "#test/searchRankingFixture.ts";
import { searchScreen } from "#test/searchScreen.tsx";

expectNoReactWarnings();

for (const { fixture, first, id, queries, status } of [
	{ first: "A running watch sees reviews finish", fixture: searchRankingFixture(), id: "", queries: ["watch"], status: "planned" },
	...["active", "done", "deferred"].map((itemStatus) => ({
		first: "Inbox triage",
		fixture: identityRankingFixture(itemStatus, itemStatus),
		id: "task.inbox",
		queries: ["inbox", "task.inbox"],
		status: itemStatus,
	})),
	...["planned", "active"].flatMap((passageStatus) =>
		["done", "deferred"].map((titleStatus) => ({
			first: "Captured notes",
			fixture: identityRankingFixture(titleStatus, passageStatus),
			id: "task.notes",
			queries: ["inbox", "task.inbox"],
			status: passageStatus,
		})),
	),
]) {
	const { files, modified } = fixture;
	screenStory.it(
		`ranks status first, then title/ID relevance and recency (${status}, ${id})`,
		[searchScreen(files, { home: undefined, modified })],
		function* ({ findElement, readText, findElements, typeText }) {
			const field = findElement("input");
			if (!field) {
				throw new Error("Missing palette input");
			}
			for (const query of queries) {
				typeText(field, query);
				yield* Effect.promise(() => eventually(() => expect(readText('[role="option"] strong')).toBe(first)));
				const rows = [...findElements('[role="option"]')];
				expect(readText("[data-status-token]", rows[0])).toBe(status);
				if (query === "watch") {
					const sources = [...new Set(rows.map((row) => readText("strong", row)))];
					expect(sources).toEqual([
						"A running watch sees reviews finish",
						"Watch needs you",
						"Active watch",
						"Held watch",
						"Keep reviews visible",
						"Done watch",
						"Deferred watch",
						"Superseded watch",
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

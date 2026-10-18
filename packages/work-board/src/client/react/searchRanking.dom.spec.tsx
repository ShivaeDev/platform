import { Effect } from "effect";
import { act } from "react";
import { expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { identityRankingFixture, searchRankingFixture } from "#test/searchRankingFixture.ts";
import { SearchDialog } from "./SearchDialog.tsx";

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
	screenStory.it(`ranks status first, then title/ID relevance and recency (${status}, ${id})`, [], function* ({ renderBoard }) {
		const { files, modified } = fixture;
		const view = yield* Effect.promise(() =>
			renderBoard(
				files,
				(api) => (
					<SearchDialog
						api={api}
						appearance={{ change: vi.fn(), closed: false, density: "comfortable", notice: "", theme: "light" }}
						close={vi.fn()}
						open
						toggleSidebar={vi.fn()}
					/>
				),
				{ home: undefined, modified },
			),
		);

		const field = view.container.querySelector("input");
		if (!field) {
			throw new Error("Missing palette input");
		}
		for (const query of queries) {
			act(() => {
				field.value = query;
				field.dispatchEvent(new Event("input", { bubbles: true }));
			});
			yield* Effect.promise(() => eventually(() => expect(view.container.querySelector('[role="option"] strong')?.textContent).toBe(first)));
			const rows = [...view.container.querySelectorAll('[role="option"]')];
			expect(rows[0]?.querySelector("[data-status-token]")?.textContent).toBe(status);
			if (query === "watch") {
				const sources = [...new Set(rows.map((row) => row.querySelector("strong")?.textContent))];
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
				expect(rows[0]?.querySelector("code")?.textContent).toBe(id);
				expect(rows.some((row) => row.querySelector("strong")?.textContent === "Inbox triage")).toBe(true);
				expect(rows.some((row) => row.querySelector("strong")?.textContent === "Captured notes")).toBe(true);
			}
		}
	});
}

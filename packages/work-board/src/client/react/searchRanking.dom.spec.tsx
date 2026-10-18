import { act } from "react";
import { expect, it, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { renderBoard } from "#test/react.tsx";
import { identityRankingFixture, searchRankingFixture } from "#test/searchRankingFixture.ts";
import { SearchDialog } from "./SearchDialog.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

it.each([
	{ first: "A running watch sees reviews finish", fixture: searchRankingFixture(), id: "", queries: ["watch"], status: "planned" },
	...["active", "done", "deferred"].map((status) => ({
		first: "Inbox triage",
		fixture: identityRankingFixture(status, status),
		id: "task.inbox",
		queries: ["inbox", "task.inbox"],
		status,
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
])("ranks status first, then title/ID relevance and recency ($status, $id)", async ({ fixture, first, id, queries, status }) => {
	const { files, modified } = fixture;
	const view = await renderBoard(
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
	);
	try {
		const field = view.container.querySelector("input");
		if (!field) {
			throw new Error("Missing palette input");
		}
		for (const query of queries) {
			act(() => {
				field.value = query;
				field.dispatchEvent(new Event("input", { bubbles: true }));
			});
			await eventually(() => expect(view.container.querySelector('[role="option"] strong')?.textContent).toBe(first));
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
	} finally {
		await view.unmount();
	}
});

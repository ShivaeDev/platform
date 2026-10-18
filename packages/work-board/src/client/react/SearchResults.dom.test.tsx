import { Effect } from "effect";
import { expect, vi } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { SearchResults } from "./SearchResults.tsx";
import type { SearchItem } from "./searchCommands.ts";

expectNoReactWarnings();

screenStory.it("removes and reorders passages sharing a heading URL without retaining rows or repeating IDs", [], function* ({ render }) {
	function passage(snippet: string, line: number): SearchItem {
		return { file: "notes.md", href: "/notes.md#heading-shared", kind: "passage", line, snippet, title: "Shared" };
	}
	const alpha = passage("Alpha evidence", 3);
	const beta = passage("Beta evidence", 5);
	const gamma = passage("Gamma evidence", 7);
	const other: SearchItem = { href: "/other.md", kind: "document", snippet: "Other evidence", title: "Other" };
	const activate = vi.fn();
	const view = yield* Effect.promise(() => render(<SearchResults activate={activate} items={[alpha, beta, beta, gamma, other]} selected={0} />));
	function expectRows(items: readonly SearchItem[]) {
		const rows = [...view.container.querySelectorAll<HTMLAnchorElement>('[role="option"]')];
		expect(rows.map((row) => row.querySelector("p")?.textContent)).toEqual(items.map((item) => item.snippet));
		expect(rows.map((row) => row.id)).toEqual(items.map((_, index) => `search-result-${index}`));
		expect(rows.map((row) => row.getAttribute("href"))).toEqual(items.map((item) => item.href));
	}

	expectRows([alpha, beta, beta, gamma, other]);
	yield* Effect.promise(() => view.render(<SearchResults activate={activate} items={[other, gamma, alpha]} selected={2} />));
	expectRows([other, gamma, alpha]);
	yield* Effect.promise(() => view.render(<SearchResults activate={activate} items={[alpha, other, gamma]} selected={0} />));
	expectRows([alpha, other, gamma]);
	expect(view.container.querySelector('[aria-selected="true"]')?.id).toBe("search-result-0");
});

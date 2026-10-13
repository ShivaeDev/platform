import { expect, it, vi } from "vitest";
import { expectNoReactWarnings, render } from "@shivaedev/effect-react/testing.ts";
import { SearchResults } from "./SearchResults.tsx";
import type { SearchItem } from "./searchCommands.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

it("removes and reorders passages sharing a heading URL without retaining rows or repeating IDs", async () => {
	function passage(snippet: string, line: number): SearchItem {
		return { file: "notes.md", href: "/notes.md#heading-shared", kind: "passage", line, snippet, title: "Shared" };
	}
	const alpha = passage("Alpha evidence", 3);
	const beta = passage("Beta evidence", 5);
	const gamma = passage("Gamma evidence", 7);
	const other: SearchItem = { href: "/other.md", kind: "document", snippet: "Other evidence", title: "Other" };
	const activate = vi.fn();
	const view = await render(<SearchResults activate={activate} items={[alpha, beta, beta, gamma, other]} selected={0} />);
	function expectRows(items: readonly SearchItem[]) {
		const rows = [...view.container.querySelectorAll<HTMLAnchorElement>('[role="option"]')];
		expect(rows.map((row) => row.querySelector("p")?.textContent)).toEqual(items.map((item) => item.snippet));
		expect(rows.map((row) => row.id)).toEqual(items.map((_, index) => `search-result-${index}`));
		expect(rows.map((row) => row.getAttribute("href"))).toEqual(items.map((item) => item.href));
	}
	try {
		expectRows([alpha, beta, beta, gamma, other]);
		await view.render(<SearchResults activate={activate} items={[other, gamma, alpha]} selected={2} />);
		expectRows([other, gamma, alpha]);
		await view.render(<SearchResults activate={activate} items={[alpha, other, gamma]} selected={0} />);
		expectRows([alpha, other, gamma]);
		expect(view.container.querySelector('[aria-selected="true"]')?.id).toBe("search-result-0");
	} finally {
		await view.unmount();
	}
});

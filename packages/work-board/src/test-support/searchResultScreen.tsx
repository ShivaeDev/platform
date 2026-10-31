import type { SearchItem } from "#client/react/searchCommands.ts";
import { componentScreen } from "./screenTraits.ts";
import { searchResultContent } from "./searchResultContent.tsx";

export function searchResultScreen(items: readonly SearchItem[], query = "") {
	return componentScreen(searchResultContent(items, query));
}

export function passage(snippet: string, line: number): SearchItem {
	return { file: "notes.md", href: "/notes.md#heading-shared", kind: "passage", line, snippet, title: "Shared" };
}
export function shown(items: readonly SearchItem[]) {
	return items.map(({ href, snippet }) => ({ href, snippet }));
}

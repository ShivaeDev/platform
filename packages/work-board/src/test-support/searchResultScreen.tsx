import { SearchResults } from "#client/react/SearchResults.tsx";
import type { SearchItem } from "#client/react/searchCommands.ts";
import { componentScreen } from "./screenTraits.ts";

export function searchResultScreen(items: readonly SearchItem[], selected = 0) {
	return componentScreen(<SearchResults activate={() => undefined} items={items} selected={selected} />);
}
export function searchResultContent(items: readonly SearchItem[], selected = 0) {
	return <SearchResults activate={() => undefined} items={items} selected={selected} />;
}

import { Command } from "#client/react/components/ui/command.tsx";
import { SearchResults } from "#client/react/SearchResults.tsx";
import type { SearchItem } from "#client/react/searchCommands.ts";
import { componentScreen } from "./screenTraits.ts";

export function searchResultScreen(items: readonly SearchItem[], query = "") {
	return componentScreen(searchResultContent(items, query));
}
export function searchResultContent(items: readonly SearchItem[], query = "") {
	return (
		<Command shouldFilter={false}>
			<SearchResults activate={() => undefined} items={items} query={query} />
		</Command>
	);
}

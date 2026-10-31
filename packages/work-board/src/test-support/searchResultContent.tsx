import { Command } from "#client/react/components/ui/command.tsx";
import { SearchResults } from "#client/react/SearchResults.tsx";
import type { SearchItem } from "#client/react/searchCommands.ts";

export function searchResultContent(items: readonly SearchItem[], query = "") {
	return (
		<Command shouldFilter={false}>
			<SearchResults activate={() => undefined} items={items} query={query} />
		</Command>
	);
}

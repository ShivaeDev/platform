import { Command } from "#client/react/components/ui/command.tsx";
import { SearchResults } from "#client/react/SearchResults.tsx";
import type { SearchItem } from "#client/react/searchCommands.ts";
import { componentScreen } from "./screenTraits.ts";

export function searchResultScreen(items: readonly SearchItem[]) {
	return componentScreen(searchResultContent(items));
}
export function searchResultContent(items: readonly SearchItem[]) {
	return (
		<Command shouldFilter={false}>
			<SearchResults activate={() => undefined} items={items} />
		</Command>
	);
}

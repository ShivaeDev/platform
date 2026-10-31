import type { SearchItem } from "#client/react/searchCommands.ts";
import { componentScreen } from "./screenTraits.ts";
import { searchResultContent } from "./searchResultContent.tsx";

export function searchResultScreen(items: readonly SearchItem[], query = "") {
	return componentScreen(searchResultContent(items, query));
}

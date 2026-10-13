import type { SearchItem } from "./searchCommands.ts";
import { shellIds } from "./shellIds.ts";
export function SearchResults({
	items,
	selected,
	activate,
}: {
	readonly items: readonly SearchItem[];
	readonly selected: number;
	readonly activate: (item: SearchItem) => void;
}) {
	function choose(event: React.MouseEvent<HTMLAnchorElement>, item: SearchItem) {
		if (item.command) {
			event.preventDefault();
		}
		activate(item);
	}
	return (
		<div aria-label="Search results" id={shellIds.searchResults} role="listbox">
			{items.map((item, index) => (
				<div key={item.href ?? item.command} role="presentation">
					<a
						aria-selected={index === selected}
						data-command={item.command}
						href={item.href ?? "#"}
						id={`search-result-${index}`}
						onClick={(event) => choose(event, item)}
						role="option"
					>
						<strong>{item.title}</strong>
						<small>
							{item.kind}
							{item.file ? ` · ${item.file}${item.line ? `:${item.line}` : ""}` : ""}
						</small>
						{Boolean(item.snippet) && <p>{item.snippet}</p>}
					</a>
				</div>
			))}
		</div>
	);
}

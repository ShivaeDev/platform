import { StatusChip } from "#client/react/StatusChip.tsx";
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
	const occurrences = new Map<string, number>();
	function resultKey(item: SearchItem) {
		const identity = JSON.stringify([item.command, item.href, item.file, item.id, item.kind, item.line, item.snippet, item.title]);
		const occurrence = occurrences.get(identity) ?? 0;
		occurrences.set(identity, occurrence + 1);
		return `${identity}:${occurrence}`;
	}
	function choose(event: React.MouseEvent<HTMLAnchorElement>, item: SearchItem) {
		if (item.command) {
			event.preventDefault();
		}
		activate(item);
	}
	return (
		<div aria-label="Search results" id={shellIds.searchResults} role="listbox">
			{items.map((item, index) => (
				<div key={resultKey(item)} role="presentation">
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
							{item.itemKind ?? item.kind}
							{Boolean(item.id) && <code className="font-mono">{item.id}</code>}
							{Boolean(item.status) && <StatusChip status={item.status} />}
							{!item.id && item.file ? ` · ${item.file}${item.line ? `:${item.line}` : ""}` : ""}
						</small>
						{Boolean(item.snippet) && <p>{item.snippet}</p>}
					</a>
				</div>
			))}
		</div>
	);
}

import type { Ref } from "react";
import { CommandItem, CommandList } from "#client/react/components/ui/command.tsx";
import { StatusChip } from "#client/react/StatusChip.tsx";
import type { SearchItem } from "./searchCommands.ts";

export function SearchResults({
	items,
	activate,
	listRef,
}: {
	readonly items: readonly SearchItem[];
	readonly activate: (item: SearchItem) => void;
	readonly listRef?: Ref<HTMLDivElement>;
}) {
	const occurrences = new Map<string, number>();
	function resultKey(item: SearchItem) {
		const identity = JSON.stringify([item.command, item.href, item.file, item.id, item.kind, item.line, item.snippet, item.title]);
		const occurrence = occurrences.get(identity) ?? 0;
		occurrences.set(identity, occurrence + 1);
		return `${identity}:${occurrence}`;
	}
	return (
		<CommandList className="max-h-[min(420px,calc(100dvh-280px))] px-1 pb-1" label="Search results" ref={listRef}>
			{items.map((item) => {
				const key = resultKey(item);
				return <SearchResult activate={activate} item={item} key={key} value={key} />;
			})}
		</CommandList>
	);
}

function SearchResult({
	item,
	value,
	activate,
}: {
	readonly item: SearchItem;
	readonly value: string;
	readonly activate: (item: SearchItem) => void;
}) {
	return (
		<CommandItem className="p-0" data-command={item.command} onSelect={() => activate(item)} value={value}>
			<a
				className="grid min-w-0 flex-1 gap-1 px-2.5 py-2 text-popover-foreground no-underline"
				href={item.href ?? "#"}
				onClick={(event) => {
					if (item.command) {
						event.preventDefault();
					}
				}}
				tabIndex={-1}
			>
				<strong className="font-medium">{item.title}</strong>
				<small className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
					{item.itemKind ?? item.kind}
					{Boolean(item.id) && <code className="font-mono">{item.id}</code>}
					{Boolean(item.status) && <StatusChip status={item.status} />}
					{!item.id && item.file ? ` · ${item.file}${item.line ? `:${item.line}` : ""}` : ""}
				</small>
				{Boolean(item.snippet) && <p className="text-muted-foreground">{item.snippet}</p>}
			</a>
		</CommandItem>
	);
}

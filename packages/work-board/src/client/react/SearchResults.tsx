import type { Ref } from "react";
import { CommandGroup, CommandItem, CommandList } from "#client/react/components/ui/command.tsx";
import { StatusChip } from "#client/react/StatusChip.tsx";
import type { SearchItem } from "./searchCommands.ts";

const GROUPS = ["Needs you", "Go to", "Appearance", "Work", "Documents"] as const;

function groupOf(item: SearchItem): (typeof GROUPS)[number] {
	if (item.kind === "needs-you") {
		return "Needs you";
	}
	if (item.kind === "command") {
		return item.command ? "Appearance" : "Go to";
	}
	return item.itemKind ? "Work" : "Documents";
}

function searchTerms(query: string): readonly string[] {
	const phrase = query.normalize("NFKC").toLowerCase().trim();
	return (phrase.startsWith("records:") ? phrase.slice("records:".length) : phrase).split(/\s+/u).filter(Boolean).slice(0, 8);
}

function escapePattern(term: string): string {
	return term.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function Highlighted({ text, terms }: { readonly text: string; readonly terms: readonly string[] }) {
	if (terms.length === 0) {
		return text;
	}
	const longestFirst = [...terms].sort((left, right) => right.length - left.length);
	const pattern = new RegExp(`(${longestFirst.map(escapePattern).join("|")})`, "giu");
	let offset = 0;
	return text.split(pattern).map((part, index) => {
		const at = offset;
		offset += part.length;
		return index % 2 === 1 ? (
			<mark className="bg-transparent font-semibold text-foreground" key={at}>
				{part}
			</mark>
		) : (
			part
		);
	});
}

export function SearchResults({
	items,
	activate,
	listRef,
	query = "",
}: {
	readonly items: readonly SearchItem[];
	readonly activate: (item: SearchItem) => void;
	readonly listRef?: Ref<HTMLDivElement>;
	readonly query?: string;
}) {
	const terms = searchTerms(query);
	const occurrences = new Map<string, number>();
	function resultKey(item: SearchItem) {
		const identity = JSON.stringify([item.command, item.href, item.file, item.id, item.kind, item.line, item.snippet, item.title]);
		const occurrence = occurrences.get(identity) ?? 0;
		occurrences.set(identity, occurrence + 1);
		return `${identity}:${occurrence}`;
	}
	return (
		<CommandList className="max-h-[min(420px,calc(100dvh-280px))] px-1 pb-1 [scrollbar-width:thin]!" label="Search results" ref={listRef}>
			{GROUPS.map((heading) => (
				<SearchGroup
					activate={activate}
					heading={heading}
					items={items.filter((item) => groupOf(item) === heading)}
					key={heading}
					resultKey={resultKey}
					terms={terms}
				/>
			))}
		</CommandList>
	);
}

function SearchGroup({
	heading,
	items,
	activate,
	resultKey,
	terms,
}: {
	readonly heading: string;
	readonly items: readonly SearchItem[];
	readonly activate: (item: SearchItem) => void;
	readonly resultKey: (item: SearchItem) => string;
	readonly terms: readonly string[];
}) {
	if (items.length === 0) {
		return null;
	}
	return (
		<CommandGroup heading={heading}>
			{items.map((item) => {
				const key = resultKey(item);
				return <SearchResult activate={activate} item={item} key={key} terms={terms} value={key} />;
			})}
		</CommandGroup>
	);
}

function SearchResult({
	item,
	value,
	activate,
	terms,
}: {
	readonly item: SearchItem;
	readonly value: string;
	readonly activate: (item: SearchItem) => void;
	readonly terms: readonly string[];
}) {
	const command = item.kind === "command" || item.kind === "needs-you";
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
				{(!command || Boolean(item.id)) && (
					<small className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
						{!command && (item.itemKind ?? item.kind)}
						{Boolean(item.id) && <code className="font-mono">{item.id}</code>}
						{Boolean(item.status) && <StatusChip status={item.status} />}
						{!item.id && item.file ? ` · ${item.file}${item.line ? `:${item.line}` : ""}` : ""}
					</small>
				)}
				{Boolean(item.snippet) && (
					<p className="text-muted-foreground">
						<Highlighted terms={terms} text={item.snippet ?? ""} />
					</p>
				)}
			</a>
		</CommandItem>
	);
}

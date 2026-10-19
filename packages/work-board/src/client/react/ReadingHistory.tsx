import { Option } from "effect";
import { useId, useRef } from "react";
import { flushSync } from "react-dom";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import type { Item } from "#client/react/LibraryContext.ts";
import { type Entry, HistoryEntry } from "./HistoryEntry.tsx";
import { useNow } from "./now.ts";
import { readingDays } from "./readingDays.ts";
import type { ShellApi } from "./ShellApi.ts";
import { shellIds } from "./shellIds.ts";

function EntryList({
	title,
	entries,
	onClose,
	onRemove,
}: {
	readonly title: string;
	readonly entries: readonly Entry[];
	readonly onClose: () => void;
	readonly onRemove?: ((file: string) => void) | undefined;
}) {
	const id = useId();
	if (entries.length === 0) {
		return null;
	}
	return (
		<section className="grid gap-1">
			<h3 className="px-2 pt-3 font-semibold text-muted-foreground text-xs" id={id}>
				{title}
			</h3>
			<ul aria-labelledby={id} className="m-0 grid list-none gap-0.5 p-0">
				{entries.map((entry) => (
					<HistoryEntry entry={entry} key={entry.item.file} onClose={onClose} onRemove={onRemove ? () => onRemove(entry.item.file) : undefined} />
				))}
			</ul>
		</section>
	);
}

export function ReadingHistory({
	api,
	onClose,
	onEmpty,
	onRemove,
	current,
	favorites,
	recents,
}: {
	readonly api: ShellApi;
	readonly onClose: () => void;
	readonly onEmpty: () => void;
	readonly onRemove: (file: string) => void;
	readonly current: string;
	readonly favorites: readonly Item[];
	readonly recents: readonly Item[];
}) {
	const query = useQuery(api.library.query({ showFleet: true }, { timeToLive: 0 }));
	const data = Option.getOrUndefined(query.data);
	const files = new Map(data?.files.map((file) => [file.path, file]));
	const now = useNow();
	const navRef = useRef<HTMLElement>(null);
	function entry(item: Item): Entry {
		return { current: item.file === current, file: files.get(item.file), item, missing: data !== undefined && !files.has(item.file) };
	}
	function handleRemove(file: string) {
		const index = recents.findIndex((item) => item.file === file);
		flushSync(() => onRemove(file));
		const buttons = navRef.current?.querySelectorAll<HTMLButtonElement>("[data-history-remove]") ?? [];
		const next = buttons[Math.min(index, buttons.length - 1)];
		if (next) {
			next.focus();
		} else {
			onEmpty();
		}
	}
	return (
		<nav aria-label="Reading history" id={shellIds.readingLibrary} ref={navRef}>
			<EntryList entries={favorites.map(entry)} onClose={onClose} title="Pinned" />
			{readingDays(recents, now).map((day) => (
				<EntryList entries={day.entries.map(entry)} key={day.title} onClose={onClose} onRemove={handleRemove} title={day.title} />
			))}
		</nav>
	);
}

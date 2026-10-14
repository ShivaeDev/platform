import { Option } from "effect";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import { SearchResults } from "#client/react/SearchResults.tsx";
import type { ShellApi } from "#client/react/ShellApi.ts";
import { matchingCommands, type SearchItem } from "#client/react/searchCommands.ts";
import { searchStatus } from "#client/react/searchStatus.ts";
import { shellIds } from "#client/react/shellIds.ts";
import type { AppearanceControls } from "#client/react/useAppearance.ts";

export function SearchPalette({
	api,
	close,
	appearance,
	toggleSidebar,
	openLibrary,
	input,
	setInput,
}: {
	readonly api: ShellApi;
	readonly close: () => void;
	readonly appearance: AppearanceControls;
	readonly toggleSidebar: () => void;
	readonly openLibrary: (() => void) | undefined;
	readonly input: string;
	readonly setInput: (input: string) => void;
}) {
	const [text, setText] = useState(() => input.trim());
	const [selected, setSelected] = useState(0);
	const ref = useRef<HTMLInputElement>(null);
	const query = useQuery(api.search.query({ query: text }));
	const data = Option.getOrUndefined(query.data);
	const goals = useQuery(api.goals.query());
	const commands = matchingCommands(Option.getOrUndefined(goals.data)?.goals ?? [], text);
	const editing = input.trim() !== text;
	const items = editing ? [] : [...commands, ...(text && data ? data.results : [])];
	useEffect(() => {
		setSelected((current) => Math.min(current, Math.max(0, items.length - 1)));
	}, [items.length]);
	useEffect(() => {
		const timer = setTimeout(() => {
			setText(input.trim());
			setSelected(0);
		}, 150);
		return () => clearTimeout(timer);
	}, [input]);
	useEffect(() => {
		document.getElementById(`search-result-${selected}`)?.scrollIntoView({ block: "nearest" });
	}, [selected]);
	function activate(item: SearchItem) {
		if (item.command === "library") {
			close();
			openLibrary?.();
			return;
		}
		activateAppearance(item.command, appearance, toggleSidebar);
		if (!item.command) {
			ref.current?.closest("dialog")?.close("navigate");
		}
		close();
	}
	const status = searchStatus(text, query.pending || editing, Option.isSome(query.cause), data);
	return (
		<>
			<form
				id={shellIds.searchForm}
				onSubmit={(event) => {
					event.preventDefault();
					setText(input.trim());
					query.refresh();
				}}
			>
				<label htmlFor="search-query">Search work or go to a view</label>
				<input
					aria-activedescendant={items[selected] ? `search-result-${selected}` : undefined}
					aria-autocomplete="list"
					aria-controls="search-results"
					aria-expanded="true"
					autoComplete="off"
					id={shellIds.searchQuery}
					maxLength={200}
					onInput={(event) => setInput(event.currentTarget.value)}
					onKeyDown={(event) => {
						if (event.key === "ArrowDown" || event.key === "ArrowUp") {
							event.preventDefault();
							setSelected((current) => (items.length > 0 ? (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length : 0));
						}
						if (event.key === "Enter" && items[selected]) {
							event.preventDefault();
							document.getElementById(`search-result-${selected}`)?.click();
						}
					}}
					ref={ref}
					role="combobox"
					type="search"
					value={input}
				/>
				<button type="submit">Search</button>
			</form>
			<p className="search-help">↑/↓ to choose · Enter to open · Escape to close · records: to include Fleet records</p>
			<p id={shellIds.searchStatus} role="status">
				{status}
			</p>
			<SearchResults activate={activate} items={items} selected={selected} />
		</>
	);
}

function activateAppearance(command: string | undefined, appearance: AppearanceControls, toggleSidebar: () => void) {
	if (command === "sidebar-toggle") {
		toggleSidebar();
	}
	if (command === "density") {
		appearance.change({ density: appearance.density === "compact" ? "comfortable" : "compact" });
	}
	if (command === "theme") {
		appearance.change({ theme: appearance.theme === "dark" ? "light" : "dark" });
	}
}

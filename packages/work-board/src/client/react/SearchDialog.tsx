import { Option } from "effect";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import { Modal } from "./Modal.tsx";
import { SearchResults } from "./SearchResults.tsx";
import type { ShellApi } from "./ShellApi.ts";
import { type SearchItem, searchCommands } from "./searchCommands.ts";
import { searchStatus } from "./searchStatus.ts";
import { shellIds } from "./shellIds.ts";
import type { AppearanceControls } from "./useAppearance.ts";

export function SearchDialog({
	api,
	open,
	close,
	appearance,
	toggleSidebar,
}: {
	readonly api: ShellApi;
	readonly open: boolean;
	readonly close: () => void;
	readonly appearance: AppearanceControls;
	readonly toggleSidebar: () => void;
}) {
	return (
		<Modal close={close} focus="search-query" id={shellIds.searchDialog} open={open} opener="search-open" title="search-title">
			<div className="search-header">
				<h2 id={shellIds.searchTitle}>Find work</h2>
				<button aria-label="Close search" id={shellIds.searchClose} onClick={() => close()} type="button">
					Close
				</button>
			</div>
			{open ? <Search api={api} appearance={appearance} close={close} toggleSidebar={toggleSidebar} /> : null}
		</Modal>
	);
}
function Search({
	api,
	close,
	appearance,
	toggleSidebar,
}: {
	readonly api: ShellApi;
	readonly close: () => void;
	readonly appearance: AppearanceControls;
	readonly toggleSidebar: () => void;
}) {
	const [input, setInput] = useState("");
	const [text, setText] = useState("");
	const [selected, setSelected] = useState(0);
	const ref = useRef<HTMLInputElement>(null);
	const query = useQuery(api.search.query({ query: text }));
	const data = Option.getOrUndefined(query.data);
	const commands = searchCommands.filter((item) => item.title.toLowerCase().includes(text.toLowerCase()));
	const items = [...commands, ...(text && data ? data.results : [])];
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
		ref.current?.focus();
	}, []);
	useEffect(() => {
		document.getElementById(`search-result-${selected}`)?.scrollIntoView({ block: "nearest" });
	}, [selected]);
	function activate(item: SearchItem) {
		if (item.command === "sidebar-toggle") {
			toggleSidebar();
		}
		if (item.command === "density") {
			appearance.change({ density: appearance.density === "compact" ? "comfortable" : "compact" });
		}
		if (item.command === "theme") {
			appearance.change({ theme: appearance.theme === "dark" ? "light" : "dark" });
		}
		if (!item.command) {
			ref.current?.closest("dialog")?.close("navigate");
		}
		close();
	}
	const status = searchStatus(text, query.pending || input.trim() !== text, Option.isSome(query.cause), data);
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
				<label htmlFor="search-query">Search documents, headings, and passages</label>
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
			<p className="search-help">Ctrl/Cmd+K to open · ↑/↓ to choose · Enter to open · Escape to close</p>
			<p id={shellIds.searchStatus} role="status">
				{status}
			</p>
			<SearchResults activate={activate} items={items} selected={selected} />
		</>
	);
}

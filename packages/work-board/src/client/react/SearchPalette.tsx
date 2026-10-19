import { Option } from "effect";
import { type KeyboardEvent, type RefObject, useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import { ActiveDescendant } from "#client/react/ActiveDescendant.tsx";
import { Button } from "#client/react/components/ui/button.tsx";
import { Checkbox } from "#client/react/components/ui/checkbox.tsx";
import { Command, CommandInput } from "#client/react/components/ui/command.tsx";
import { Label } from "#client/react/components/ui/label.tsx";
import { SearchOutcome } from "#client/react/SearchOutcome.tsx";
import { SearchResults } from "#client/react/SearchResults.tsx";
import type { ShellApi } from "#client/react/ShellApi.ts";
import { activateCommand, matchingCommands, type SearchItem } from "#client/react/searchCommands.ts";
import { searchStatus } from "#client/react/searchStatus.ts";
import { shellIds } from "#client/react/shellIds.ts";
import type { AppearanceControls } from "#client/react/useAppearance.ts";
import { KeyboardHints } from "./KeyboardHints.tsx";

export function SearchPalette({
	api,
	close,
	appearance,
	toggleSidebar,
	input,
	inputRef,
	setInput,
	records,
	setRecords,
}: {
	readonly api: ShellApi;
	readonly close: (navigating: boolean) => void;
	readonly appearance: AppearanceControls;
	readonly toggleSidebar: () => void;
	readonly input: string;
	readonly inputRef: RefObject<HTMLInputElement | null>;
	readonly setInput: (input: string) => void;
	readonly records: boolean;
	readonly setRecords: (records: boolean) => void;
}) {
	const recordsId = useId();
	const [text, setText] = useState(() => input.trim());
	const listRef = useRef<HTMLDivElement>(null);
	const query = useQuery(api.search.query(records ? { query: text, records } : { query: text }));
	const data = Option.getOrUndefined(query.data);
	const goals = useQuery(api.goals.query());
	const commands = matchingCommands(Option.getOrUndefined(goals.data)?.goals ?? [], text);
	const editing = input.trim() !== text;
	const destinations = new Set<string>();
	const items = editing
		? []
		: [...commands, ...(text && data ? data.results : [])].filter((item: SearchItem) => {
				const destination = item.href ?? item.command;
				if (!destination) {
					return true;
				}
				if (destinations.has(destination)) {
					return false;
				}
				destinations.add(destination);
				return true;
			});
	useEffect(() => {
		const timer = setTimeout(() => setText(input.trim()), 150);
		return () => clearTimeout(timer);
	}, [input]);
	function activate(item: SearchItem) {
		activateCommand(item.command, appearance, toggleSidebar);
		close(!item.command);
	}
	function handleSearch() {
		setText(input.trim());
		query.refresh();
	}
	function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.key !== "Enter" || event.nativeEvent.isComposing) {
			return;
		}
		event.preventDefault();
		const link = event.currentTarget.querySelector<HTMLAnchorElement>('[data-slot="command-item"][data-selected="true"] a');
		if (link) {
			link.click();
		} else {
			handleSearch();
		}
	}
	function handleControlKeyDown(event: KeyboardEvent<HTMLElement>) {
		if (event.key === "Enter") {
			event.stopPropagation();
		}
	}
	function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === "Home" || event.key === "End") {
			event.stopPropagation();
		}
	}
	const failed = Option.isSome(query.cause);
	const status = searchStatus(text, query.pending || editing, failed, data);
	return (
		<Command
			className="min-h-0 rounded-none bg-transparent"
			label="Search work or go to a view"
			loop
			onKeyDown={handleKeyDown}
			shouldFilter={false}
			vimBindings={false}
		>
			<CommandInput
				enterKeyHint="search"
				maxLength={200}
				onKeyDown={handleInputKeyDown}
				onValueChange={setInput}
				placeholder="Search work or go to a view"
				ref={inputRef}
				value={input}
			/>
			<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 pt-2 text-muted-foreground text-xs">
				<KeyboardHints>
					<p>↑/↓ to choose · Enter to open · Escape to close</p>
				</KeyboardHints>
				<div className="flex items-center gap-2">
					<Checkbox checked={records} id={recordsId} onCheckedChange={setRecords} onKeyDown={handleControlKeyDown} />
					<Label className="font-normal text-muted-foreground" htmlFor={recordsId}>
						Include files Fleet writes
					</Label>
				</div>
			</div>
			<div className="flex items-center gap-2 px-3 py-2 text-xs">
				<p id={shellIds.searchStatus} role="status">
					{status}
				</p>
				{failed && (
					<Button onClick={handleSearch} onKeyDown={handleControlKeyDown} size="xs" variant="outline">
						Retry search
					</Button>
				)}
			</div>
			<SearchResults activate={activate} items={items} listRef={listRef} />
			<SearchOutcome
				failed={failed}
				found={items.length}
				input={input}
				onIncludeRecords={records ? undefined : () => setRecords(true)}
				onKeyDown={handleControlKeyDown}
				text={text}
				waiting={editing || query.pending || !data}
			/>
			<ActiveDescendant inputRef={inputRef} listRef={listRef} />
		</Command>
	);
}

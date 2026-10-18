import { Option } from "effect";
import { type KeyboardEvent, type RefObject, useEffect, useRef, useState } from "react";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import { ActiveDescendant } from "#client/react/ActiveDescendant.tsx";
import { Button } from "#client/react/components/ui/button.tsx";
import { Command, CommandInput } from "#client/react/components/ui/command.tsx";
import { SearchResults } from "#client/react/SearchResults.tsx";
import type { ShellApi } from "#client/react/ShellApi.ts";
import { matchingCommands, type SearchItem } from "#client/react/searchCommands.ts";
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
}: {
	readonly api: ShellApi;
	readonly close: (navigating: boolean) => void;
	readonly appearance: AppearanceControls;
	readonly toggleSidebar: () => void;
	readonly input: string;
	readonly inputRef: RefObject<HTMLInputElement | null>;
	readonly setInput: (input: string) => void;
}) {
	const [text, setText] = useState(() => input.trim());
	const formRef = useRef<HTMLFormElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const query = useQuery(api.search.query({ query: text }));
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
		activateAppearance(item.command, appearance, toggleSidebar);
		close(!item.command);
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
			formRef.current?.requestSubmit();
		}
	}
	function handleSearchButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
		if (event.key === "Enter") {
			event.stopPropagation();
		}
	}
	function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === "Home" || event.key === "End") {
			event.stopPropagation();
		}
	}
	const status = searchStatus(text, query.pending || editing, Option.isSome(query.cause), data);
	return (
		<Command
			className="min-h-0 rounded-none bg-transparent"
			label="Search work or go to a view"
			loop
			onKeyDown={handleKeyDown}
			shouldFilter={false}
			vimBindings={false}
		>
			<form
				className="flex items-center gap-1"
				id={shellIds.searchForm}
				onSubmit={(event) => {
					event.preventDefault();
					setText(input.trim());
					query.refresh();
				}}
				ref={formRef}
			>
				<div className="min-w-0 flex-1">
					<CommandInput
						enterKeyHint="search"
						maxLength={200}
						onKeyDown={handleInputKeyDown}
						onValueChange={setInput}
						placeholder="Search work or go to a view"
						ref={inputRef}
						value={input}
					/>
				</div>
				<Button className="mt-1" onKeyDown={handleSearchButtonKeyDown} type="submit" variant="outline">
					Search
				</Button>
			</form>
			<div className="space-y-1 p-2 text-muted-foreground text-xs">
				<KeyboardHints>
					<p>↑/↓ to choose · Enter to open · Escape to close</p>
				</KeyboardHints>
				<p>Use records: to include Fleet records.</p>
				<p className="text-foreground" id={shellIds.searchStatus} role="status">
					{status}
				</p>
			</div>
			<SearchResults activate={activate} items={items} listRef={listRef} />
			<ActiveDescendant inputRef={inputRef} listRef={listRef} />
		</Command>
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

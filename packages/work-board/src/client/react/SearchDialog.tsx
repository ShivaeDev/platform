import { type ComponentProps, Suspense, use, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "#client/react/components/ui/dialog.tsx";
import { searchPaletteChunk } from "#client/react/lazyChunks.ts";
import type { SearchPalette } from "#client/react/SearchPalette.tsx";
import type { ShellApi } from "#client/react/ShellApi.ts";
import { shellIds } from "#client/react/shellIds.ts";
import { textControl, textSelection } from "#client/react/textSelection.ts";
import type { AppearanceControls } from "#client/react/useAppearance.ts";

export function SearchDialog({
	api,
	open,
	close,
	appearance,
	toggleSidebar,
	returnFocus,
}: {
	readonly api: ShellApi;
	readonly open: boolean;
	readonly close: () => void;
	readonly appearance: AppearanceControls;
	readonly toggleSidebar: () => void;
	readonly returnFocus?: HTMLElement | undefined;
}) {
	const [input, setInput] = useState("");
	const [records, setRecords] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const navigatingRef = useRef(false);
	const selectionRef = useRef<ReturnType<typeof textSelection>>(undefined);
	// The dialog focuses the palette's input as it opens, so the palette has to be loaded before the reader can open it.
	useEffect(() => {
		void searchPaletteChunk.load();
	}, []);
	useLayoutEffect(() => {
		if (open) {
			navigatingRef.current = false;
			selectionRef.current = textSelection(returnFocus);
		}
	}, [open, returnFocus]);
	return (
		<Dialog
			onOpenChange={(next) => {
				if (!next) {
					close();
				}
			}}
			onOpenChangeComplete={(next) => {
				if (!(next || navigatingRef.current)) {
					restoreFocus(returnFocus, selectionRef.current);
				}
			}}
			open={open}
		>
			<DialogContent
				className="top-[12dvh] max-h-[76dvh] translate-y-0 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-xl"
				finalFocus={false}
				id={shellIds.searchDialog}
				initialFocus={inputRef}
			>
				<DialogHeader className="px-3 pt-3">
					<DialogTitle>Find work</DialogTitle>
				</DialogHeader>
				<Suspense fallback={null}>
					<LoadedSearchPalette
						api={api}
						appearance={appearance}
						close={(navigating) => {
							navigatingRef.current = navigating;
							close();
						}}
						input={input}
						inputRef={inputRef}
						records={records}
						setInput={setInput}
						setRecords={setRecords}
						toggleSidebar={toggleSidebar}
					/>
				</Suspense>
			</DialogContent>
		</Dialog>
	);
}

function LoadedSearchPalette(props: ComponentProps<typeof SearchPalette>) {
	const palette = searchPaletteChunk.loaded() ?? use(searchPaletteChunk.load());
	return "error" in palette ? (
		<p className="px-3 pb-3 text-sm" data-search-error="" role="status">
			Search could not be loaded: {palette.error}. Reload the page to try again.
		</p>
	) : (
		<palette.SearchPalette {...props} />
	);
}

function restoreFocus(target: HTMLElement | undefined, selection: ReturnType<typeof textSelection>) {
	target?.focus({ preventScroll: true });
	const control = textControl(target);
	if (selection && control) {
		control.setSelectionRange(selection.start, selection.end, selection.direction);
	}
}

import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "#client/react/components/ui/button.tsx";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "#client/react/components/ui/dialog.tsx";
import { SearchPalette } from "#client/react/SearchPalette.tsx";
import type { ShellApi } from "#client/react/ShellApi.ts";
import { shellIds } from "#client/react/shellIds.ts";
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
	const inputRef = useRef<HTMLInputElement>(null);
	const navigatingRef = useRef(false);
	const selectionRef = useRef<ReturnType<typeof textSelection>>(undefined);
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
				showCloseButton={false}
			>
				<DialogHeader className="flex-row items-center justify-between px-3 pt-3">
					<DialogTitle>Find work</DialogTitle>
					<DialogClose aria-label="Close search" id={shellIds.searchClose} render={<Button size="sm" variant="ghost" />}>
						Close
					</DialogClose>
				</DialogHeader>
				<SearchPalette
					api={api}
					appearance={appearance}
					close={(navigating) => {
						navigatingRef.current = navigating;
						close();
					}}
					input={input}
					inputRef={inputRef}
					setInput={setInput}
					toggleSidebar={toggleSidebar}
				/>
			</DialogContent>
		</Dialog>
	);
}

function restoreFocus(target: HTMLElement | undefined, selection: ReturnType<typeof textSelection>) {
	if (!target?.isConnected) {
		return;
	}
	target.focus({ preventScroll: true });
	const control = textControl(target);
	if (selection && control) {
		control.setSelectionRange(selection.start, selection.end, selection.direction);
	}
}

function textControl(element: Element | undefined) {
	return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element : undefined;
}

function textSelection(element: Element | undefined) {
	const control = textControl(element);
	if (!control || control.selectionStart === null || control.selectionEnd === null) {
		return undefined;
	}
	return { direction: control.selectionDirection ?? "none", end: control.selectionEnd, start: control.selectionStart };
}

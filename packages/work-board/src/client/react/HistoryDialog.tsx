import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "#client/react/components/ui/dialog.tsx";
import { EmptyState } from "#client/react/EmptyState.tsx";
import type { restoreLibrary } from "#client/react/LibraryContext.ts";
import { ClearHistory } from "./ClearHistory.tsx";
import { ReadingHistory } from "./ReadingHistory.tsx";
import type { ShellApi } from "./ShellApi.ts";
import { shellIds } from "./shellIds.ts";

export function HistoryDialog({
	api,
	open,
	close,
	onClosed,
	current,
	saved,
	onRemove,
	onClear,
}: {
	readonly api: ShellApi;
	readonly open: boolean;
	readonly close: (navigating: boolean) => void;
	readonly onClosed: () => void;
	readonly current: string;
	readonly saved: ReturnType<typeof restoreLibrary>;
	readonly onRemove: (file: string) => void;
	readonly onClear: () => void;
}) {
	const popupRef = useRef<HTMLDivElement>(null);
	const [confirming, setConfirming] = useState(false);
	function handleOpenChange(next: boolean) {
		if (!next) {
			close(false);
		}
	}
	function handleOpenChangeComplete(next: boolean) {
		if (!next) {
			setConfirming(false);
			onClosed();
		}
	}
	function handleClose() {
		close(true);
	}
	function handleEmpty() {
		popupRef.current?.focus();
	}
	function handleClear() {
		setConfirming(false);
		onClear();
		popupRef.current?.focus();
	}
	return (
		<Dialog onOpenChange={handleOpenChange} onOpenChangeComplete={handleOpenChangeComplete} open={open}>
			<DialogContent
				aria-describedby={undefined}
				className="max-h-[80dvh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 text-sm sm:max-w-md"
				finalFocus={false}
				id={shellIds.libraryDialog}
				ref={popupRef}
				tabIndex={-1}
			>
				<DialogHeader className="px-4 pt-4 pr-12">
					<DialogTitle>Reading history</DialogTitle>
				</DialogHeader>
				<div className="min-h-0 overflow-y-auto px-2 pt-1 pb-4">
					<ReadingHistory
						api={api}
						current={current}
						favorites={saved.favorites}
						onClose={handleClose}
						onEmpty={handleEmpty}
						onRemove={onRemove}
						recents={saved.recents}
					/>
					{saved.notice === "" ? null : (
						<p className="text-muted-foreground px-2 text-xs" role="status">
							{saved.notice}
						</p>
					)}
					{saved.notice === "" && saved.favorites.length + saved.recents.length === 0 ? (
						<EmptyState title="No reading history">Documents you open appear here so you can return to them.</EmptyState>
					) : null}
				</div>
				{saved.recents.length > 0 ? (
					<DialogFooter className="border-t px-4 py-3 sm:justify-start">
						<ClearHistory confirming={confirming} count={saved.recents.length} onClear={handleClear} onConfirmingChange={setConfirming} />
					</DialogFooter>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

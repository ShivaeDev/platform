import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "#client/react/components/ui/dialog.tsx";
import { EmptyState } from "#client/react/EmptyState.tsx";
import { LibraryContext, restoreLibrary } from "#client/react/LibraryContext.ts";
import { useMainLocation } from "./MainLocationContext.ts";
import { ReadingHistory } from "./ReadingHistory.tsx";
import type { ShellApi } from "./ShellApi.ts";
import { shellIds } from "./shellIds.ts";

export function ReadingLibrary({ api, children }: { readonly api: ShellApi; readonly children: ReactNode }) {
	const page = useMainLocation();
	const key = `work-board:library:${document.documentElement.dataset.workspace}`;
	const [saved, setSaved] = useState(() => restoreLibrary(key));
	const [current, setCurrent] = useState("");
	const [open, setOpen] = useState(false);
	const savedRef = useRef(saved);
	const visitedRef = useRef("");
	const returnFocusRef = useRef<HTMLElement | null>(null);
	const navigatingRef = useRef(false);
	const save = useCallback(
		(next: Pick<typeof saved, "favorites" | "recents">) => {
			let notice = "";
			try {
				localStorage.setItem(key, JSON.stringify(next));
			} catch {
				notice = "Reading history applies to this page only.";
			}
			savedRef.current = { ...next, notice };
			setSaved(savedRef.current);
		},
		[key],
	);
	const openHistory = useCallback((returnFocus: HTMLElement | null) => {
		returnFocusRef.current = returnFocus;
		navigatingRef.current = false;
		setOpen(true);
	}, []);
	useLayoutEffect(() => {
		function sync() {
			if (!page.route) {
				return;
			}
			const file = page.file;
			const title = page.title || file;
			document.title = title ? `${title} · Work Board` : "Work Board";

			setCurrent(file);
			if (file && page.view === "" && visitedRef.current !== `${file}:${title}`) {
				visitedRef.current = `${file}:${title}`;
				save({
					favorites: savedRef.current.favorites,
					recents: [{ file, title }, ...savedRef.current.recents.filter((item) => item.file !== file)].slice(0, 10),
				});
			}
		}
		sync();
	}, [save, page]);

	return (
		<LibraryContext.Provider
			value={{
				favorites: saved.favorites,
				openHistory,
				recents: saved.recents,
				toggle: (file, title) =>
					save({
						favorites: savedRef.current.favorites.some((item) => item.file === file)
							? savedRef.current.favorites.filter((item) => item.file !== file)
							: [...savedRef.current.favorites, { file, title }],
						recents: savedRef.current.recents,
					}),
			}}
		>
			{children}
			<HistoryDialog
				api={api}
				close={(navigating) => {
					navigatingRef.current = navigating;
					setOpen(false);
				}}
				current={current}
				onClosed={() => {
					if (!navigatingRef.current) {
						returnFocusRef.current?.focus({ preventScroll: true });
					}
				}}
				open={open}
				saved={saved}
			/>
		</LibraryContext.Provider>
	);
}

function HistoryDialog({
	api,
	open,
	close,
	onClosed,
	current,
	saved,
}: {
	readonly api: ShellApi;
	readonly open: boolean;
	readonly close: (navigating: boolean) => void;
	readonly onClosed: () => void;
	readonly current: string;
	readonly saved: ReturnType<typeof restoreLibrary>;
}) {
	return (
		<Dialog
			onOpenChange={(next) => {
				if (!next) {
					close(false);
				}
			}}
			onOpenChangeComplete={(next) => {
				if (!next) {
					onClosed();
				}
			}}
			open={open}
		>
			<DialogContent
				aria-describedby={undefined}
				className="max-h-[80dvh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-0 text-sm sm:max-w-md"
				finalFocus={false}
				id={shellIds.libraryDialog}
			>
				<DialogHeader className="px-4 pt-4 pr-12">
					<DialogTitle>Reading history</DialogTitle>
				</DialogHeader>
				<div className="min-h-0 overflow-y-auto px-2 pb-4">
					<ReadingHistory api={api} current={current} favorites={saved.favorites} onClose={() => close(true)} recents={saved.recents} />
					{saved.notice !== "" && (
						<p className="px-2 text-muted-foreground text-xs" role="status">
							{saved.notice}
						</p>
					)}
					{saved.notice === "" && saved.favorites.length + saved.recents.length === 0 && (
						<EmptyState title="No reading history">Documents you open appear here so you can return to them.</EmptyState>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

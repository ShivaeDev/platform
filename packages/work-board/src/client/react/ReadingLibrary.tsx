import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";
import { LibraryContext, restoreLibrary } from "#client/react/LibraryContext.ts";
import { HistoryDialog } from "./HistoryDialog.tsx";
import { useMainLocation } from "./MainLocationContext.ts";
import { currentTime } from "./now.ts";
import type { ShellApi } from "./ShellApi.ts";

const HISTORY_LIMIT = 30;

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
				const visit = { at: currentTime(), file, title };
				save({
					favorites: savedRef.current.favorites,
					recents: [visit, ...savedRef.current.recents.filter((item) => item.file !== file)].slice(0, HISTORY_LIMIT),
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
				onClear={() => save({ favorites: savedRef.current.favorites, recents: [] })}
				onClosed={() => {
					if (!navigatingRef.current) {
						returnFocusRef.current?.focus({ preventScroll: true });
					}
				}}
				onRemove={(file) => save({ favorites: savedRef.current.favorites, recents: savedRef.current.recents.filter((item) => item.file !== file) })}
				open={open}
				saved={saved}
			/>
		</LibraryContext.Provider>
	);
}

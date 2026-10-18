import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";
import { LibraryContext, restoreLibrary } from "#client/react/LibraryContext.ts";
import { useMainLocation } from "./MainLocationContext.ts";
import { Modal } from "./Modal.tsx";
import { ReadingHistory } from "./ReadingHistory.tsx";
import type { ShellApi } from "./ShellApi.ts";
import { shellIds } from "./shellIds.ts";

export function ReadingLibrary({
	api,
	open,
	close,
	children,
}: {
	readonly api: ShellApi;
	readonly open: boolean;
	readonly close: () => void;
	readonly children: ReactNode;
}) {
	const page = useMainLocation();
	const key = `work-board:library:${document.documentElement.dataset.workspace}`;
	const [saved, setSaved] = useState(() => restoreLibrary(key));
	const [current, setCurrent] = useState("");
	const savedRef = useRef(saved);
	const visitedRef = useRef("");
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
			<Modal close={close} id={shellIds.libraryDialog} open={open} opener="library-open" title="library-title">
				<div className="search-header">
					<h2 id={shellIds.libraryTitle}>Reading history</h2>
					<button id={shellIds.libraryClose} onClick={() => close()} type="button">
						Close
					</button>
				</div>
				<div className="reading-library" id={shellIds.readingLibrary}>
					{open ? <ReadingHistory api={api} close={close} current={current} favorites={saved.favorites} recents={saved.recents} /> : null}
					{saved.notice !== "" && (
						<p className="library-status" role="status">
							{saved.notice}
						</p>
					)}
					{saved.notice === "" && saved.favorites.length + saved.recents.length === 0 && "No recent documents yet."}
				</div>
			</Modal>
		</LibraryContext.Provider>
	);
}

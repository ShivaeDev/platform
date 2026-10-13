import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { Navigation, NavigationFolder } from "#browser/navigation/schema.ts";
import { fileUrl } from "#files/url.ts";
import { Modal } from "./Modal.tsx";
import { type Item, LibraryContext, restoreLibrary } from "./readingLibrary.ts";
import { shellIds } from "./shellIds.ts";

function paths(folder: NavigationFolder): string[] {
	return [...folder.files.map((file) => file.path), ...folder.folders.flatMap(paths)];
}
export function ReadingLibrary({
	data,
	open,
	close,
	children,
}: {
	readonly data: Navigation | undefined;
	readonly open: boolean;
	readonly close: () => void;
	readonly children: ReactNode;
}) {
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
	useEffect(() => {
		function sync() {
			const doc = document.getElementById("doc");
			if (!doc?.dataset.route) {
				return;
			}
			const file = doc.dataset.file ?? "";
			const title = doc.querySelector("h1")?.textContent?.trim() || file;
			document.title = title ? `${title} · Work Board` : "Work Board";
			const active = document.querySelector<HTMLAnchorElement>('#files a[aria-current="page"]');
			if (active) {
				active.title = title;
			}
			setCurrent(file);
			if (file && doc.querySelector("#favorite-toggle") && visitedRef.current !== `${file}:${title}`) {
				visitedRef.current = `${file}:${title}`;
				save({
					favorites: savedRef.current.favorites,
					recents: [{ file, title }, ...savedRef.current.recents.filter((item) => item.file !== file)].slice(0, 10),
				});
			}
		}
		sync();
		document.addEventListener("board-page", sync);
		document.addEventListener("board-index-change", sync);
		return () => {
			document.removeEventListener("board-page", sync);
			document.removeEventListener("board-index-change", sync);
		};
	}, [save]);
	const available = new Set(data ? [...paths(data.tree), ...data.records.files.map((file) => file.path)] : []);
	return (
		<LibraryContext.Provider
			value={{
				favorites: saved.favorites,
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
					<LibraryList available={available} close={close} current={current} items={saved.favorites} title="Favorites" />
					<LibraryList available={available} close={close} current={current} items={saved.recents} title="Recent documents" />
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
function LibraryList({
	title,
	items,
	available,
	current,
	close,
}: {
	readonly title: string;
	readonly items: readonly Item[];
	readonly available: ReadonlySet<string>;
	readonly current: string;
	readonly close: () => void;
}) {
	function handleCloseLink(event: React.MouseEvent<HTMLAnchorElement>) {
		event.currentTarget.closest("dialog")?.close("navigate");
		close();
	}

	if (items.length === 0) {
		return null;
	}
	return (
		<>
			<h2 className="nav-heading">{title}</h2>
			<ul>
				{items.map((item) => (
					<li key={item.file}>
						<a
							aria-current={item.file === current ? "page" : undefined}
							className={available.has(item.file) ? undefined : "missing"}
							href={fileUrl(item.file)}
							onClick={handleCloseLink}
						>
							{item.title}
							{available.has(item.file) ? "" : " (missing)"}
						</a>
					</li>
				))}
			</ul>
		</>
	);
}

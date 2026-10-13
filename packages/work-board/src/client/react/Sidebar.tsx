import { useEffect } from "react";
import type { Navigation } from "#browser/navigation/schema.ts";
import { InboxCount } from "./Header.tsx";
import type { MainLocation } from "./mainLocation.ts";
import { NavigationTree } from "./NavigationTree.tsx";
import { shellIds } from "./shellIds.ts";
import type { SidebarControls } from "./useSidebar.ts";

const views = [
	["overview", "Overview"],
	["work", "Work"],
	["changes", "Changes"],
	["diagnostics", "Diagnostics"],
] as const;
export function Sidebar({
	data,
	main,
	home,
	controls,
	openLibrary,
}: {
	readonly data: Navigation | undefined;
	readonly main: MainLocation;
	readonly home: boolean;
	readonly controls: SidebarControls;
	readonly openLibrary: () => void;
}) {
	useEffect(() => {
		if (!controls.open) {
			return;
		}
		const frame = requestAnimationFrame(() => {
			const selected = main.file;
			const tree = document.getElementById("files");
			const active = tree?.querySelector('a[aria-current="page"]');
			if (!(data && selected && tree && active)) {
				return;
			}
			if (active.closest("details:not([open])")) {
				return;
			}
			const bounds = tree.getBoundingClientRect();
			const row = active.getBoundingClientRect();
			if (row.top < bounds.top) {
				tree.scrollTop += row.top - bounds.top;
			} else if (row.bottom > bounds.bottom) {
				tree.scrollTop += row.bottom - bounds.bottom;
			}
		});
		return () => cancelAnimationFrame(frame);
	}, [data, main.file, controls.open]);

	useEffect(() => {
		const sidebar = document.getElementById("sidebar");
		if (controls.narrow && controls.open) {
			sidebar?.setAttribute("aria-modal", "true");
		} else {
			sidebar?.removeAttribute("aria-modal");
		}
	}, [controls.narrow, controls.open]);
	return (
		<aside
			aria-label="Workspace navigation"
			className="sidebar"
			hidden={!controls.open}
			id={shellIds.sidebar}
			role={controls.narrow && controls.open ? "dialog" : undefined}
		>
			<a className="brand" href="/">
				work board<span>Local workspace</span>
			</a>
			<nav aria-label="Workspace" className="primary-navigation" id={shellIds.primaryNavigation}>
				<a aria-current={home ? "page" : undefined} href="/" id={shellIds.homeOpen}>
					Home
				</a>
				<a aria-current={main.view === "inbox" ? "page" : undefined} className="inbox-link" href="/_board/inbox" id={shellIds.inboxOpen}>
					Inbox <InboxCount count={data?.inboxCount ?? null} id={shellIds.inboxCount} />
				</a>
				{views.map(([view, label]) => (
					<a
						aria-current={main.view === view ? "page" : undefined}
						href={`/_board/${view}${view === "work" ? "?view=board" : ""}`}
						id={`${view}-open`}
						key={view}
					>
						{label}
					</a>
				))}
			</nav>
			<button aria-controls="library-dialog" aria-haspopup="dialog" id={shellIds.libraryOpen} onClick={() => openLibrary()} type="button">
				Recent documents
			</button>
			<a className="start-open" href="/_board/start" id={shellIds.startOpen}>
				Getting started
			</a>
			<h2 className="nav-heading">Project files</h2>
			<nav aria-label="Project files" className="files" id={shellIds.files}>
				{data ? <NavigationTree current={main.view ? "" : main.file} data={data} /> : <p role="status">Loading files…</p>}
			</nav>
		</aside>
	);
}

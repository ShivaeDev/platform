import type { Navigation } from "#browser/navigation/schema.ts";
import { InboxCount } from "./Header.tsx";
import type { MainLocation } from "./mainLocation.ts";
import { NavigationTree } from "./NavigationTree.tsx";
import { shellIds } from "./shellIds.ts";

const views = [
	["overview", "Overview"],
	["work", "Work"],
	["changes", "Changes"],
	["diagnostics", "Diagnostics"],
] as const;
export function Sidebar({ data, main, home }: { readonly data: Navigation | undefined; readonly main: MainLocation; readonly home: boolean }) {
	return (
		<aside aria-label="Workspace navigation" className="sidebar" id={shellIds.sidebar}>
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
			<button aria-controls="library-dialog" aria-haspopup="dialog" disabled id={shellIds.libraryOpen} type="button">
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

import type { ReactNode } from "react";
import type { MainLocation } from "./mainLocation.ts";
import { shellIds } from "./shellIds.ts";
import type { AppearanceControls } from "./useAppearance.ts";
import type { SidebarControls } from "./useSidebar.ts";
export function InboxCount({ count, id }: { readonly count: number | null; readonly id: string }) {
	return (
		<span aria-label={`${count ?? "?"} waiting`} className="inbox-count" id={id} role="status">
			{count ?? "?"}
		</span>
	);
}
export function Header({
	main,
	count,
	appearance,
	sidebar,
	openSearch,
	live,
	updates,
	status,
}: {
	readonly main: MainLocation;
	readonly count: number | null;
	readonly appearance: AppearanceControls;
	readonly sidebar: SidebarControls;
	readonly openSearch: () => void;
	readonly live: ReactNode;
	readonly updates: ReactNode;
	readonly status: string;
}) {
	return (
		<>
			<header className="bar">
				<button aria-controls="sidebar" aria-expanded={sidebar.open} id={shellIds.sidebarToggle} onClick={() => sidebar.toggle()} type="button">
					Files
				</button>
				<Breadcrumbs file={main.file} />
				<a aria-current={main.view === "inbox" ? "page" : undefined} className="inbox-link work-open" href="/_board/inbox" id={shellIds.inboxTopbar}>
					Inbox <InboxCount count={count} id={shellIds.inboxTopbarCount} />
				</a>
				<button aria-controls="search-dialog" aria-haspopup="dialog" id={shellIds.searchOpen} onClick={() => openSearch()} type="button">
					Search <kbd>⌘/Ctrl K</kbd>
				</button>
				{live}
				<span id={shellIds.navigationStatus} role="status">
					{status}
				</span>
			</header>
			<fieldset aria-label="Reading preferences" className="preferences">
				<div className="preference">
					<label htmlFor="theme">Theme</label>
					<select id={shellIds.theme} onChange={(event) => appearance.change({ theme: event.target.value })} value={appearance.theme}>
						<option value="system">System</option>
						<option value="light">Light</option>
						<option value="dark">Dark</option>
					</select>
				</div>
				<div className="preference">
					<label htmlFor="density">Density</label>
					<select id={shellIds.density} onChange={(event) => appearance.change({ density: event.target.value })} value={appearance.density}>
						<option value="comfortable">Comfortable</option>
						<option value="compact">Compact</option>
					</select>
				</div>
				{updates}
				<span id={shellIds.preferenceStatus} role="status">
					{appearance.notice}
				</span>
			</fieldset>
		</>
	);
}

function Breadcrumbs({ file }: { readonly file: string }) {
	const parts = file.split("/");
	return (
		<nav aria-label="File location" className="breadcrumbs" id={shellIds.breadcrumbs}>
			<a href="/">Workspace</a>
			{parts.map((part, index) => (
				<span key={parts.slice(0, index + 1).join("/")}>
					<span className="separator">/</span> {part}
				</span>
			))}
		</nav>
	);
}

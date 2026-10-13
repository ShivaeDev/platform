import type { MainLocation } from "./mainLocation.ts";
import { shellIds } from "./shellIds.ts";
export function InboxCount({ count, id }: { readonly count: number | null; readonly id: string }) {
	return (
		<span aria-label={`${count ?? "?"} waiting`} className="inbox-count" id={id} role="status">
			{count ?? "?"}
		</span>
	);
}
export function Header({ main, count }: { readonly main: MainLocation; readonly count: number | null }) {
	return (
		<>
			<header className="bar">
				<button aria-controls="sidebar" aria-expanded="true" id={shellIds.sidebarToggle} type="button">
					Files
				</button>
				<Breadcrumbs file={main.file} />
				<a aria-current={main.view === "inbox" ? "page" : undefined} className="inbox-link work-open" href="/_board/inbox" id={shellIds.inboxTopbar}>
					Inbox <InboxCount count={count} id={shellIds.inboxTopbarCount} />
				</a>
				<button aria-controls="search-dialog" aria-haspopup="dialog" disabled id={shellIds.searchOpen} type="button">
					Search <kbd>⌘/Ctrl K</kbd>
				</button>
				<span className="live" id={shellIds.live} role="status">
					connecting
				</span>
				<span id={shellIds.navigationStatus} role="status" />
			</header>
			<fieldset aria-label="Reading preferences" className="preferences">
				<div className="preference">
					<label htmlFor="theme">Theme</label>
					<select defaultValue="system" id={shellIds.theme}>
						<option value="system">System</option>
						<option value="light">Light</option>
						<option value="dark">Dark</option>
					</select>
				</div>
				<div className="preference">
					<label htmlFor="density">Density</label>
					<select defaultValue="comfortable" id={shellIds.density}>
						<option value="comfortable">Comfortable</option>
						<option value="compact">Compact</option>
					</select>
				</div>
				<button aria-pressed="false" disabled id={shellIds.updatesToggle} type="button">
					Pause updates
				</button>
				<span id={shellIds.preferenceStatus} role="status" />
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

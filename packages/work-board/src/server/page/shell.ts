import { escapeHtml } from "#browser/escapeHtml.ts";
import { fileUrl } from "#files/url.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { THEME_ROUTE } from "./initialTheme.ts";
import { inboxCount } from "./nav.ts";
import { searchDialog } from "./searchDialog.ts";
import { visualDialog } from "./visualDialog.ts";

function location(file: string): string {
	return file
		.split("/")
		.map((part) => `<span>${escapeHtml(part)}</span>`)
		.join('<span class="separator">/</span>');
}

export function shell(
	title: string,
	nav: string,
	main: string,
	workspace: string,
	board: boolean,
	identity?: string,
	view: boolean | "diagnostics" | "overview" | "changes" | "start" | "response" | "handoff" | "result" | "inbox" | "library" | "goals" = false,
	snapshot?: Snapshot,
	pageTitle?: string,
): string {
	const viewName = typeof view === "string" ? view : "work";
	const viewAttribute = view ? ` data-view="${viewName}"` : "";
	const identityAttribute = identity ? ` data-identity="${escapeHtml(identity)}"` : "";
	const mainClass = board ? "board-view" : "document-view";
	const mainStart = `<main${viewAttribute}${identityAttribute} id="doc" data-file="${escapeHtml(title)}" data-url="${escapeHtml(fileUrl(title))}" class="${mainClass}" tabindex="-1">`;
	function layout(content: string) {
		return [
			'<a class="skip" href="#doc">Skip to content</a><div class="workspace">',
			'<aside id="sidebar" class="sidebar" aria-label="Workspace navigation"><a class="brand" href="/">work board<span>Local workspace</span></a>',
			`<nav id="primary-navigation" class="primary-navigation" aria-label="Workspace">${nav}</nav></aside>`,
			'<div id="sidebar-backdrop" class="sidebar-backdrop" hidden></div><div class="page"><header class="bar"><button id="sidebar-toggle" type="button" aria-controls="sidebar" aria-expanded="true">Files</button>',
			`<nav id="breadcrumbs" class="breadcrumbs" aria-label="File location"><a href="/">Workspace</a><span class="separator">/</span>${location(title)}</nav>`,
			`<a id="inbox-topbar" class="inbox-link work-open" href="/_board/inbox"${view === "inbox" ? ' aria-current="page"' : ""}>Inbox <span id="inbox-topbar-count" class="inbox-count" aria-label="${inboxCount(snapshot)} waiting">${inboxCount(snapshot)}</span></a><button id="search-open" type="button" disabled aria-haspopup="dialog" aria-controls="search-dialog">Search <kbd>⌘/Ctrl K</kbd></button><span id="live" class="live" role="status">connecting</span><span id="navigation-status" role="status"></span></header>`,
			'<div class="preferences" role="group" aria-label="Reading preferences">',
			'<div class="preference"><label for="theme">Theme</label><select id="theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div>',
			'<div class="preference"><label for="density">Density</label><select id="density"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></div>',
			'<button id="updates-toggle" type="button" aria-pressed="false" disabled>Pause updates</button><span id="preference-status" role="status"></span></div>',
			`${mainStart}${content}</main>`,
			`</div></div>${searchDialog}${visualDialog}<dialog id="library-dialog" aria-labelledby="library-title"><div class="search-header"><h2 id="library-title">Reading history</h2><button id="library-close" type="button">Close</button></div><div id="reading-library" class="reading-library"></div></dialog>`,
		].join("");
	}
	const legacy = layout(main);
	const bootstrap = view === true ? layout("") : legacy;
	return [
		`<!doctype html><html lang="en" data-workspace="${escapeHtml(workspace)}"><head><meta charset="utf-8">`,
		'<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark">',
		`<title>${escapeHtml(pageTitle ?? title)}</title>`,
		`<script src="${THEME_ROUTE}"></script>`,
		'<link rel="stylesheet" href="/_board/react.css"><link rel="stylesheet" href="/_board/style.css"><script type="module" src="/_board/react.js"></script>',
		`</head><body><noscript data-board-fallback><style>html:not([data-js]) figure.diagram .diagram-source{display:block}html:not([data-js]) figure.diagram[data-state="pending"]{min-height:0}</style>${legacy}</noscript>`,
		`<div data-board-react-root></div><template id="board-legacy-page">${bootstrap}</template></body></html>`,
	].join("");
}

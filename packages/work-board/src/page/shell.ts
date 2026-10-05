import { fileUrl } from "#files/url.ts";
import { escapeHtml } from "./escape.ts";
import { searchDialog } from "./searchDialog.ts";

function location(file: string): string {
	return file
		.split("/")
		.map((part) => `<span>${escapeHtml(part)}</span>`)
		.join('<span class="separator">/</span>');
}

export const shell = (title: string, nav: string, main: string, workspace: string, board: boolean, identity?: string): string =>
	[
		`<!doctype html><html lang="en" data-workspace="${escapeHtml(workspace)}"><head><meta charset="utf-8">`,
		'<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark">',
		`<title>${escapeHtml(title)}</title>`,
		'<link rel="stylesheet" href="/_board/style.css"><script type="module" src="/_board/client.js"></script>',
		'</head><body><a class="skip" href="#doc">Skip to content</a><div class="workspace">',
		'<aside id="sidebar" class="sidebar"><a class="brand" href="/">work board<span>Local workspace</span></a>',
		'<div id="reading-library" class="reading-library" hidden></div><h2 class="nav-heading">Project files</h2>',
		`<nav id="files" class="files" aria-label="Project files">${nav}</nav></aside>`,
		'<div class="page"><header class="bar"><button id="sidebar-toggle" type="button" aria-controls="sidebar" aria-expanded="true">Files</button>',
		`<nav id="breadcrumbs" class="breadcrumbs" aria-label="File location"><a href="/">Workspace</a><span class="separator">/</span>${location(title)}</nav>`,
		'<button id="search-open" type="button" disabled aria-haspopup="dialog" aria-controls="search-dialog">Search <kbd>⌘/Ctrl K</kbd></button><span id="live" class="live" role="status">connecting</span><span id="navigation-status" role="status"></span></header>',
		'<div class="preferences" role="group" aria-label="Reading preferences">',
		'<div class="preference"><label for="theme">Theme</label><select id="theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div>',
		'<div class="preference"><label for="density">Density</label><select id="density"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></div>',
		'<span id="preference-status" role="status"></span></div>',
		`<main${identity ? ` data-identity="${escapeHtml(identity)}"` : ""} id="doc" data-file="${escapeHtml(title)}" data-url="${escapeHtml(fileUrl(title))}" class="${board ? "board-view" : "document-view"}" tabindex="-1">${main}</main>`,
		`</div></div>${searchDialog}</body></html>`,
	].join("");

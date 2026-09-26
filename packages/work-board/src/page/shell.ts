import { escapeHtml } from "./escape.ts";

export const shell = (title: string, nav: string, main: string): string =>
	[
		'<!doctype html><html lang="en"><head><meta charset="utf-8">',
		'<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark">',
		`<title>${escapeHtml(title)}</title>`,
		'<link rel="stylesheet" href="/_board/style.css"><script type="module" src="/_board/client.js"></script>',
		'</head><body><div class="page"><header class="bar">',
		`<nav id="files" class="files">${nav}</nav><span id="live" class="live">connecting</span></header>`,
		`<main id="doc">${main}</main></div></body></html>`,
	].join("");

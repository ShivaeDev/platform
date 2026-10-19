import { escapeHtml } from "#browser/escapeHtml.ts";
import { THEME_ROUTE } from "./initialTheme.ts";

export function shell(title: string, workspace: string): string {
	return [
		`<!doctype html><html lang="en" data-workspace="${escapeHtml(workspace)}"><head><meta charset="utf-8">`,
		'<meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content"><meta name="color-scheme" content="light dark">',
		`<title>${escapeHtml(title)}</title><script src="${THEME_ROUTE}"></script>`,
		'<link rel="stylesheet" href="/_board/react.css"><script type="module" src="/_board/react.js"></script>',
		'</head><body><div data-board-react-root><div aria-hidden="true" data-board-skeleton><aside></aside><div><header></header></div><nav></nav></div></div>',
		"</body></html>",
	].join("");
}

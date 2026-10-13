export interface SearchItem {
	readonly command?: string;
	readonly file?: string;
	readonly href?: string;
	readonly kind: string;
	readonly line?: number | undefined;
	readonly snippet?: string;
	readonly title: string;
}
export const searchCommands: readonly SearchItem[] = [
	{ href: "/", kind: "command", title: "Open workspace" },
	{ command: "sidebar-toggle", kind: "command", title: "Show or hide files" },
	{ command: "density", kind: "command", title: "Toggle compact density" },
	{ command: "theme", kind: "command", title: "Toggle light or dark theme" },
];

import type { GoalsProjection } from "#browser/views/GoalsProjection.ts";

export interface SearchItem {
	readonly command?: string;
	readonly file?: string;
	readonly href?: string;
	readonly id?: string | undefined;
	readonly itemKind?: string | undefined;
	readonly kind: string;
	readonly line?: number | undefined;
	readonly snippet?: string;
	readonly status?: string | undefined;
	readonly title: string;
}
export const searchCommands: readonly SearchItem[] = [
	{ href: "/", kind: "command", title: "Open workspace" },
	{ href: "/_board/inbox", kind: "command", title: "Go to Today" },
	{ href: "/_board/goals", kind: "command", title: "Go to Goals" },
	{ href: "/_board/work?view=board", kind: "command", title: "Go to Now" },
	{ href: "/_board/library", kind: "command", title: "Go to Library" },
	{ href: "/_board/diagnostics", kind: "command", title: "Go to System" },
	{ command: "sidebar-toggle", kind: "command", title: "Show or hide files" },
	{ command: "density", kind: "command", title: "Toggle compact density" },
	{ command: "theme", kind: "command", title: "Toggle light or dark theme" },
];

export function goalCommands(goals: GoalsProjection["goals"]): readonly SearchItem[] {
	return goals.map((goal) => ({
		href: `/_board/item/${encodeURIComponent(goal.id)}/`,
		id: goal.id,
		kind: "command",
		title: `Go to ${goal.title}`,
	}));
}
export function matchingCommands(goals: GoalsProjection["goals"], query: string): readonly SearchItem[] {
	const terms = query.normalize("NFKC").toLowerCase().split(/\s+/u).filter(Boolean);
	return [...searchCommands, ...goalCommands(goals)].filter((item) => {
		const text = `${item.title} ${item.id ?? ""}`.normalize("NFKC").toLowerCase();
		return terms.every((term) => text.includes(term));
	});
}

import { nameMatch, type SearchMatch } from "#browser/search/nameMatch.ts";
import type { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import type { InboxProjection } from "#browser/views/schema.ts";
import type { AppearanceControls } from "#client/react/useAppearance.ts";

export interface SearchItem {
	readonly command?: string;
	readonly file?: string;
	readonly href?: string;
	readonly id?: string | undefined;
	readonly itemKind?: string | undefined;
	readonly kind: string;
	readonly line?: number | undefined;
	readonly match?: SearchMatch;
	readonly snippet?: string;
	readonly status?: string | undefined;
	readonly title: string;
}
export const searchCommands: readonly SearchItem[] = [
	{ href: "/", kind: "command", title: "Go to Today" },
	{ href: "/_board/goals", kind: "command", title: "Go to Goals" },
	{ href: "/_board/work?view=board", kind: "command", title: "Go to Now" },
	{ href: "/_board/library", kind: "command", title: "Go to Library" },
	{ href: "/_board/system", kind: "command", title: "Go to System" },
	{ command: "sidebar-toggle", kind: "command", title: "Show or hide files" },
	{ command: "density", kind: "command", title: "Toggle compact density" },
	{ command: "theme", kind: "command", title: "Toggle light or dark theme" },
];

function goalCommand(goal: GoalsProjection["goals"][number]): SearchItem {
	return { href: `/_board/item/${encodeURIComponent(goal.id)}/`, id: goal.id, kind: "command", title: `Go to ${goal.title}` };
}
export function needsYouCommands(inbox: InboxProjection | undefined): readonly SearchItem[] {
	if (!inbox?.complete) {
		return [];
	}
	return inbox.you.map((item) => ({ href: item.href, kind: "needs-you", snippet: item.problem ?? item.reason, title: item.title }));
}
export function matchingCommands(goals: GoalsProjection["goals"], query: string): readonly SearchItem[] {
	const terms = query.normalize("NFKC").toLowerCase().split(/\s+/u).filter(Boolean);
	const named = [
		...searchCommands.map((item) => ({ item, name: item.title })),
		...goals.map((goal) => ({ item: goalCommand(goal), name: goal.title })),
	];
	return named
		.filter(({ item }) => {
			const text = `${item.title} ${item.id ?? ""}`.normalize("NFKC").toLowerCase();
			return terms.every((term) => text.includes(term));
		})
		.map(({ item, name }) => ({ ...item, match: nameMatch(name, item.id, query) ?? "title" }));
}

export function activateCommand(command: string | undefined, appearance: AppearanceControls, toggleSidebar: () => void) {
	if (command === "sidebar-toggle") {
		toggleSidebar();
	}
	if (command === "density") {
		appearance.change({ density: appearance.density === "compact" ? "comfortable" : "compact" });
	}
	if (command === "theme") {
		appearance.change({ theme: appearance.theme === "dark" ? "light" : "dark" });
	}
}

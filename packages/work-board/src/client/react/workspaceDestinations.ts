export const workspaceDestinations = [
	{ href: "/", id: "home-open", label: "Today", view: "today" },
	{ href: "/_board/goals", id: "goals-open", label: "Goals", view: "goals" },
	{ href: "/_board/work", id: "work-open", label: "Now", view: "work" },
	{ href: "/_board/pull-requests", id: "pull-requests-open", label: "Pull requests", view: "pull-requests" },
	{ href: "/_board/library", id: "documents-open", label: "Library", view: "library" },
	{ href: "/_board/system", id: "diagnostics-open", label: "System", view: "system" },
] as const;

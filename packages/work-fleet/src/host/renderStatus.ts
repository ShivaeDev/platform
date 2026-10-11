import type { FleetViews } from "#model.ts";

type View = (typeof FleetViews.Type)["active"][number];

function line(view: View) {
	const detail = view.blocker === undefined ? "" : `  ${view.blocker}`;
	const links = [...view.links, ...view.sessions.map((session) => `session ${session.sessionId} turn ${session.turnId}`)];
	return `  ${view.workId}  ${view.stage}${detail}${links.length === 0 ? "" : `  (${links.join(", ")})`}`;
}

export function renderStatus(current: typeof FleetViews.Type): string {
	const sections: readonly [string, readonly View[]][] = [
		["Active", current.active],
		["Waiting on maintainer", current.waiting.maintainer],
		["Waiting on orchestrator", current.waiting.orchestrator],
		["Waiting on automation", current.waiting.automation],
		["Completed", current.completed],
	];
	return sections.map(([title, items]) => [`${title} (${items.length})`, ...items.map(line)].join("\n")).join("\n");
}

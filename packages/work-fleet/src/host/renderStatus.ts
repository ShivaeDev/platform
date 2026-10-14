import { diagnostics as diagnosticsApi } from "@shivaedev/work-board/integration/diagnostics.ts";
import type { FleetViews } from "#model.ts";

const { DAEMON_PORT } = diagnosticsApi;

type View = (typeof FleetViews.Type)["active"][number];

function line(view: View, waiting: boolean, port: number) {
	const reason = view.decision?.reason ?? view.blocker;
	const detail = reason === undefined ? "" : `  ${reason}`;
	const links = [...view.links, ...view.sessions.map((session) => `session ${session.sessionId} turn ${session.turnId}`)];
	const answer = waiting ? `\n    work-fleet answer ${view.workId}${port === DAEMON_PORT ? "" : ` --port ${port}`}` : "";
	return `  ${view.workId}  ${view.stage}${detail}${links.length === 0 ? "" : `  (${links.join(", ")})`}${answer}`;
}

export function renderStatus(current: typeof FleetViews.Type, port: number = DAEMON_PORT): string {
	const sections: readonly [string, readonly View[]][] = [
		["Active", current.active],
		["Waiting on maintainer", current.waiting.maintainer],
		["Waiting on orchestrator", current.waiting.orchestrator],
		["Waiting on automation", current.waiting.automation],
		["Completed", current.completed],
	];
	return sections
		.map(([title, items]) => [`${title} (${items.length})`, ...items.map((item) => line(item, title.startsWith("Waiting"), port))].join("\n"))
		.join("\n");
}

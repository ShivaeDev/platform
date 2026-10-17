import { diagnostics as diagnosticsApi } from "@shivaedev/work-board/integration/diagnostics.ts";
import { sessionStatus } from "#engine/sessionStatus.ts";
import { type DaemonStatus, renderConfig } from "#host/configSettings.ts";
import type { FleetViews } from "#model.ts";

const { DAEMON_PORT } = diagnosticsApi;

type View = (typeof FleetViews.Type)["active"][number];

function line(view: View, waiting: boolean, port: number) {
	const reason = view.blocker ?? view.decision?.reason;
	const detail = reason === undefined ? "" : `  ${reason}`;
	const links = [...view.links, ...view.sessions.map(sessionStatus)];
	const answer = waiting ? `\n    work-fleet answer ${view.workId}${port === DAEMON_PORT ? "" : ` --port ${port}`}` : "";
	return `  ${view.workId}  ${view.stage}${detail}${links.length === 0 ? "" : `  (${links.join(", ")})`}${answer}`;
}

export function renderStatus(current: typeof DaemonStatus.Type, port: number = DAEMON_PORT): string {
	const sections: readonly [string, readonly View[]][] = [
		["Active", current.active],
		["Waiting on maintainer", current.waiting.maintainer],
		["Waiting on orchestrator", current.waiting.orchestrator],
		["Waiting on automation", current.waiting.automation],
		["Completed", current.completed],
	];
	const rendered = sections
		.map(([title, items]) =>
			[
				`${title} (${items.length})`,
				...items.map((item) => line(item, title === "Waiting on maintainer" || title === "Waiting on orchestrator", port)),
			].join("\n"),
		)
		.join("\n");
	const dispatches = current.dispatches ?? [];
	const views =
		dispatches.length === 0
			? rendered
			: `${rendered}\nDispatches (${dispatches.length})\n${dispatches.map((request) => `  ${request.workId}  dispatch ${request.status}${request.error === undefined ? "" : `: ${request.error}`}`).join("\n")}`;
	return current.config === undefined ? views : `${views}\n${renderConfig(current.config)}`;
}

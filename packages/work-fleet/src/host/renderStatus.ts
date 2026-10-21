import { sessionStatus } from "#engine/sessionStatus.ts";
import { type DaemonStatus, renderConfig } from "#host/configSettings.ts";
import type { FleetViews } from "#model.ts";

type View = (typeof FleetViews.Type)["active"][number];

function line(view: View, waiting: boolean, selection: string) {
	const reason = view.blocker ?? view.decision?.reason ?? (view.overLimit ? "launched over the limit" : undefined);
	const detail = reason === undefined ? "" : `  ${reason}`;
	const links = [...(view.recovery === undefined ? [] : [view.recovery]), ...view.links, ...view.sessions.map(sessionStatus)];
	const answer = waiting ? `\n    work-fleet answer ${view.workId}${selection}` : "";
	return `  ${view.workId}  ${view.stage}${detail}${links.length === 0 ? "" : `  (${links.join(", ")})`}${answer}`;
}

export function renderStatus(current: typeof DaemonStatus.Type, selection: { readonly board?: string; readonly port?: number } = {}): string {
	const board = selection.board === undefined || selection.board === ".work" ? "" : ` --board '${selection.board.replaceAll("'", "'\\''")}'`;
	const endpoint = `${board}${selection.port === undefined ? "" : ` --port ${selection.port}`}`;
	const sections: readonly [string, readonly View[]][] = [
		["Active", current.active],
		["Waiting on you", current.waiting.maintainer],
		["Waiting on orchestrator", current.waiting.orchestrator],
		["Waiting on automation", current.waiting.automation],
		["Done", current.completed],
	];
	const rendered = sections
		.map(([title, items]) =>
			[
				`${title} (${items.length})`,
				...items.map((item) => line(item, title === "Waiting on you" || title === "Waiting on orchestrator", endpoint)),
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

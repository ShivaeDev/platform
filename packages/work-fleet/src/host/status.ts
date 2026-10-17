import { Effect } from "effect";
import { views } from "#engine/views.ts";
import { answerRecords } from "#host/answerRecords.ts";
import type { FleetHost } from "#host/config.ts";
import { renderStatus as render } from "#host/renderStatus.ts";
import { dispatchStore } from "#storage/dispatchStore.ts";

export function renderStatus(current: Parameters<typeof render>[0]) {
	return render(current);
}

export const fleetStatus = Effect.fn("FleetHost.fleetStatus")(function* (host: FleetHost, workId?: string) {
	const records = yield* answerRecords(host.namespace, workId);
	const requests = yield* (yield* dispatchStore(host.namespace)).list(workId);
	const dispatches = requests.filter((request) => request.status !== "completed");
	return dispatches.length === 0 ? views(records) : { ...views(records), dispatches };
});

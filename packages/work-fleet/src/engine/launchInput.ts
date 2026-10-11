import { Effect } from "effect";
import { launchReceipt } from "#engine/launchReceipt.ts";
import type { FleetRecord } from "#model.ts";

export const launchInput = Effect.fn("Fleet.launchInput")(function* (
	record: FleetRecord,
	requestedRole: "worker" | "repair",
	continuationSessionId?: string,
) {
	const latest = record.attempts.at(-1);
	const emptySession =
		latest?.role !== "reviewer" && latest?.status === "failed" && latest.receipt === undefined && !latest.sessionCleanupComplete
			? latest.sessionId
			: undefined;
	const retry = record.launchRetry === undefined ? undefined : record.attempts.at(-1);
	const role = retry?.role === "worker" || retry?.role === "repair" ? retry.role : requestedRole;
	const original = yield* launchReceipt(record, role);
	return {
		prompt: retry?.prompt,
		role,
		sessionId:
			continuationSessionId
			?? emptySession
			?? (retry?.sessionId === original?.sessionId ? retry?.sessionId : undefined)
			?? (role === "repair" ? original?.sessionId : undefined),
		settings: retry?.settings,
	};
});

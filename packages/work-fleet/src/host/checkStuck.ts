import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { BoardGateway, FleetIntegrations } from "#policy.ts";

export const checkStuck = Effect.fn("FleetDaemon.checkStuck")(function* (workId: string) {
	const fleet = yield* Fleet;
	const stored = yield* fleet.get(workId);
	if (stored.value.step !== "working" || stored.value.deliverable === "report") {
		return false;
	}
	const integrations = yield* FleetIntegrations;
	if (integrations.publication === undefined) {
		return false;
	}
	const board = yield* BoardGateway;
	const publication = yield* integrations.publication(yield* board.get(workId, { fresh: true }));
	if (publication.pullRequest === undefined || publication.pullRequestState !== "open") {
		return false;
	}
	yield* fleet.reconcile(workId);
	return true;
});

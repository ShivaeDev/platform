import { Clock, Effect } from "effect";
import { Forbidden } from "@shivaedev/errors/taxonomy.ts";
import { inBoardReadPass } from "#board/readPass.ts";
import type { DispatchRequest } from "#DispatchRequest.ts";
import { STOP_REASON } from "#engine/stopCommand.ts";
import { Fleet } from "#fleet.ts";
import { BoardFailure, BoardGateway, FleetIntegrations } from "#policy.ts";

export function stopDispatchWork<E>(cancel: (workId: string, reason: string) => Effect.Effect<DispatchRequest | undefined, E>) {
	return Effect.fn("FleetDaemon.stopWork")(function* (workId: string, reason = `${STOP_REASON} by orchestrator.`) {
		const fleet = yield* Fleet;
		const before = yield* fleet.get(workId).pipe(Effect.catchTag("NotFound", () => Effect.succeed(undefined)));
		if (before !== undefined && ["done", "released"].includes(before.value.step)) {
			return (yield* fleet.stop(workId)).value;
		}
		const request = yield* cancel(workId, reason);
		const current = yield* fleet.get(workId).pipe(Effect.catchTag("NotFound", () => Effect.succeed(undefined)));
		if (current !== undefined || request === undefined) {
			return (yield* fleet.stop(workId)).value;
		}
		if (request.status === "cancelled") {
			return yield* new Forbidden({ message: `Cannot stop ${workId}: work is released` });
		}
		return yield* closePreparation(workId, request.id, reason);
	});
}

const closePreparation = Effect.fn("FleetDaemon.closePreparation")(function* (workId: string, requestId: string, reason: string) {
	const board = yield* BoardGateway;
	const integrations = yield* FleetIntegrations;
	const work = yield* board.get(workId);
	const publication = integrations.publication === undefined ? undefined : yield* integrations.publication(work);
	const closing = `${reason}${publication?.pullRequest === undefined ? "" : ` Pull request preserved: ${publication.pullRequest}`}`;
	const decision = {
		code: "fleet-invalid" as const,
		id: `stop.${requestId}`,
		links: [],
		reason: closing,
		recommendation: "No worker will launch for this dispatch",
	};
	const published = yield* board.decision(workId, decision, work);
	if (board.respond === undefined) {
		return yield* new BoardFailure({ message: "Board gateway must support recording the closing response" });
	}
	const responseId = yield* board.respond({ ...decision, published }, "release", closing);
	yield* board
		.acknowledgeDecision({ decision: published, disposition: "applied", recordedAt: yield* Clock.currentTimeMillis, responseId })
		.pipe(Effect.mapError((error) => new BoardFailure({ message: error.message })));
	return { releaseReason: closing, stage: "released" as const, workId };
}, inBoardReadPass);

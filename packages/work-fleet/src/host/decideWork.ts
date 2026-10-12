import { Effect } from "effect";
import { BadRequest, Conflict } from "@shivaedev/platform/errors/taxonomy.ts";
import { Fleet } from "#fleet.ts";
import type { FleetHost } from "#host/config.ts";
import { recordDecisionResponse } from "#host/recordDecisionResponse.ts";
import { withDecisionResponses } from "#host/releaseWork.ts";

export function decideWork(host: FleetHost, workId: string, action: "retry" | "release") {
	return withDecisionResponses(
		host,
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			const stored = yield* fleet.get(workId);
			const decision = stored.value.decision;
			if (stored.value.stage !== "needs-human" || decision?.published === undefined) {
				return yield* Effect.fail(new Conflict({ message: "Answer an open published Fleet decision" }));
			}
			if (action === "retry" && decision.worker !== undefined) {
				return yield* Effect.fail(new BadRequest({ message: "Answer the worker question or use continue with a message" }));
			}
			const responseId = yield* recordDecisionResponse(host.boardDir, { ...decision, published: decision.published }, action);
			return yield* fleet.resolve(workId, decision.id, responseId);
		}),
	);
}

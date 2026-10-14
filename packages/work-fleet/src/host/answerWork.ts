import { Effect } from "effect";
import { BadRequest } from "@shivaedev/platform/errors/taxonomy.ts";
import { Fleet } from "#fleet.ts";
import type { FleetHost } from "#host/config.ts";
import { recordDecisionResponse } from "#host/recordDecisionResponse.ts";
import { withDecisionResponses } from "#host/releaseWork.ts";

export function answerWork(host: FleetHost, workId: string, text = "", release = false) {
	return withDecisionResponses(
		host,
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			const current = yield* fleet.get(workId);
			if (current.value.stage !== "needs-human" || current.value.decision === undefined) {
				return yield* Effect.fail(new BadRequest({ message: `${workId} waits on no answer in stage ${current.value.stage}` }));
			}
			if (!release && current.value.decision.worker !== undefined && !text.trim()) {
				return yield* Effect.fail(new BadRequest({ message: "Supply a nonempty answer for the worker as text or on stdin" }));
			}
			const stored = yield* fleet.publishDecision(workId);
			const decision = stored.value.decision;
			if (decision?.published === undefined) {
				return yield* Effect.fail(new BadRequest({ message: `${workId} has no published question in stage ${stored.value.stage}` }));
			}
			const responseId = yield* recordDecisionResponse(
				host.boardDir,
				{ ...decision, published: decision.published },
				release ? "release" : "retry",
				text,
			);
			return yield* fleet.resolve(workId, decision.id, responseId);
		}),
	);
}

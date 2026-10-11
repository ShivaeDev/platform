import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { watchChanges } from "@shivaedev/work-board/files/changes.ts";
import { responseService } from "@shivaedev/work-board/responses/service.ts";
import { searchSnapshot } from "@shivaedev/work-board/search/snapshot.ts";
import { Fleet } from "#fleet.ts";
import { type HostParts, hostLayer, productionParts } from "#host/commands.ts";
import type { FleetHost } from "#host/config.ts";
import { recordDecisionResponse } from "#host/recordDecisionResponse.ts";
import { executing } from "#model.ts";
import { FleetFailure } from "#policy.ts";

export function releaseWork(host: FleetHost, workIds: readonly string[], parts: HostParts = productionParts(host)) {
	return releaseItems(host, workIds).pipe(Effect.provide(hostLayer(host, parts)));
}

export function releaseItems(host: FleetHost, workIds: readonly string[]) {
	return withDecisionResponses(host, (responses) => Effect.forEach(workIds, releaseItem(host.boardDir, responses)));
}

export function withDecisionResponses<A, E, R>(
	host: FleetHost,
	use: (responses: Effect.Success<ReturnType<typeof responseService>>) => Effect.Effect<A, E, R>,
) {
	return Effect.scoped(
		Effect.gen(function* () {
			const changes = yield* watchChanges(host.boardDir);
			const read = yield* searchSnapshot(host.boardDir, undefined, changes);
			const index = read.pipe(Effect.provide(NodeServices.layer));
			const responses = yield* responseService({ changes, enabled: true, index, root: host.boardDir });
			return yield* use(responses);
		}),
	);
}

function releaseItem(root: string, responses: Effect.Success<ReturnType<typeof responseService>>) {
	return Effect.fn("FleetHost.releaseItem")(function* (workId: string) {
		const fleet = yield* Fleet;
		let stored = yield* fleet.get(workId);
		if (stored.value.stage === "released") {
			return yield* fleet.reconcile(workId);
		}
		if (stored.value.stage !== "needs-human" || executing(stored.value)) {
			return yield* Effect.fail(new FleetFailure({ message: "Only terminal needs-human work can be released", reason: "denied" }));
		}
		if (stored.value.decision?.published === undefined) {
			stored = yield* fleet.reconcile(workId);
		}
		const decision = stored.value.decision;
		if (decision?.published === undefined) {
			return yield* Effect.fail(new FleetFailure({ message: "Publish the waiting decision before release", reason: "stale" }));
		}
		const responseId = yield* recordDecisionResponse(root, responses, { ...decision, published: decision.published }, "release");
		return yield* fleet.resolve(workId, decision.id, responseId);
	});
}

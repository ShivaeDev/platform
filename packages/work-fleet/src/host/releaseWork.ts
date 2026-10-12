import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer } from "effect";
import { Conflict, Forbidden } from "@shivaedev/platform/errors/taxonomy.ts";
import { watchChanges } from "@shivaedev/work-board/files/changes.ts";
import { ResponseConfig, Responses } from "@shivaedev/work-board/responses/service.ts";
import { searchSnapshot } from "@shivaedev/work-board/search/snapshot.ts";
import { Fleet } from "#fleet.ts";
import { type HostParts, hostLayer, productionParts } from "#host/commands.ts";
import type { FleetHost } from "#host/config.ts";
import { recordDecisionResponse } from "#host/recordDecisionResponse.ts";
import { executing } from "#model.ts";

export function releaseWork(host: FleetHost, workIds: readonly string[], parts: HostParts = productionParts(host)) {
	return releaseItems(host, workIds).pipe(Effect.provide(hostLayer(host, parts)));
}

export function releaseItems(host: FleetHost, workIds: readonly string[]) {
	return withDecisionResponses(host, Effect.forEach(workIds, releaseItem(host.boardDir)));
}

export function withDecisionResponses<A, E, R>(host: FleetHost, effect: Effect.Effect<A, E, R>) {
	return Effect.scoped(
		Effect.gen(function* () {
			const changes = yield* watchChanges(host.boardDir);
			const read = yield* searchSnapshot(host.boardDir, undefined, changes);
			const index = read.pipe(Effect.provide(NodeServices.layer));
			return yield* effect.pipe(
				Effect.provide(Responses.layer.pipe(Layer.provide(Layer.succeed(ResponseConfig, { changes, enabled: true, index, root: host.boardDir })))),
			);
		}),
	);
}

function releaseItem(root: string) {
	return Effect.fn("FleetHost.releaseItem")(function* (workId: string) {
		const fleet = yield* Fleet;
		let stored = yield* fleet.get(workId);
		if (stored.value.stage === "released") {
			return yield* fleet.reconcile(workId);
		}
		if (stored.value.stage !== "needs-human" || executing(stored.value)) {
			return yield* Effect.fail(new Forbidden({ message: "Only terminal needs-human work can be released" }));
		}
		if (stored.value.decision?.published === undefined) {
			stored = yield* fleet.reconcile(workId);
		}
		const decision = stored.value.decision;
		if (decision?.published === undefined) {
			return yield* Effect.fail(new Conflict({ message: "Publish the waiting decision before release" }));
		}
		const responseId = yield* recordDecisionResponse(root, { ...decision, published: decision.published }, "release");
		return yield* fleet.resolve(workId, decision.id, responseId);
	});
}

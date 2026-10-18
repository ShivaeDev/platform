import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer } from "effect";
import { Conflict, Forbidden } from "@shivaedev/platform/errors/taxonomy.ts";
import { board } from "@shivaedev/work-board/integration/board.ts";
import { responses } from "@shivaedev/work-board/integration/responses.ts";
import { Fleet } from "#fleet.ts";
import { type HostParts, hostLayer, productionParts } from "#host/commands.ts";
import type { FleetHost } from "#host/config.ts";
import { recordDecisionResponse } from "#host/recordDecisionResponse.ts";
import { executing } from "#model.ts";

const { searchSnapshot, watchChanges } = board;
const { Responses, Workspace, WorkspaceConfig } = responses;

export function releaseWork(host: FleetHost, workIds: readonly string[], parts: HostParts = productionParts(host)) {
	return withDecisionResponses(host, releaseItems(host, workIds)).pipe(Effect.provide(hostLayer(host, parts)));
}

export function releaseItems(host: FleetHost, workIds: readonly string[]) {
	return Effect.forEach(workIds, releaseItem(host.boardDir));
}

// Indexing a large Board takes seconds, so the watched index starts warming at once and later responses read only changed files.
export function decisionResponses(host: FleetHost) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const changes = yield* watchChanges(host.boardDir);
			const index = (yield* searchSnapshot(host.boardDir, undefined, changes)).pipe(Effect.provide(NodeServices.layer));
			yield* index.pipe(Effect.ignore, Effect.forkScoped);
			return Responses.layer.pipe(
				Layer.provide(Workspace.layer),
				Layer.provide(Layer.succeed(WorkspaceConfig, { changes, index, root: host.boardDir, writable: true })),
			);
		}),
	);
}

export function withDecisionResponses<A, E, R>(host: FleetHost, effect: Effect.Effect<A, E, R>) {
	return effect.pipe(Effect.provide(decisionResponses(host)));
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

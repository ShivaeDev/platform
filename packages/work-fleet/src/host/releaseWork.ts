import { Effect, Layer } from "effect";
import { Conflict, Forbidden } from "@shivaedev/errors/taxonomy.ts";
import { responses } from "@shivaedev/work-board/server/integration/responses.ts";
import { workspaceLayer } from "@shivaedev/work-board/server/workspaceLayer.ts";
import { Fleet } from "#fleet.ts";
import { type HostParts, hostLayer, productionParts } from "#host/commands.ts";
import type { FleetHost } from "#host/config.ts";
import { recordDecisionResponse } from "#host/recordDecisionResponse.ts";

const { Responses, Workspace } = responses;

export function releaseWork(host: FleetHost, workIds: readonly string[], parts: HostParts = productionParts(host)) {
	return withDecisionResponses(host, releaseItems(host, workIds)).pipe(Effect.provide(hostLayer(host, parts)));
}

export function releaseItems(host: FleetHost, workIds: readonly string[], background = false) {
	return Effect.forEach(workIds, releaseItem(host.boardDir, background));
}

export function decisionResponses(host: FleetHost) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const current = yield* Effect.serviceOption(Workspace);
			const workspace = current._tag === "Some" ? Layer.succeed(Workspace, current.value) : workspaceLayer({ root: host.boardDir, writable: true });
			return Responses.layer.pipe(Layer.provide(workspace));
		}),
	);
}

export function withDecisionResponses<A, E, R>(host: FleetHost, effect: Effect.Effect<A, E, R>) {
	return effect.pipe(Effect.provide(decisionResponses(host)));
}

function releaseItem(root: string, background: boolean) {
	return Effect.fn("FleetHost.releaseItem")(function* (workId: string) {
		const fleet = yield* Fleet;
		let stored = yield* fleet.get(workId);
		if (stored.value.step === "released") {
			return yield* background ? Effect.succeed(stored) : fleet.reconcile(workId);
		}
		if (stored.value.step !== "waiting") {
			return yield* Effect.fail(
				new Forbidden({ message: `Only waiting work can be released; use work-fleet stop ${workId} to interrupt running work` }),
			);
		}
		if (stored.value.decision?.published === undefined) {
			stored = yield* fleet.reconcile(workId);
		}
		const decision = stored.value.decision;
		if (decision?.published === undefined) {
			return yield* Effect.fail(new Conflict({ message: "Publish the waiting decision before release" }));
		}
		const released = yield* fleet.releaseClosed(workId, decision.id);
		if (released !== undefined) {
			return released;
		}
		const responseId = yield* recordDecisionResponse(root, { ...decision, published: decision.published }, "release");
		return yield* background ? fleet.recordResponse(workId, decision.id, responseId) : fleet.resolve(workId, decision.id, responseId);
	});
}

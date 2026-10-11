import * as NodeServices from "@effect/platform-node/NodeServices";
import { Clock, Effect, FileSystem, Layer } from "effect";
import { watchChanges } from "@shivaedev/work-board/files/changes.ts";
import { makeResponse } from "@shivaedev/work-board/responses/make.ts";
import { publish } from "@shivaedev/work-board/responses/publish.ts";
import { responseMarkdown } from "@shivaedev/work-board/responses/records.ts";
import { ResponseConfig, Responses } from "@shivaedev/work-board/responses/service.ts";
import { searchSnapshot } from "@shivaedev/work-board/search/snapshot.ts";
import type { BoardDecision } from "#board/schema.ts";
import { Fleet } from "#fleet.ts";
import { type HostParts, hostLayer, productionParts } from "#host/commands.ts";
import type { FleetHost } from "#host/config.ts";
import { executing } from "#model.ts";
import { BoardGateway, type Decision, FleetFailure } from "#policy.ts";

export function releaseWork(host: FleetHost, workIds: readonly string[], parts: HostParts = productionParts(host)) {
	return Effect.scoped(
		Effect.gen(function* () {
			const changes = yield* watchChanges(host.boardDir);
			const read = yield* searchSnapshot(host.boardDir, undefined, changes);
			const index = read.pipe(Effect.provide(NodeServices.layer));
			return yield* Effect.forEach(workIds, releaseItem(host.boardDir)).pipe(
				Effect.provide(Responses.layer.pipe(Layer.provide(Layer.succeed(ResponseConfig, { changes, enabled: true, index, root: host.boardDir })))),
			);
		}),
	).pipe(Effect.provide(hostLayer(host, parts)));
}

function releaseItem(root: string) {
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
		const responseId = yield* recordRelease(root, { ...decision, published: decision.published });
		return yield* fleet.resolve(workId, decision.id, responseId);
	});
}

const recordRelease = Effect.fn("FleetHost.recordRelease")(function* (root: string, decision: Decision & { readonly published: BoardDecision }) {
	const responses = yield* Responses;
	const board = yield* BoardGateway;
	const published = decision.published;
	const reading = yield* board.readDecision(published);
	if (reading._tag === "Stale" || reading._tag === "Ambiguous") {
		return yield* Effect.fail(new FleetFailure({ message: "Reconcile the exact decision response before release", reason: "stale" }));
	}
	const id = `response.fleet-release.${published.questionId}`;
	if (reading._tag === "Response" && reading.response.id === id) {
		return id;
	}
	const input = {
		answers: [{ prompt: "fleet-action", selected: ["release"], text: "" }],
		author: "orchestrator",
		body: "Release Fleet ownership.",
		id,
		question: published.questionId,
		...(reading._tag === "Response" ? { supersedes: reading.response.id } : {}),
		type: "answer" as const,
	};
	if (decision.worker === undefined) {
		return (yield* responses.record(input)).id;
	}
	const question = (yield* responses.read(published.questionId)).question;
	const response = makeResponse(input, question, yield* Clock.currentTimeMillis);
	const fs = yield* FileSystem.FileSystem;
	const realRoot = yield* fs.realPath(root);
	yield* publish(root, realRoot, id, responseMarkdown(response));
	return id;
});

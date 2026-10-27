import { relative } from "node:path";
import { Cause, Effect, Fiber, Stream } from "effect";
import { BadRequest, Forbidden } from "@shivaedev/errors/taxonomy.ts";
import { board as boardApi } from "@shivaedev/work-board/server/integration/board.ts";
import type { DispatchRequest } from "#DispatchRequest.ts";
import { failureMessage } from "#engine/failureMessage.ts";
import { dispatchApproved } from "#host/admission.ts";
import type { FleetHost } from "#host/config.ts";
import { stopDispatchWork } from "#host/stopDispatchWork.ts";
import { BoardGateway, type BoardWork } from "#policy.ts";
import { dispatchStore } from "#storage/dispatchStore.ts";

export const dispatchRequests = Effect.fn("FleetDaemon.dispatchRequests")(function* (host: FleetHost) {
	const scope = yield* Effect.scope;
	const board = yield* BoardGateway;
	const store = yield* dispatchStore(host.namespace);
	const running = new Map<string, { readonly request: DispatchRequest; readonly fiber: Fiber.Fiber<void, never>; sourcePath: string }>();
	const cancelDispatch = Effect.fn("FleetDaemon.cancelDispatch")(function* (workId: string, reason: string) {
		const request = yield* store.get(workId);
		if (request?.status !== "pending") {
			return request?.status === "cancelled" ? request : undefined;
		}
		yield* store.finish(request, reason, "cancelled");
		const active = running.get(request.id);
		if (active !== undefined) {
			yield* Fiber.interrupt(active.fiber);
		}
		return request;
	});
	const stop = stopDispatchWork(cancelDispatch);
	const start = Effect.fn("FleetDaemon.start")(function* (request: DispatchRequest, work?: BoardWork) {
		if (running.has(request.id)) {
			return;
		}
		const source = work ?? (yield* board.get(request.workId));
		if (source.status === "dropped") {
			yield* stop(request.workId, "Work cancelled because Board status is dropped.");
			return;
		}
		const fiber = yield* dispatchApproved(host, request.workId, request.now ? { ignoreAreas: request.ignoreAreas === true } : undefined).pipe(
			Effect.andThen(store.finish(request)),
			Effect.catchCause((cause) =>
				Cause.hasInterrupts(cause) ? Effect.failCause(cause) : store.finish(request, failureMessage(Cause.squash(cause))),
			),
			Effect.catchCause((cause) => (Cause.hasInterrupts(cause) ? Effect.void : Effect.logError(cause))),
			Effect.ensuring(Effect.sync(() => running.delete(request.id))),
			Effect.forkIn(scope),
		);
		running.set(request.id, { fiber, request, sourcePath: source.sourcePath });
	});
	const changes = yield* boardApi.watchChanges(host.boardDir);
	yield* Stream.fromPubSub(changes.events).pipe(
		Stream.runForEach((change) =>
			Effect.forEach([...running.values()], (active) => {
				if (change._tag === "Changed" && !change.paths.includes(relative(changes.realRoot, active.sourcePath))) {
					return Effect.void;
				}
				return board.get(active.request.workId, { fresh: true }).pipe(
					Effect.flatMap((work) => {
						active.sourcePath = work.sourcePath;
						return work.status === "dropped" ? stop(work.workId, "Work cancelled because Board status is dropped.").pipe(Effect.asVoid) : Effect.void;
					}),
					Effect.catchCause(Effect.logError),
				);
			}),
		),
		Effect.forkIn(scope),
	);
	for (const request of yield* store.list()) {
		if (request.status === "pending") {
			yield* start(request);
		}
	}
	return {
		accept: Effect.fn("FleetDaemon.accept")(function* (
			workId: string,
			options: { readonly ignoreAreas?: boolean | undefined; readonly now?: boolean | undefined } = {},
		) {
			if (options.ignoreAreas === true && options.now !== true) {
				return yield* new BadRequest({ message: "Ignoring area claims needs a dispatch now request" });
			}
			const work = yield* board.get(workId);
			if (!work.approved) {
				return yield* new Forbidden({ message: `${workId} needs "fleet: approved" in its Board frontmatter` });
			}
			const request = yield* store.accept(workId, options.now === true ? { ignoreAreas: options.ignoreAreas === true } : undefined);
			yield* start(request, work);
			return request;
		}),
		get: store.get,
		stop,
	};
});

import { Cause, Effect } from "effect";
import { BadRequest, Forbidden } from "@shivaedev/errors/taxonomy.ts";
import type { DispatchRequest } from "#DispatchRequest.ts";
import { failureMessage } from "#engine/failureMessage.ts";
import { dispatchApproved } from "#host/admission.ts";
import type { FleetHost } from "#host/config.ts";
import { BoardGateway } from "#policy.ts";
import { dispatchStore } from "#storage/dispatchStore.ts";

export const dispatchRequests = Effect.fn("FleetDaemon.dispatchRequests")(function* (host: FleetHost) {
	const scope = yield* Effect.scope;
	const board = yield* BoardGateway;
	const store = yield* dispatchStore(host.namespace);
	const running = new Set<string>();
	const start = Effect.fn("FleetDaemon.start")(function* (request: DispatchRequest) {
		if (running.has(request.id)) {
			return;
		}
		running.add(request.id);
		yield* dispatchApproved(host, request.workId, request.now ? { ignoreAreas: request.ignoreAreas === true } : undefined).pipe(
			Effect.andThen(store.finish(request)),
			Effect.catchCause((cause) =>
				Cause.hasInterrupts(cause) ? Effect.failCause(cause) : store.finish(request, failureMessage(Cause.squash(cause))),
			),
			Effect.catchCause((cause) => (Cause.hasInterrupts(cause) ? Effect.void : Effect.logError(cause))),
			Effect.ensuring(Effect.sync(() => running.delete(request.id))),
			Effect.forkIn(scope),
		);
	});
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
			yield* start(request);
			return request;
		}),
		get: store.get,
	};
});

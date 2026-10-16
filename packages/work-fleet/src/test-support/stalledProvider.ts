import { Deferred, Effect } from "effect";
import { SessionFailure, type SessionReceipt } from "#session/schema.ts";
import type { SessionTransport } from "#session/service.ts";
import { stalledProgress } from "#test/parkStalled.ts";

export const stalledProvider = Effect.fnUntraced(function* (fault: "unavailable" | "hanging" | "mismatch") {
	let failing = false;
	const interrupting = yield* Deferred.make<void>();
	const observing = yield* Deferred.make<void>();
	const archiving = yield* Deferred.make<void>();
	const failure = new SessionFailure({ message: "Provider unavailable", reason: "unavailable" });
	function interrupt(receipt: SessionReceipt) {
		if (!failing) {
			return Effect.succeed(receipt);
		}
		return fault === "hanging" ? Deferred.succeed(interrupting, undefined).pipe(Effect.andThen(Effect.never)) : Effect.fail(failure);
	}
	function decorateTransport(transport: typeof SessionTransport.Service): typeof SessionTransport.Service {
		return {
			...transport,
			archive: () => (fault === "hanging" ? Deferred.succeed(archiving, undefined).pipe(Effect.andThen(Effect.never)) : Effect.void),
			interrupt,
			observe: (receipt) => {
				if (!failing) {
					return transport.observe(receipt).pipe(Effect.map(stalledProgress));
				}
				if (fault === "hanging") {
					return Deferred.succeed(observing, undefined).pipe(Effect.andThen(Effect.never));
				}
				return fault === "mismatch"
					? Effect.succeed({
							execution: "completed" as const,
							output: "Wrong output",
							provisioning: "ready" as const,
							receipt: { ...receipt, turnId: "wrong" },
						})
					: Effect.fail(failure);
			},
		};
	}
	return {
		archiving,
		decorateTransport,
		fail: () => {
			failing = true;
		},
		interrupting,
		observing,
	};
});

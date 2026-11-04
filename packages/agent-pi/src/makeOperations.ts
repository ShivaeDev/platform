import { Effect, Stream } from "effect";
import { UnknownAcceptance } from "@shivaedev/agent/failures.ts";
import type { Receipt, Reconciliation, StartRequest } from "@shivaedev/agent/run.ts";
import { protocolFailure } from "#adapters/failure.ts";
import { openSession } from "#adapters/openSession.ts";
import { textOf } from "#adapters/textOf.ts";
import type { PiOptions } from "#PiOptions.ts";

export const makeOperations = Effect.fnUntraced(function* (options: PiOptions) {
	const runs = yield* Effect.sync(() => new Map<string, Effect.Success<ReturnType<typeof openSession>>>());
	const evidence = new Map<string, Reconciliation>();
	function lookup(receipt: Receipt) {
		return Effect.suspend(() => {
			const run = runs.get(receipt.operationId);
			return receipt.backend === "pi" && receipt.reference.version === 1 && run?.receipt.reference.value === receipt.reference.value
				? Effect.succeed(run)
				: Effect.fail(protocolFailure("run is not open in this backend scope"));
		});
	}
	const open = Effect.fnUntraced(function* (request: StartRequest, resume: string | undefined) {
		if (evidence.has(request.operationId)) {
			return yield* Effect.fail(protocolFailure("operation already attempted; reconcile instead"));
		}
		evidence.set(request.operationId, { operationId: request.operationId, reason: "submission has no acceptance evidence yet", type: "uncertain" });
		const run = yield* openSession(options, request, resume);
		yield* run.prompt(textOf(request.input), "steer").pipe(
			Effect.mapError((error) => {
				if (error._tag === "Rejected") {
					evidence.set(request.operationId, { evidence: error.message, operationId: request.operationId, type: "not-accepted" });
					return error;
				}
				return new UnknownAcceptance({ backend: "pi", message: error.message, operationId: request.operationId });
			}),
		);
		runs.set(request.operationId, run);
		evidence.set(request.operationId, { receipt: run.receipt, type: "accepted" });
		yield* run.acknowledge;
		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				runs.delete(request.operationId);
			}),
		);
		return run.receipt;
	});
	return {
		events: (receipt: Receipt) => Stream.unwrap(lookup(receipt).pipe(Effect.map((run) => run.events))),
		inspect: (receipt: Receipt) =>
			lookup(receipt).pipe(
				Effect.flatMap((run) => run.inspect),
				Effect.catchTag("ProtocolFailure", () =>
					Effect.succeed({ reason: "no live execution evidence in this backend scope", type: "missing" as const }),
				),
			),
		lookup,
		open,
		reconcile: (operationId: string) =>
			Effect.sync(
				(): Reconciliation =>
					evidence.get(operationId) ?? {
						operationId,
						reason: "Pi has no operation-id lookup; missing local evidence does not prove non-acceptance",
						type: "uncertain",
					},
			),
		resume: (reference: { readonly value: string; readonly version: number }, request: StartRequest) =>
			reference.version === 1 ? open(request, reference.value) : Effect.fail(protocolFailure("unsupported session reference version")),
	};
});

import { Effect, Stream } from "effect";
import type { ConfiguredBackend } from "@shivaedev/agent/backend.ts";
import { ProtocolFailure, Rejected } from "@shivaedev/agent/failures.ts";
import type { BackendReference, Input, Receipt, StartRequest } from "@shivaedev/agent/run.ts";
import { listModels, openPiSession } from "#adapters/piRuntime.ts";
import { abortSession, disposeSession, sendInput } from "#adapters/sessionInput.ts";
import { makeRunState, type RunState } from "#makeRunState.ts";
import type { PiOptions } from "#PiOptions.ts";
export function makePiBackend(options: PiOptions) {
	return Effect.sync((): ConfiguredBackend => {
		const runs = new Map<string, RunState>();
		const accepted = new Map<string, Receipt>();
		function live(receipt: Receipt) {
			return Effect.suspend(() => {
				const run = runs.get(receipt.reference.value);
				return run !== undefined && receipt.backend === "pi" && receipt.reference.version === 1 && run.receipt.operationId === receipt.operationId
					? Effect.succeed(run)
					: Effect.fail(new ProtocolFailure({ backend: "pi", message: "No live Pi runtime matches this receipt" }));
			});
		}
		function deliver(receipt: Receipt, input: Input, delivery: "followUp" | "steer") {
			return Effect.gen(function* () {
				const run = yield* live(receipt);
				yield* sendInput(run.session, input.parts.map((part) => part.text).join("\n"), delivery);
			});
		}
		function start(request: StartRequest, reference?: typeof BackendReference.Type) {
			return Effect.gen(function* () {
				if (reference !== undefined && reference.version !== 1) {
					return yield* Effect.fail(new Rejected({ backend: "pi", message: "Unsupported Pi session reference version" }));
				}
				const session = yield* Effect.acquireRelease(
					openPiSession({ ...request, ...(reference === undefined ? {} : { resume: reference.value }) }, options),
					disposeSession,
				);
				const receipt: Receipt = {
					backend: "pi",
					operationId: request.operationId,
					reference: { value: session.sessionId, version: 1 },
					session: { value: session.sessionFile, version: 1 },
				};
				const run = yield* makeRunState(receipt, session);
				runs.set(receipt.reference.value, run);
				yield* sendInput(session, request.input.parts.map((part) => part.text).join("\n"), "followUp");
				accepted.set(request.operationId, receipt);
				return receipt;
			});
		}
		return {
			backend: "pi",
			events: (receipt) => Stream.unwrap(live(receipt).pipe(Effect.map((run) => run.events))),
			features: {
				imageInput: { reason: "Pi input mapping accepts text only", support: "unsupported" },
				interruption: {
					implementation: { interrupt: (receipt) => live(receipt).pipe(Effect.flatMap((run) => abortSession(run.session))) },
					support: "supported",
				},
				models: { implementation: { list: listModels }, support: "supported" },
				queuedInput: { implementation: { queue: (receipt, input) => deliver(receipt, input, "followUp") }, support: "supported" },
				sessions: { implementation: { resume: (reference, request) => start(request, reference) }, support: "supported" },
				steering: { implementation: { steer: (receipt, input) => deliver(receipt, input, "steer") }, support: "supported" },
				transcript: { reason: "Pi persisted transcript reading is not mapped", support: "unsupported" },
			},
			inspect: (receipt) => live(receipt).pipe(Effect.flatMap((run) => run.inspect)),
			reconcile: (operationId) =>
				Effect.sync(() => {
					const receipt = accepted.get(operationId);
					return receipt === undefined
						? ({ operationId, reason: "No in-memory acceptance evidence; Pi session files do not record operation ids", type: "uncertain" } as const)
						: ({ receipt, type: "accepted" } as const);
				}),
			start: (request) => start(request),
		};
	});
}

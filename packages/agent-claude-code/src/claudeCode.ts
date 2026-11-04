import { Deferred, Effect, Layer, Option, Ref, Schema, Stream } from "effect";
import { Backend, type ConfiguredBackend } from "@shivaedev/agent/backend.ts";
import { ProtocolFailure, Rejected, UnknownAcceptance } from "@shivaedev/agent/failures.ts";
import type { BackendReference, Receipt, StartRequest } from "@shivaedev/agent/run.ts";
import { ClaudeProvider } from "#adapters/ClaudeProvider.ts";
import { openSession } from "#adapters/openSession.ts";
import type { ClaudeOptions } from "#options.ts";
import { makeRunState, type RunState } from "#runState.ts";

const decodeEffort = Schema.decodeUnknownOption(Schema.Literals(["low", "medium", "high", "xhigh", "max"]));
function protocol(message: string) {
	return new ProtocolFailure({ backend: "claude-code", message });
}
export const makeClaudeBackend = Effect.fn("ClaudeCode.makeClaudeBackend")(function* (
	options: ClaudeOptions = {},
): Effect.fn.Return<ConfiguredBackend, never, ClaudeProvider> {
	const peer = yield* ClaudeProvider;
	const runs = new Map<string, RunState>();
	function lookup(receipt: Receipt) {
		return Effect.suspend(() => {
			const run =
				receipt.backend === "claude-code" && receipt.reference.version === 1 && receipt.reference.value === receipt.operationId
					? runs.get(receipt.operationId)
					: undefined;
			return run === undefined ? Effect.fail(protocol("No run evidence for this receipt in this backend instance")) : Effect.succeed(run);
		});
	}
	const start = Effect.fn("ClaudeCode.start")(function* (request: StartRequest, resume?: typeof BackendReference.Type) {
		if (resume !== undefined && resume.version !== 1) {
			return yield* Effect.fail(new Rejected({ backend: "claude-code", message: "Unsupported native session reference version" }));
		}
		const effort = request.effort === undefined ? Option.none() : decodeEffort(request.effort);
		if (request.effort !== undefined && Option.isNone(effort)) {
			return yield* Effect.fail(new Rejected({ backend: "claude-code", message: `Unsupported Claude effort: ${request.effort}` }));
		}
		const existing = runs.get(request.operationId);
		if (existing !== undefined) {
			return yield* Deferred.await(existing.acknowledged);
		}
		const session = yield* openSession(request, options, Option.getOrUndefined(effort), resume?.value).pipe(
			Effect.provideService(ClaudeProvider, peer),
			Effect.mapError((error) => new UnknownAcceptance({ backend: "claude-code", message: error.message, operationId: request.operationId })),
		);
		const run = yield* makeRunState(request.operationId, session);
		runs.set(request.operationId, run);
		yield* session
			.queue(request.input)
			.pipe(Effect.mapError((error) => new UnknownAcceptance({ backend: "claude-code", message: error.message, operationId: request.operationId })));
		return yield* Deferred.await(run.acknowledged);
	});
	return {
		backend: "claude-code",
		events: (receipt) => Stream.unwrap(Effect.map(lookup(receipt), (run) => run.events)),
		features: {
			imageInput: { reason: "This adapter accepts text input only", support: "unsupported" },
			interruption: {
				implementation: { interrupt: (receipt) => Effect.flatMap(lookup(receipt), (run) => run.session.interrupt) },
				support: "supported",
			},
			models: { reason: "Model discovery is not exposed; supply a provider model in the start request", support: "unsupported" },
			queuedInput: {
				implementation: { queue: (receipt, input) => Effect.flatMap(lookup(receipt), (run) => run.session.queue(input)) },
				support: "supported",
			},
			sessions: { implementation: { resume: (session, request) => start(request, session) }, support: "supported" },
			steering: {
				implementation: { steer: (receipt, input) => Effect.flatMap(lookup(receipt), (run) => run.session.queue(input, "now")) },
				support: "supported",
			},
			transcript: {
				implementation: {
					read: (receipt) =>
						Effect.gen(function* () {
							const run = yield* lookup(receipt);
							const events = yield* Ref.get(run.history);
							return { completeness: events.some((event) => event.type === "gap") ? "partial" : "complete", events } as const;
						}),
				},
				support: "supported",
			},
		},
		inspect: (receipt) =>
			Effect.gen(function* () {
				const found = runs.get(receipt.operationId);
				if (found === undefined) {
					return { reason: "This backend instance has no evidence; absence does not prove non-acceptance", type: "missing" } as const;
				}
				const run = yield* lookup(receipt);
				const error = yield* Ref.get(run.failure);
				if (error !== undefined) {
					return yield* Effect.fail(error);
				}
				return { state: yield* Ref.get(run.state), type: "known" } as const;
			}),
		reconcile: (operationId) =>
			Effect.gen(function* () {
				const run = runs.get(operationId);
				const acknowledgement = run === undefined ? Option.none() : yield* Deferred.poll(run.acknowledged);
				if (Option.isSome(acknowledgement)) {
					return yield* acknowledgement.value.pipe(
						Effect.map((receipt) => ({ receipt, type: "accepted" }) as const),
						Effect.catchTag("UnknownAcceptance", (error) => Effect.succeed({ operationId, reason: error.message, type: "uncertain" } as const)),
					);
				}
				return {
					operationId,
					reason: "No native acknowledgement in this backend instance; no replacement work was submitted",
					type: "uncertain",
				} as const;
			}),
		start,
	};
});

export function claudeCodeLayer(options: ClaudeOptions = {}) {
	return Layer.effect(Backend, makeClaudeBackend(options)).pipe(Layer.provide(ClaudeProvider.layer));
}

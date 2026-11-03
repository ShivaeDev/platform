import { type Cause, Effect, Option, Queue, Stream } from "effect";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import { ProtocolFailure, UnknownAcceptance } from "@shivaedev/agent/failures.ts";
import type { Observation, Receipt, StartRequest } from "@shivaedev/agent/run.ts";
import { opencodeFailure } from "#failure.ts";
import { openOpencodeSession } from "#openOpencodeSession.ts";
import type { OpencodeOptions, SessionHandle } from "#options.ts";
import { Provider } from "#Provider.ts";
export interface OpenRun {
	readonly events: Stream.Stream<RunEvent>;
	readonly receipt: Receipt;
	readonly session: SessionHandle;
}
export const makeOperations = Effect.fnUntraced(function* (options: OpencodeOptions) {
	const server = yield* Provider;
	const runs = new Map<string, OpenRun>();
	const receipts = new Map<string, Receipt>();
	const observation = new Map<string, Observation>();
	function lookup(receipt: Receipt) {
		return Effect.suspend(() => {
			const run = runs.get(receipt.operationId);
			return receipt.backend === "opencode" && receipt.reference.version === 1 && run?.receipt.reference.value === receipt.reference.value
				? Effect.succeed(run)
				: Effect.fail(opencodeFailure("run is not open in this backend scope"));
		});
	}
	const open = Effect.fnUntraced(function* (request: StartRequest, resume: Option.Option<string>) {
		if (receipts.has(request.operationId)) {
			return yield* Effect.fail(opencodeFailure("operation already acknowledged; reconcile instead"));
		}
		const session = yield* openOpencodeSession({
			constrainedPrompt: options.constrainedPrompt,
			cwd: request.cwd,
			effort: Option.fromUndefinedOr(request.effort),
			model: request.model,
			resume,
			tools: options.sessionTools?.(request) ?? options.tools ?? [],
		}).pipe(Effect.provideService(Provider, server));
		const reference = yield* session.nativeRef;
		if (Option.isNone(reference)) {
			return yield* Effect.fail(opencodeFailure("session returned no reference"));
		}
		const receipt: Receipt = {
			backend: "opencode",
			operationId: request.operationId,
			reference: { value: reference.value, version: 1 },
			session: { value: reference.value, version: 1 },
		};
		yield* session
			.steer(request.input)
			.pipe(
				Effect.mapError((error) =>
					error._tag === "Rejected"
						? error
						: new UnknownAcceptance({ backend: "opencode", message: error.message, operationId: request.operationId }),
				),
			);
		const output = yield* Queue.unbounded<RunEvent, Cause.Done>();
		observation.set(request.operationId, { state: "accepted", type: "known" });
		function observe(event: RunEvent) {
			return Effect.sync(() => {
				if (event.type === "execution") {
					observation.set(request.operationId, { state: event.state, type: "known" });
				}
			}).pipe(Effect.andThen(Queue.offer(output, event)));
		}
		const ended = Effect.sync(() => {
			const latest = observation.get(request.operationId);
			if (runs.has(request.operationId) && latest?.type === "known" && !["completed", "failed", "interrupted"].includes(latest.state)) {
				observation.set(request.operationId, { reason: "provider event stream ended without terminal evidence", type: "missing" });
			}
		}).pipe(Effect.andThen(Queue.end(output)));
		yield* Effect.forkScoped(session.events.pipe(Stream.runForEach(observe), Effect.ensuring(ended)));
		const events = Stream.fromQueue(output);
		runs.set(request.operationId, { events, receipt, session });
		receipts.set(request.operationId, receipt);
		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				runs.delete(request.operationId);
				observation.delete(request.operationId);
			}),
		);
		return receipt;
	});
	return {
		events: (receipt: Receipt) => Stream.unwrap(lookup(receipt).pipe(Effect.map((run) => run.events))),
		inspect: (receipt: Receipt) =>
			Effect.sync(
				(): Observation => observation.get(receipt.operationId) ?? { reason: "no live execution evidence in this backend scope", type: "missing" },
			),
		lookup,
		open,
		reconcile: (operationId: string) =>
			Effect.sync(() => {
				const receipt = receipts.get(operationId);
				return receipt === undefined
					? { operationId, reason: "OpenCode has no operation-id lookup; absence is not proof of refusal", type: "uncertain" as const }
					: { receipt, type: "accepted" as const };
			}),
		resume: (
			reference: {
				readonly value: string;
				readonly version: number;
			},
			request: StartRequest,
		) =>
			reference.version === 1
				? open(request, Option.some(reference.value))
				: Effect.fail(new ProtocolFailure({ backend: "opencode", message: "unsupported session reference version" })),
	};
});

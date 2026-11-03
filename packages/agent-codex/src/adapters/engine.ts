import { Effect, PubSub, Semaphore, Stream } from "effect";
import type { ConfiguredBackend } from "@shivaedev/agent/backend.ts";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import { Rejected, UnknownAcceptance } from "@shivaedev/agent/failures.ts";
import type { ImageInput, StartRequest } from "@shivaedev/agent/run.ts";
import { features } from "#adapters/features.ts";
import type { LineProcess } from "#adapters/process.ts";
import { observe, readRequest } from "#adapters/reads.ts";
import { receiptOf, recovery } from "#adapters/recovery.ts";
import { AppServer, openServer } from "#adapters/server.ts";
import { openSession, type Session } from "#adapters/session.ts";
import { sweepSpawnedDescendants } from "#adapters/threadSweep.ts";
import type { CodexConfiguration } from "#config.ts";
export const engine = Effect.fn("Codex.engine")(function* (config: CodexConfiguration, spawn?: () => LineProcess) {
	const server = yield* openServer(config, spawn);
	const sessions = new Map<string, Session>();
	const { operations, refusals, reconcile } = yield* recovery(sessions).pipe(Effect.provideService(AppServer, server));
	const submissionGate = yield* Semaphore.make(1);
	const submit = Effect.fn("Codex.submit")(function* (
		request: Omit<StartRequest, "input"> & { readonly input: ImageInput },
		reference?: { value: string; version: number },
	) {
		if (operations.has(request.operationId)) {
			const result = yield* reconcile(request.operationId);
			if (result.type === "accepted") {
				return result.receipt;
			}
			if (result.type === "not-accepted") {
				return yield* new Rejected({ backend: "codex", message: result.evidence });
			}
			return yield* new UnknownAcceptance({
				backend: "codex",
				message: result.reason,
				operationId: request.operationId,
			});
		}
		if (reference !== undefined && (reference.version !== 1 || server.claims.isNode(reference.value))) {
			return yield* new Rejected({ backend: "codex", message: "Child threads are observed passively and cannot be resumed" });
		}
		operations.set(request.operationId, reference?.value);
		const session = yield* openSession(config, request, reference?.value, (operationId, threadId) => {
			operations.set(operationId, threadId);
		}).pipe(Effect.provideService(AppServer, server));
		operations.set(request.operationId, session.threadId);
		sessions.set(session.threadId, session);
		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				if (sessions.get(session.threadId) === session) {
					sessions.delete(session.threadId);
				}
			}),
		);
		const turnId = yield* session.driver.start(request.input, request.operationId);
		return receiptOf(request.operationId, session.threadId, turnId);
	});
	function start(request: Omit<StartRequest, "input"> & { readonly input: ImageInput }, session?: { value: string; version: number }) {
		return Semaphore.withPermit(submissionGate)(submit(request, session)).pipe(
			Effect.tapError((error) =>
				Effect.sync(() => {
					if (error._tag === "Rejected") {
						refusals.set(request.operationId, error.message);
					}
				}),
			),
		);
	}
	const backend: ConfiguredBackend = {
		backend: "codex",
		events: (receipt) =>
			Stream.unwrap(
				Effect.gen(function* () {
					const session = sessions.get(receipt.session?.value ?? "");
					if (session === undefined) {
						return Stream.empty;
					}
					const subscription = yield* PubSub.subscribe(session.events);
					return Stream.fromIterable<RunEvent>([
						{ receipt, type: "acknowledged" },
						{ reference: session.threadId, type: "session.opened" },
					]).pipe(Stream.concat(Stream.fromSubscription(subscription)), Stream.interruptWhen(server.exited));
				}),
			),
		features: yield* features(sessions, start).pipe(Effect.provideService(AppServer, server)),
		inspect: (receipt) => observe(receipt).pipe(Effect.provideService(AppServer, server)),
		reconcile,
		start,
	};
	return {
		backend: () => Effect.succeed(backend),
		census: (rootThreadId: string) =>
			sweepSpawnedDescendants((method, params) => readRequest(method, params).pipe(Effect.provideService(AppServer, server)), rootThreadId).pipe(
				Effect.tap((children) =>
					Effect.sync(() => {
						for (const child of children) {
							server.claims.claim(rootThreadId, child.threadId);
						}
					}),
				),
			),
	};
});

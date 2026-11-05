import { Effect, Semaphore } from "effect";
import { Rejected, UnknownAcceptance } from "@shivaedev/agent/failures.ts";
import type { ImageInput, Receipt, StartRequest } from "@shivaedev/agent/run.ts";
import { features } from "#adapters/features.ts";
import { observe, readRequest } from "#adapters/reads.ts";
import { receiptOf, recovery } from "#adapters/recovery.ts";
import { AppServer, openServer } from "#adapters/server.ts";
import { openSession, type Session } from "#adapters/session.ts";
import type { CodexConfiguration } from "#config.ts";
export const initializeEngine = Effect.fn("Codex.initializeEngine")(function* (config: CodexConfiguration) {
	const server = yield* openServer(config);
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
	return {
		claims: server.claims,
		exited: server.exited,
		features: yield* features(sessions, start).pipe(Effect.provideService(AppServer, server)),
		inspect: (receipt: Receipt) => observe(receipt).pipe(Effect.provideService(AppServer, server)),
		read: (method: string, params: unknown) => readRequest(method, params).pipe(Effect.provideService(AppServer, server)),
		reconcile,
		sessions,
		start,
	};
});
export type EngineState = Effect.Success<ReturnType<typeof initializeEngine>>;

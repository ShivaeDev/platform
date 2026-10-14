import { Cause, Context, Effect } from "effect";
import { defineService } from "@shivaedev/effect-service/define-service.ts";
import {
	type ContinueSession,
	type ReconcileSession,
	SessionFailure,
	type SessionObservation,
	type SessionReceipt,
	type StartSession,
} from "#session/schema.ts";
import { validateReceipt } from "#session/validateReceipt.ts";

export class SessionTransport extends Context.Service<
	SessionTransport,
	{
		readonly steer?: (receipt: SessionReceipt, prompt: string) => Effect.Effect<void, SessionFailure>;
		readonly nameSession?: (sessionId: string, name: string) => Effect.Effect<void, SessionFailure>;
		readonly readSessionName?: (sessionId: string) => Effect.Effect<string | undefined, SessionFailure>;
		readonly archive?: (sessionId: string) => Effect.Effect<void, SessionFailure>;
		readonly startSession: (input: StartSession) => Effect.Effect<string, SessionFailure>;
		readonly startTurn: (input: ContinueSession) => Effect.Effect<SessionReceipt, SessionFailure>;
		readonly observe: (receipt: SessionReceipt) => Effect.Effect<SessionObservation, SessionFailure>;
		readonly reconcile: (input: ReconcileSession) => Effect.Effect<SessionReceipt, SessionFailure>;
		readonly interrupt: (receipt: SessionReceipt) => Effect.Effect<SessionReceipt, SessionFailure>;
	}
>()("@shivaedev/work-fleet/SessionTransport") {}

export class SessionJournal extends Context.Service<
	SessionJournal,
	{
		readonly sessionName?: (operationId: string) => Effect.Effect<string, SessionFailure>;
		readonly acknowledgeSession: (operationId: string, sessionId: string) => Effect.Effect<void, SessionFailure>;
		readonly acknowledgeTurn: (operationId: string, receipt: SessionReceipt) => Effect.Effect<void, SessionFailure>;
	}
>()("@shivaedev/work-fleet/SessionJournal") {}

export const SessionService = defineService({
	id: "@shivaedev/work-fleet/SessionService",
	initialize: Effect.gen(function* () {
		return { journal: yield* SessionJournal, transport: yield* SessionTransport };
	}),
	methods: ({ transport, journal }) => ({
		archive: (sessionId: string) => transport.archive?.(sessionId) ?? Effect.void,
		continue: (input: ContinueSession) =>
			Effect.uninterruptibleMask((restore) =>
				Effect.gen(function* () {
					yield* journal.acknowledgeSession(input.operationId, input.sessionId);
					const receipt = yield* restore(transport.startTurn(input));
					yield* validateReceipt(receipt, input);
					yield* journal.acknowledgeTurn(input.operationId, receipt);
					return receipt;
				}),
			),
		interrupt: Effect.fn("SessionService.interrupt")(function* (receipt: SessionReceipt) {
			const acknowledged = yield* transport.interrupt(receipt);
			yield* validateReceipt(acknowledged, receipt);
			return acknowledged;
		}),
		observe: Effect.fn("SessionService.observe")(function* (receipt: SessionReceipt) {
			const observation = yield* transport.observe(receipt);
			yield* validateReceipt(observation.receipt, receipt);
			return observation;
		}),
		reconcile: Effect.fn("SessionService.reconcile")(function* (input: ReconcileSession) {
			const receipt = yield* transport.reconcile(input);
			yield* validateReceipt(receipt, input);
			yield* journal.acknowledgeTurn(input.operationId, receipt);
			return receipt;
		}),
		start: (input: StartSession) =>
			Effect.uninterruptibleMask((restore) =>
				Effect.gen(function* () {
					const sessionId = yield* restore(transport.startSession(input));
					yield* journal.acknowledgeSession(input.operationId, sessionId);
					const name = transport.nameSession;
					yield* restore(
						name === undefined || journal.sessionName === undefined
							? Effect.void
							: journal.sessionName(input.operationId).pipe(Effect.flatMap((title) => name(sessionId, title))),
					).pipe(
						Effect.catch((cause) =>
							Effect.logWarning("Fleet session naming failed; starting the turn", Cause.fail(cause)).pipe(Effect.annotateLogs({ sessionId })),
						),
					);
					const receipt = yield* restore(
						transport.startTurn({
							...(input.access === undefined ? {} : { access: input.access }),
							operationId: input.operationId,
							prompt: input.prompt,
							sessionId,
							...(input.settings === undefined ? {} : { settings: input.settings }),
						}),
					);
					yield* validateReceipt(receipt, { sessionId });
					yield* journal.acknowledgeTurn(input.operationId, receipt);
					return receipt;
				}),
			),
		steer: (receipt: SessionReceipt, prompt: string) =>
			transport.steer?.(receipt, prompt) ?? Effect.fail(new SessionFailure({ message: "Provider does not support steering", reason: "protocol" })),
	}),
	requires: [SessionTransport, SessionJournal],
});

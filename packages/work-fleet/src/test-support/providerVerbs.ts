import { Clock, Effect, Fiber } from "effect";
import type { SessionFailure, SessionReceipt } from "#session/schema.ts";
import type { SessionTransport } from "#session/service.ts";
import { outcomeOf } from "#test/refusal.ts";

export function turnWords({ sessionId, turnId }: SessionReceipt) {
	return `turn ${turnId} on ${sessionId}`;
}

function inBackground(outcome: Effect.Effect<string>) {
	return Effect.forkChild(outcome).pipe(
		Effect.map((fiber) => ({
			outcome: () => Fiber.join(fiber),
			progress: () => Effect.sync(() => (fiber.pollUnsafe() === undefined ? "pending" : "settled")),
		})),
	);
}

export function providerVerbs(
	connected: Effect.Effect<typeof SessionTransport.Service, SessionFailure>,
	tell: (line: string) => void,
	clock: Clock.Clock | undefined,
) {
	const client =
		clock === undefined
			? connected
			: connected.pipe(
					Effect.map((provider) => ({
						...provider,
						reconcile: (input: Parameters<typeof provider.reconcile>[0]) => provider.reconcile(input).pipe(Effect.provideService(Clock.Clock, clock)),
						startTurn: (input: Parameters<typeof provider.startTurn>[0]) => provider.startTurn(input).pipe(Effect.provideService(Clock.Clock, clock)),
					})),
				);
	type Transport = typeof SessionTransport.Service;
	function submitted(input: Parameters<Transport["startTurn"]>[0]) {
		return outcomeOf(client.pipe(Effect.flatMap((provider) => provider.startTurn(input))), turnWords);
	}
	function recovered(input: Parameters<Transport["reconcile"]>[0]) {
		return outcomeOf(client.pipe(Effect.flatMap((provider) => provider.reconcile(input))), turnWords);
	}
	return {
		interrupt: (input: Parameters<Transport["interrupt"]>[0]) => {
			tell(`interrupt turn ${input.turnId}`);
			return outcomeOf(client.pipe(Effect.flatMap((provider) => provider.interrupt(input))), (receipt) => `interrupted ${turnWords(receipt)}`);
		},
		observe: (input: Parameters<Transport["observe"]>[0]) => {
			tell(`observe turn ${input.turnId}`);
			return client.pipe(Effect.flatMap((provider) => provider.observe(input)));
		},
		observeOutcome: (input: Parameters<Transport["observe"]>[0]) => {
			tell(`observe turn ${input.turnId}`);
			return outcomeOf(client.pipe(Effect.flatMap((provider) => provider.observe(input))), ({ execution }) => `observed ${execution}`);
		},
		openSession: (input: Parameters<Transport["startSession"]>[0]) => {
			tell(`open a provider session for ${input.operationId}`);
			return outcomeOf(client.pipe(Effect.flatMap((provider) => provider.startSession(input))), (sessionId) => `session ${sessionId}`);
		},
		reconcile: (input: Parameters<Transport["reconcile"]>[0]) => {
			tell(`recover operation ${input.operationId}`);
			return client.pipe(Effect.flatMap((provider) => provider.reconcile(input)));
		},
		recover: (input: Parameters<Transport["reconcile"]>[0]) => {
			tell(`recover operation ${input.operationId}`);
			return recovered(input);
		},
		recoverInBackground: (input: Parameters<Transport["reconcile"]>[0]) => {
			tell(`start recovering operation ${input.operationId}`);
			return inBackground(recovered(input));
		},
		startSession: (input: Parameters<Transport["startSession"]>[0]) => {
			tell(`open a provider session for ${input.operationId}`);
			return client.pipe(Effect.flatMap((provider) => provider.startSession(input)));
		},
		submit: (input: Parameters<Transport["startTurn"]>[0]) => {
			tell(`submit ${input.operationId} to ${input.sessionId}`);
			return submitted(input);
		},
		submitInBackground: (input: Parameters<Transport["startTurn"]>[0]) => {
			tell(`start submitting ${input.operationId} to ${input.sessionId}`);
			return inBackground(submitted(input));
		},
	};
}

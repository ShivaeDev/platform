import { Clock, Effect } from "effect";
import type { SessionFailure } from "#session/schema.ts";
import type { SessionTransport } from "#session/service.ts";

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
	return {
		interrupt: (input: Parameters<typeof SessionTransport.Service.interrupt>[0]) => {
			tell("interrupt a provider turn");
			return client.pipe(Effect.flatMap((provider) => provider.interrupt(input)));
		},
		observe: (input: Parameters<typeof SessionTransport.Service.observe>[0]) => {
			tell("observe a provider turn");
			return client.pipe(Effect.flatMap((provider) => provider.observe(input)));
		},
		reconcile: (input: Parameters<typeof SessionTransport.Service.reconcile>[0]) => {
			tell("reconcile a provider receipt");
			return client.pipe(Effect.flatMap((provider) => provider.reconcile(input)));
		},
		startSession: (input: Parameters<typeof SessionTransport.Service.startSession>[0]) => {
			tell("start a provider session");
			return client.pipe(Effect.flatMap((provider) => provider.startSession(input)));
		},
		startTurn: (input: Parameters<typeof SessionTransport.Service.startTurn>[0]) => {
			tell("submit a provider turn");
			return client.pipe(Effect.flatMap((provider) => provider.startTurn(input)));
		},
	};
}

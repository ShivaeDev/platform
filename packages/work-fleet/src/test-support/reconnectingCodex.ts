import { Effect, Layer } from "effect";
import type { SessionFailure } from "#session/schema.ts";
import { SessionTransport } from "#session/service.ts";
import { codexConfiguration } from "#test/codex.ts";

export function reconnectingCodex(endpoint: string, configuration = codexConfiguration(endpoint)): typeof SessionTransport.Service {
	function call<A>(use: (transport: typeof SessionTransport.Service) => Effect.Effect<A, SessionFailure>) {
		return Effect.scoped(SessionTransport.pipe(Effect.flatMap(use), Effect.provide(Layer.fresh(configuration))));
	}
	return {
		interrupt: (input) => call((transport) => transport.interrupt(input)),
		observe: (input) => call((transport) => transport.observe(input)),
		reconcile: (input) => call((transport) => transport.reconcile(input)),
		startSession: (input) => call((transport) => transport.startSession(input)),
		startTurn: (input) => call((transport) => transport.startTurn(input)),
	};
}

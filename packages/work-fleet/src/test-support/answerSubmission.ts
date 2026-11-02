import { Deferred, Effect, Layer } from "effect";
import { SessionTransport } from "#session/service.ts";

export function answerSubmission() {
	let pending: { readonly entered: Deferred.Deferred<void>; readonly release: Deferred.Deferred<void> } | undefined;
	function waitForRelease() {
		const gate = pending;
		return gate === undefined ? Effect.void : Deferred.succeed(gate.entered, undefined).pipe(Effect.andThen(Deferred.await(gate.release)));
	}
	return {
		hold: Effect.gen(function* () {
			const gate = { entered: yield* Deferred.make<void>(), release: yield* Deferred.make<void>() };
			pending = gate;
			const release = Effect.sync(() => {
				pending = undefined;
			}).pipe(Effect.andThen(Deferred.succeed(gate.release, undefined)));
			yield* Effect.addFinalizer(() => release);
			return { entered: Deferred.await(gate.entered), release };
		}),
		provider: (original: Layer.Layer<SessionTransport, unknown>) =>
			Layer.effect(SessionTransport)(
				Effect.map(SessionTransport, (transport) => ({
					...transport,
					startTurn: (input) => transport.startTurn(input).pipe(Effect.tap(waitForRelease)),
				})),
			).pipe(Layer.provide(original)),
	};
}

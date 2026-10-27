import { Deferred, Effect } from "effect";
import { engine } from "#test/engineStory.ts";

export function stopConfirmationHeld(phase: "interrupt" | "terminal") {
	return engine.trait("configuration", `${phase} confirmation is held`, function* (state) {
		const entered = yield* Deferred.make<void>();
		const resume = yield* Deferred.make<void>();
		state.timing = { entered, recoveries: 0, resume, steers: 0 };
		let stopping = false;
		const markStopping = Effect.sync(() => {
			stopping = true;
		});
		const gate = Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(resume)));
		state.options = {
			...state.options,
			...(phase === "interrupt" ? { interruptGate: gate } : {}),
			decorateTransport: (transport) => ({
				...transport,
				interrupt: (receipt) => transport.interrupt(receipt).pipe(Effect.tap(markStopping)),
				observe: (receipt) => (stopping && phase === "terminal" ? gate : Effect.void).pipe(Effect.andThen(transport.observe(receipt))),
			}),
		};
	});
}

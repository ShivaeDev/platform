import { Deferred, Effect } from "effect";
import { engine } from "#test/engineStory.ts";
import { resultFixture } from "#test/githubResult.ts";
import { stalledProvider } from "#test/stalledProvider.ts";
import { writeBarrier } from "#test/writeBarrier.ts";

export function heldAction(action: "checks" | "review" | "publish" | "answer" | "correction") {
	return engine.trait("configuration", `${action} waits before completing`, function* (state) {
		const entered = yield* Deferred.make<void>();
		const release = yield* Deferred.make<void>();
		state.recovery.gates = { entered, release };
		const gate = Deferred.succeed(entered, undefined).pipe(Effect.andThen(action === "answer" ? Effect.never : Deferred.await(release)));
		state.options = {
			...state.options,
			...(action === "checks" ? { checksGate: gate, concurrency: 1 } : {}),
			...(action === "review" ? { reviewGate: gate } : {}),
			...(action === "publish" ? { denyDelivery: true, publishGate: gate } : {}),
			...(action === "answer" ? { continuationGate: gate } : {}),
			...(action === "correction" ? { continuationGate: gate, lostContinuationAcknowledgement: true, resultQuery: resultFixture().adopt } : {}),
		};
	});
}

export function simultaneousDecisionWrites() {
	return engine.trait("configuration", "decision writes meet at the same revision", function* (state) {
		const barrier = yield* writeBarrier;
		state.recovery.barrier = barrier;
		state.options = { ...state.options, writeGate: barrier.writeGate };
	});
}

export function lateObservation() {
	return engine.trait("configuration", "a provider observation can arrive after release", function* (state) {
		const entered = yield* Deferred.make<void>();
		const resume = yield* Deferred.make<void>();
		state.recovery.gates = { entered, resume };
		state.now = 0;
		state.options = {
			...state.options,
			decorateTransport: (transport) => ({
				...transport,
				observe: (receipt) =>
					Effect.gen(function* () {
						if (state.recovery.holdObservation) {
							state.recovery.holdObservation = false;
							yield* Deferred.succeed(entered, undefined);
							yield* Deferred.await(resume);
							return { execution: "completed" as const, output: "Late output", provisioning: "ready" as const, receipt };
						}
						const observation = yield* transport.observe(receipt);
						return { ...observation, progress: [{ id: "unchanged" }] };
					}),
			}),
		};
	});
}

export function faultyStalledProvider(fault: "unavailable" | "hanging" | "mismatch") {
	return engine.trait("configuration", `the stalled provider becomes ${fault}`, function* (state) {
		state.now = 0;
		const provider = yield* stalledProvider(fault);
		state.recovery.faultyProvider = provider;
		state.recovery.gates = { archiving: provider.archiving, interrupting: provider.interrupting, observing: provider.observing };
		state.options = { ...state.options, decorateTransport: provider.decorateTransport };
	});
}

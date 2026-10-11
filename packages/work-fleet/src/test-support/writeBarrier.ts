import { Deferred, Effect } from "effect";

export const writeBarrier = Effect.gen(function* () {
	const gate = yield* Deferred.make<void>();
	let armed = false;
	let arrivals = 0;
	function arm() {
		armed = true;
	}
	const writeGate = Effect.fn("FleetFixture.writeGate")(function* () {
		if (!armed) {
			return;
		}
		arrivals += 1;
		if (arrivals === 2) {
			yield* Deferred.succeed(gate, undefined);
		}
		yield* Deferred.await(gate);
	});
	return { arm, writeGate };
});

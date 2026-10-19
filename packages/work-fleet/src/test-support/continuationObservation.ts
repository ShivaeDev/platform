import { Deferred, Effect } from "effect";
import { engineConfiguration } from "#test/engineConfiguration.ts";

export function continuationObservation() {
	const entered = Deferred.makeUnsafe<void>();
	const resume = Deferred.makeUnsafe<void>();
	let pause = false;
	return {
		entered: Deferred.await(entered),
		pauseNext: () => {
			pause = true;
		},
		resume: Deferred.succeed(resume, undefined),
		trait: engineConfiguration("a provider observation can pause while the daemon saves", () => ({
			decorateTransport: (transport) => ({
				...transport,
				observe: (receipt) =>
					Effect.gen(function* () {
						if (pause) {
							pause = false;
							yield* Deferred.succeed(entered, undefined);
							yield* Deferred.await(resume);
						}
						return yield* transport.observe(receipt);
					}),
			}),
		})),
	};
}

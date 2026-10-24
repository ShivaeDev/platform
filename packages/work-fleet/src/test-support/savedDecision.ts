import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import type { Decision } from "#policy.ts";
import { prepareWork } from "#test/engine.ts";
import { running } from "#test/engineState.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";

export function savedDecision(input: Pick<Decision, "code" | "reason" | "worker">) {
	return engine.traits(
		markdownWork(),
		engine.trait("work", "Fleet restores a saved decision awaiting Board publication", function* (state) {
			const { fleet, fixture } = running(state);
			const prepared = yield* prepareWork("one").pipe(Effect.provideService(Fleet, fleet));
			yield* fixture.replaceRecord({
				...prepared.value,
				decision: { id: "one.1", links: [], recommendation: "Release this cycle and inspect ownership", ...input },
				decisionPublished: false,
				step: "waiting",
			});
		}),
	);
}

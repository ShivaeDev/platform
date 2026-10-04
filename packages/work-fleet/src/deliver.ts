import { Effect } from "effect";
import { observedTransition, requiredChecks, reviewed, saveDelivery } from "./deliveryState.ts";
import type { State, Work } from "./domain.ts";
import { mergeDelivery } from "./mergeDelivery.ts";
import type { ChangeHost } from "./ports.ts";
import { publish } from "./publish.ts";
import type { StoreService } from "./Store.ts";
import { question } from "./state.ts";

function deliverNoChange(store: StoreService, host: typeof ChangeHost.Service, work: Work) {
	return Effect.gen(function* () {
		if (!reviewed(work) || work.outcome === null) {
			return;
		}
		if (work.spec.completion !== "no-change") {
			yield* saveDelivery(
				store,
				question({ ...work, phase: "held" }, "Does this work need a change instead?", "The approved completion condition requires a pull request."),
			);
			return;
		}
		yield* host.verifyNoChange(work.spec, work.outcome.revision);
		yield* saveDelivery(store, { ...work, phase: "completed", question: null });
	});
}
function deliverPullRequest(store: StoreService, host: typeof ChangeHost.Service, state: State, input: Work) {
	return Effect.gen(function* () {
		if (input.outcome?.kind !== "pull-request") {
			return;
		}
		const observed = yield* host.observe(input.spec, input.outcome.number);
		const headChanged = observed.revision !== input.outcome.revision;
		const baseChanged = input.observation !== null && observed.baseRevision !== input.observation.baseRevision;
		const work: Work = { ...input, observation: observed, outcome: { ...input.outcome, revision: observed.revision } };
		const transitioned = observedTransition(work, observed, headChanged, baseChanged);
		if (transitioned) {
			yield* saveDelivery(store, transitioned);
			return;
		}
		yield* saveDelivery(store, work);
		if (!reviewed(work) || requiredChecks(work, observed).some((check) => check.status !== "passed") || observed.mergeable !== "ready") {
			return;
		}
		yield* mergeDelivery(store, host, state, work, observed);
	});
}
export function deliver(store: StoreService, host: typeof ChangeHost.Service, state: State, work: Work) {
	return Effect.gen(function* () {
		if (work.outcome === null) {
			return;
		}
		if (work.spec.completion === "no-change" && work.outcome.kind !== "no-change") {
			yield* saveDelivery(
				store,
				question(
					{ ...work, phase: "held" },
					"Is a code change authorized for this work?",
					"The approved completion condition permits only a justified no-change outcome.",
				),
			);
			return;
		}
		if (work.outcome.kind === "branch") {
			if (reviewed(work) && !state.policy.stopped) {
				yield* publish(store, host, work);
			}
			return;
		}
		if (work.outcome.kind === "no-change") {
			yield* deliverNoChange(store, host, work);
			return;
		}
		yield* deliverPullRequest(store, host, state, work);
	});
}

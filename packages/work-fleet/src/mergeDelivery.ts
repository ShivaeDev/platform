import { Effect } from "effect";
import { saveDelivery } from "./deliveryState.ts";
import type { PullRequest, State, Work } from "./domain.ts";
import type { ChangeHost } from "./ports.ts";
import { rejectedOperation } from "./publish.ts";
import type { StoreService } from "./Store.ts";
import { authorized, question } from "./state.ts";
export function mergeDelivery(store: StoreService, host: typeof ChangeHost.Service, state: State, work: Work, observed: PullRequest) {
	return Effect.gen(function* () {
		if (work.spec.completion === "pull-request") {
			yield* host.verifyChange(work.spec, observed.revision);
			yield* saveDelivery(store, { ...work, phase: "completed", question: null });
			return;
		}
		if (work.spec.completion !== "merged") {
			return;
		}
		if (!authorized(state, work.spec.id, "merge")) {
			yield* saveDelivery(
				store,
				question(
					work,
					"Authorize ordinary merge for this work?",
					"Review the pull request and grant the scoped merge decision if it meets the approved intent.",
				),
			);
			return;
		}
		if (state.policy.stopped) {
			return;
		}
		if (work.merge !== "none") {
			yield* saveDelivery(
				store,
				question(work, "Did the merge request succeed?", "Continue observation; an uncertain merge request is never blindly resubmitted."),
			);
			return;
		}
		yield* host.verifyChange(work.spec, observed.revision);
		const validation = {
			at: yield* Effect.clockWith((clock) => clock.currentTimeMillis),
			baseRevision: observed.baseRevision,
			checks: work.spec.requiredChecks,
			revision: observed.revision,
		};
		const intended: Work = { ...work, merge: "intent", question: null, validation };
		yield* saveDelivery(store, intended);
		yield* host.merge(work.spec, observed.number, observed.revision).pipe(
			Effect.flatMap(() => saveDelivery(store, { ...intended, merge: "acknowledged" })),
			Effect.catch((error) => saveDelivery(store, rejectedOperation(intended, "merge", error))),
		);
	});
}

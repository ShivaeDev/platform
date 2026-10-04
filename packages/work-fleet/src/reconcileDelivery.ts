import { Effect } from "effect";
import { hasExecution } from "./attempts.ts";
import { deliver } from "./deliver.ts";
import type { Work } from "./domain.ts";
import type { ChangeHost, FleetError } from "./ports.ts";
import type { StoreService } from "./Store.ts";
import { putWork, question } from "./state.ts";
export function reconcileDelivery(store: StoreService, host: typeof ChangeHost.Service) {
	return Effect.gen(function* () {
		const state = yield* store.read();
		for (const work of state.works) {
			if (work.phase === "completed" || work.phase === "held" || hasExecution(state, work.spec.id)) {
				continue;
			}
			yield* deliver(store, host, state, work).pipe(
				Effect.catch((error) => store.update((current) => Effect.succeed(putWork(current, failedVerification(work, error))))),
			);
		}
	});
}
function failedVerification(work: Work, error: FleetError): Work {
	const uncertain = [work.publish, work.merge].some((status) => status === "uncertain" || status === "intent");
	if (error.disposition === "repair" && !uncertain) {
		return { ...work, feedback: error.message, phase: "repair", question: null, review: null, validation: null };
	}
	if (error.disposition === "human" && !uncertain) {
		return question({ ...work, phase: "held" }, "Can this delivery restriction be resolved?", error.message);
	}
	return question(work, "Can this outcome be reconciled?", error.message);
}

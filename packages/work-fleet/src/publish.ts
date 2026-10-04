import { Effect } from "effect";
import type { Work } from "./domain.ts";
import type { ChangeHost, FleetError } from "./ports.ts";
import type { StoreService } from "./Store.ts";
import { putWork, question } from "./state.ts";
export function publish(store: StoreService, host: typeof ChangeHost.Service, work: Work) {
	return Effect.gen(function* () {
		if (work.outcome?.kind !== "branch") {
			return;
		}
		const revision = work.outcome.revision;
		if (work.publish !== "none") {
			const found = yield* host.findPublished(work.spec, revision);
			const observed: Work = found
				? { ...work, outcome: found, publish: "acknowledged", question: null }
				: question(
						work,
						"Did publication create a pull request?",
						"Inspect the deterministic branch on the change host; publication will not be repeated while its outcome is uncertain.",
					);
			yield* store.update((state) => Effect.succeed(putWork(state, observed)));
			return;
		}
		const intended: Work = { ...work, publish: "intent" };
		yield* store.update((state) => Effect.succeed(putWork(state, intended)));
		yield* host
			.publish(
				work.spec,
				revision,
				work.observation
					? { kind: "pull-request", number: work.observation.number, revision: work.observation.revision, url: work.observation.url }
					: undefined,
			)
			.pipe(
				Effect.flatMap((outcome) =>
					store.update((state) => Effect.succeed(putWork(state, { ...intended, outcome, publish: "acknowledged", question: null }))),
				),
				Effect.catch((error) => store.update((state) => Effect.succeed(putWork(state, rejectedOperation(intended, "publish", error))))),
			);
	});
}
export function rejectedOperation(work: Work, operation: "publish" | "merge", error: FleetError): Work {
	if (error.disposition === "repair") {
		return { ...work, [operation]: "none", feedback: error.message, phase: "repair", question: null, review: null };
	}
	if (error.disposition === "human") {
		return question({ ...work, [operation]: "none", phase: "held" }, "Can this delivery restriction be resolved?", error.message);
	}
	if (error.disposition === "retry") {
		return question({ ...work, [operation]: "none" }, "Can the change host be observed?", error.message);
	}
	return question(
		{ ...work, [operation]: "uncertain" },
		`Did ${operation === "publish" ? "publication" : "the merge request"} succeed?`,
		error.message,
	);
}

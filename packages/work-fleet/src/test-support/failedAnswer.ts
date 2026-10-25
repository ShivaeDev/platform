import { Effect } from "effect";
import { answerStore } from "#storage/answerStore.ts";
import { host } from "#test/hostStory.ts";

// Recovery begins with the failed request left by an earlier daemon, beside its current work record.
export function failedAnswer(workId: string) {
	return host.trait("configuration", `${workId} has a stale failed answer`, (engine) => {
		const beforeStart = engine.beforeStart;
		engine.beforeStart = (fixture) =>
			Effect.gen(function* () {
				if (beforeStart !== undefined) {
					yield* beforeStart(fixture);
				}
				const store = yield* answerStore(fixture.host.namespace);
				const request = yield* store.accept(
					workId,
					{ id: `${workId}.1`, links: [], reason: "Choose storage", recommendation: "Use PostgreSQL" },
					"Use PostgreSQL.",
					false,
				);
				yield* store.finish(request, "Board response is missing, ambiguous, superseded or belongs to changed context");
			});
	});
}

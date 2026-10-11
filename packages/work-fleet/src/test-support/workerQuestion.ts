import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import type { Decision } from "#policy.ts";
import { boardHttp } from "#test/boardHttp.ts";
import type { EngineProvider } from "#test/engineProvider.ts";

export const QUESTION = "Which storage should I use?\n\nChoose PostgreSQL or SQLite.";

export const askWorker = Effect.fn("FleetStory.askWorker")(function* (fixture: Pick<EngineProvider, "observations">, workId = "one") {
	const fleet = yield* Fleet;
	const current = (yield* fleet.get(workId)).value.attempts.at(-1)?.receipt;
	const observation = current === undefined ? undefined : fixture.observations.get(current.turnId);
	if (observation === undefined) {
		return yield* Effect.die(new Error("Expected a worker observation"));
	}
	fixture.observations.set(observation.receipt.turnId, { ...observation, execution: "completed", output: `FLEET_QUESTION: ${QUESTION}` });
	const stopped = yield* fleet.reconcile(workId);
	const decision = stopped.value.decision;
	if (decision?.published === undefined) {
		return yield* Effect.die(new Error("Expected a published worker question"));
	}
	return { decision, published: decision.published, stopped };
});

export const answerWorker = Effect.fn("FleetStory.answerWorker")(function* (
	root: string,
	decision: Decision,
	id = "response.worker.answer",
	type: "answer" | "clarify" | "not_now" = "answer",
	supersedes?: string,
) {
	const { client } = yield* boardHttp(root);
	const published = decision.published;
	if (published === undefined) {
		return yield* Effect.die(new Error("Expected a question publication receipt"));
	}
	return yield* Effect.tryPromise(() =>
		client.mutate(
			client.responses.recordResponse.run({
				author: "maintainer",
				body: "Use **PostgreSQL**. Preserve the transaction boundary.",
				id,
				question: published.questionId,
				type,
				...(supersedes === undefined ? {} : { supersedes }),
			}),
		),
	);
});

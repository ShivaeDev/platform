import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { database } from "#test/postgres/database.ts";
import { enqueued, reached, running, waiting } from "#test/postgres/traits.ts";
import { pullRequestQueue, pullRequestWorker, reconcile, refresh } from "#test/singletonQueueOptions.ts";

const Gated = pullRequestQueue();
const gated = running("app", [pullRequestWorker(Gated, { reconcile: { waitsFor: "release" }, refresh: { waitsFor: "release" } })]);
const refreshing = [gated, enqueued(Gated, refresh(42), { as: "refresh 42" }), waiting("release")];

database.it(
	"a job for an entity waits while another job for it runs, and a job for another entity runs alongside",
	refreshing,
	function* ({ attempts, enqueue, job, untilAttempts }) {
		expect(yield* attempts(Gated)).toEqual(["refresh 42"]);

		yield* enqueue("app", Gated, reconcile(42), { as: "reconcile 42" });
		yield* enqueue("app", Gated, reconcile(99), { as: "reconcile 99" });
		yield* untilAttempts(Gated, 2);

		yield* outcomes({
			"attempts": [attempts(Gated), ["refresh 42", "reconcile 99"]],
			"reconcile 42": [job("reconcile 42"), expect.objectContaining({ singletonKey: "pr:42", state: "created" })],
		});
	},
);

database.it(
	"the waiting job for an entity runs once the running one finishes, never alongside it",
	[...refreshing, enqueued(Gated, reconcile(42), { as: "reconcile 42" })],
	function* ({ attempts, job, mostRunningAtOnce, open, untilJob }) {
		expect(yield* job("reconcile 42")).toMatchObject({ state: "created" });

		yield* open("release");
		yield* untilJob("reconcile 42", "completed");

		yield* outcomes({
			"attempts": [attempts(Gated), ["refresh 42", "reconcile 42"]],
			"most running at once": [mostRunningAtOnce(Gated), 1],
		});
	},
);

const earlier = [
	{ retryDelay: 3600, situation: "waits to retry", state: "retry", tries: ["refresh 42", "reconcile 42"] },
	{ retryDelay: 0, situation: "was dead-lettered", state: "failed", tries: ["refresh 42", "refresh 42", "reconcile 42"] },
] as const;

for (const { retryDelay, situation, state, tries } of earlier) {
	const Retried = pullRequestQueue({ retryBackoff: false, retryDelay, retryLimit: 1 });
	const given = [
		running("app", [pullRequestWorker(Retried, { reconcile: "succeeds", refresh: { fails: "Provider unavailable" } })]),
		enqueued(Retried, refresh(42), { as: "refresh 42" }),
		reached("refresh 42", state),
	];

	database.it(`the next job for an entity runs while an earlier job for it ${situation}`, given, function* ({ attempts, enqueue, job, untilJob }) {
		expect(yield* job("refresh 42")).toMatchObject({ singletonKey: "pr:42", state });

		yield* enqueue("app", Retried, reconcile(42), { as: "reconcile 42" });
		yield* untilJob("reconcile 42", "completed");

		yield* outcomes({
			"attempts": [attempts(Retried), [...tries]],
			"refresh 42": [job("refresh 42"), expect.objectContaining({ state })],
		});
	});
}

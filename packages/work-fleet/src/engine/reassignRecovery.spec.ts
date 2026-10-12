import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { askWorker } from "#test/workerQuestion.ts";
import { writeBarrier } from "#test/writeBarrier.ts";

const test = postgresTests("test", "isolated");

test("reassignment recovers a failed supersession acknowledgement without publishing another question", () =>
	withEngine({ acknowledgeFailure: true }, (fixture) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			const old = yield* askWorker(fixture);
			const changed = yield* fleet.reassign("one", old.decision.id, "maintainer");
			expect(changed.value.blocker).toContain("Board request acknowledgement pending");
			expect(changed.value.attentionOwner).toBe("maintainer");
			expect(changed.value.supersededDecisions?.[0]?.boardAcknowledged).toBeUndefined();
			const id = changed.value.decision?.id ?? "missing";
			yield* fixture.restart(
				Effect.gen(function* () {
					const restarted = yield* Fleet;
					const retried = yield* restarted.reassign("one", old.decision.id, "maintainer");
					expect(retried.value.decision?.id).toBe(id);
					const recovered = yield* restarted.reconcile("one");
					expect(recovered.value.decision?.id).toBe(id);
					expect(recovered.value.supersededDecisions?.[0]?.boardAcknowledged).toBe(true);
					expect(recovered.value.blocker).toBeUndefined();
				}),
			);
			expect(fixture.decisions).toHaveLength(2);
			expect(fixture.acknowledgements).toMatchObject([{ decision: old.published, disposition: "superseded" }]);
			expect(fixture.launched).toHaveLength(1);
		}),
	));

test("concurrent reassignment commits one new decision and rejects stale decision IDs", function* () {
	const barrier = yield* writeBarrier;
	return yield* withEngine({ writeGate: barrier.writeGate }, (fixture) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			expect(yield* fleet.reassign("one", "missing", "maintainer").pipe(Effect.flip)).toMatchObject({ _tag: "Conflict" });
			yield* fleet.dispatch("one");
			const old = yield* askWorker(fixture);
			barrier.arm();
			const results = yield* Effect.all(
				[
					fleet.reassign("one", old.decision.id, "maintainer").pipe(Effect.result),
					fleet.reassign("one", old.decision.id, "maintainer").pipe(Effect.result),
				],
				{ concurrency: "unbounded" },
			);
			expect(results.filter((result) => result._tag === "Success")).toHaveLength(1);
			for (const result of results) {
				if (result._tag === "Failure") {
					expect(result.failure).toMatchObject({ _tag: "Conflict" });
				}
			}
			const current = (yield* fleet.reconcile("one")).value;
			expect(current.attentionOwner).toBe("maintainer");
			expect(current.supersededDecisions).toHaveLength(1);
			expect(yield* fleet.reassign("one", old.decision.id, "orchestrator").pipe(Effect.flip)).toMatchObject({ _tag: "Conflict" });
			expect(fixture.launched).toHaveLength(1);
		}),
	);
});

test("reassignment racing resolution commits one action and the loser reports a typed stale decision", function* () {
	const barrier = yield* writeBarrier;
	return yield* withEngine({ writeGate: barrier.writeGate }, (fixture) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			const old = yield* askWorker(fixture);
			const answer = fixture.respond(old.decision.id, "retry");
			barrier.arm();
			const results = yield* Effect.all(
				[fleet.reassign("one", old.decision.id, "maintainer").pipe(Effect.result), fleet.resolve("one", old.decision.id, answer).pipe(Effect.result)],
				{ concurrency: "unbounded" },
			);
			expect(results.filter((result) => result._tag === "Success")).toHaveLength(1);
			for (const result of results) {
				if (result._tag === "Failure") {
					expect(result.failure).toMatchObject({ _tag: "Conflict" });
				}
			}
			const current = (yield* fleet.get("one")).value;
			expect((current.responses?.length ?? 0) + (current.supersededDecisions?.length ?? 0)).toBe(1);
			expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(current.stage === "executing" ? 2 : 1);
		}),
	);
});
